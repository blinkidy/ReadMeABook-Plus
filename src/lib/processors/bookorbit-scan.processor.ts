/**
 * Component: BookOrbit Library Scan Processor
 * Documentation: documentation/integrations/ebook-sidecar.md
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../db';
import { getConfigService } from '../services/config.service';
import { RMABLogger } from '../utils/logger';

const logger = RMABLogger.create('BookOrbitScan');

const BOOKORBIT_LIBRARY_ID = 'bookorbit';
const BOOKORBIT_GUID_PREFIX = 'bookorbit://';
const EBOOK_EXTENSIONS = new Set(['.epub', '.pdf', '.mobi', '.azw', '.azw3', '.fb2', '.cbz', '.cbr']);
const MAX_SCAN_FILES = 5000;

interface BookOrbitScanPayload {
  jobId?: string;
  scheduledJobId?: string;
}

interface DiscoveredEbook {
  filePath: string;
  title: string;
  author: string;
  asin?: string;
}

function extractAsin(value: string): string | undefined {
  return value.match(/\bB[A-Z0-9]{9}\b/i)?.[0]?.toUpperCase();
}

function stripAsin(value: string): string {
  return value
    .replace(/\bB[A-Z0-9]{9}\b/ig, '')
    .replace(/\s+\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanName(value: string): string {
  return stripAsin(value)
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stableGuid(filePath: string): string {
  const hash = crypto.createHash('sha1').update(filePath).digest('hex');
  return `${BOOKORBIT_GUID_PREFIX}${hash}`;
}

async function walkEbookFiles(root: string, files: string[] = []): Promise<string[]> {
  if (files.length >= MAX_SCAN_FILES) return files;

  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (files.length >= MAX_SCAN_FILES) break;
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      await walkEbookFiles(fullPath, files);
    } else if (entry.isFile() && EBOOK_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function resolveBookOrbitLibraryPath(): Promise<string | null> {
  const configService = getConfigService();
  const configuredLibraryPath = await configService.get('ebook_bookorbit_library_path');
  const configuredIngestPath = await configService.get('ebook_bookorbit_ingest_path');
  const mediaDir = await configService.get('media_dir');

  return (
    configuredLibraryPath ||
    process.env.BOOKORBIT_LIBRARY_PATH ||
    configuredIngestPath ||
    process.env.BOOKORBIT_INGEST_PATH ||
    mediaDir ||
    process.env.MEDIA_DIR ||
    null
  );
}

async function discoverEbook(rootPath: string, filePath: string): Promise<DiscoveredEbook> {
  const relative = path.relative(rootPath, filePath);
  const segments = relative.split(path.sep).filter(Boolean);
  const filename = path.basename(filePath, path.extname(filePath));
  const parent = segments.length > 1 ? segments[segments.length - 2] : filename;
  const grandparent = segments.length > 2 ? segments[segments.length - 3] : '';

  const asin = extractAsin(relative);
  let title = cleanName(parent || filename);
  let author = cleanName(grandparent);

  const filenameParts = cleanName(filename).split(/\s+-\s+/);
  if ((!author || author.toLowerCase() === 'unknown') && filenameParts.length >= 2) {
    title = filenameParts[0].trim();
    author = filenameParts.slice(1).join(' - ').trim();
  }

  if (!author) author = 'Unknown Author';
  if (!title) title = cleanName(filename) || path.basename(filePath);

  if (asin) {
    const cached = await prisma.audibleCache.findUnique({
      where: { asin },
      select: { title: true, author: true },
    });
    if (cached) {
      title = cached.title;
      author = cached.author;
    }
  }

  if (!asin) {
    const cached = await prisma.audibleCache.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
        author: { equals: author, mode: 'insensitive' },
      },
      select: { asin: true, title: true, author: true },
    });
    if (cached) {
      title = cached.title;
      author = cached.author;
      return { filePath, title, author, asin: cached.asin };
    }
  }

  return { filePath, title, author, asin };
}

async function markMatchingEbookRequestsAvailable(book: DiscoveredEbook): Promise<number> {
  const where: any = {
    type: 'ebook',
    deletedAt: null,
    status: { notIn: ['available', 'cancelled', 'denied'] },
    audiobook: {},
  };

  if (book.asin) {
    where.audiobook.audibleAsin = book.asin;
  } else {
    where.audiobook.title = { equals: book.title, mode: 'insensitive' };
    where.audiobook.author = { equals: book.author, mode: 'insensitive' };
  }

  const result = await prisma.request.updateMany({
    where,
    data: {
      status: 'available',
      progress: 100,
      completedAt: new Date(),
      errorMessage: null,
      updatedAt: new Date(),
    },
  });

  return result.count;
}

export async function processBookOrbitScan(payload: BookOrbitScanPayload = {}): Promise<any> {
  const jobLogger = payload.jobId ? RMABLogger.forJob(payload.jobId, 'BookOrbitScan') : logger;
  const rootPath = await resolveBookOrbitLibraryPath();

  if (!rootPath) {
    await jobLogger.warn('BookOrbit scan skipped: no BookOrbit library, ingest, or media directory configured');
    return { scanned: 0, upserted: 0, markedAvailable: 0, skipped: true };
  }

  try {
    const stats = await fs.stat(rootPath);
    if (!stats.isDirectory()) {
      await jobLogger.warn(`BookOrbit scan skipped: path is not a directory (${rootPath})`);
      return { scanned: 0, upserted: 0, markedAvailable: 0, skipped: true };
    }
  } catch (error) {
    await jobLogger.warn(`BookOrbit scan skipped: path is not accessible (${rootPath})`);
    return { scanned: 0, upserted: 0, markedAvailable: 0, skipped: true };
  }

  const files = await walkEbookFiles(rootPath);
  await jobLogger.info(`BookOrbit scan found ${files.length} ebook file(s) under ${rootPath}`);

  let upserted = 0;
  let markedAvailable = 0;
  const seenGuids = new Set<string>();

  for (const file of files) {
    const book = await discoverEbook(rootPath, file);
    const guid = stableGuid(file);
    seenGuids.add(guid);

    await prisma.plexLibrary.upsert({
      where: { plexGuid: guid },
      create: {
        plexGuid: guid,
        title: book.title,
        author: book.author,
        asin: book.asin || null,
        filePath: file,
        plexLibraryId: BOOKORBIT_LIBRARY_ID,
        addedAt: new Date(),
      },
      update: {
        title: book.title,
        author: book.author,
        asin: book.asin || null,
        filePath: file,
        plexLibraryId: BOOKORBIT_LIBRARY_ID,
        lastScannedAt: new Date(),
      },
    });

    upserted++;
    markedAvailable += await markMatchingEbookRequestsAvailable(book);
  }

  const stale = files.length >= MAX_SCAN_FILES
    ? { count: 0 }
    : await prisma.plexLibrary.deleteMany({
      where: seenGuids.size > 0
        ? { plexGuid: { startsWith: BOOKORBIT_GUID_PREFIX, notIn: [...seenGuids] } }
        : { plexGuid: { startsWith: BOOKORBIT_GUID_PREFIX } },
    });

  await jobLogger.info(
    `BookOrbit scan complete: ${upserted} cached, ${markedAvailable} ebook request(s) marked available, ${stale.count} stale row(s) removed`,
  );

  return {
    scanned: files.length,
    upserted,
    markedAvailable,
    staleRemoved: stale.count,
    truncated: files.length >= MAX_SCAN_FILES,
  };
}
