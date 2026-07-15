/**
 * Component: BookOrbit Scan Processor Tests
 * Documentation: documentation/integrations/ebook-sidecar.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { createPrismaMock } from '../helpers/prisma';

const prismaMock = createPrismaMock();
const configMock = vi.hoisted(() => ({ get: vi.fn() }));
const extractEpubCoverMock = vi.hoisted(() => vi.fn());
const cacheEmbeddedCoverMock = vi.hoisted(() => vi.fn());
const bookOrbitRoot = path.resolve('bookorbit-library');

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/services/config.service', () => ({
  getConfigService: () => configMock,
}));

vi.mock('fs/promises');
vi.mock('@/lib/utils/epub-cover', () => ({ extractEpubCover: extractEpubCoverMock }));
vi.mock('@/lib/services/thumbnail-cache.service', () => ({
  getThumbnailCacheService: () => ({ cacheEmbeddedLibraryThumbnail: cacheEmbeddedCoverMock }),
}));

describe('bookorbit-scan.processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configMock.get.mockImplementation(async (key: string) => {
      if (key === 'ebook_bookorbit_library_path') return bookOrbitRoot;
      return null;
    });

    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    prismaMock.plexLibrary.upsert.mockResolvedValue({});
    prismaMock.plexLibrary.findUnique.mockResolvedValue(null);
    prismaMock.plexLibrary.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.audibleCache.findUnique.mockResolvedValue(null);
    prismaMock.audibleCache.findFirst.mockResolvedValue(null);
    prismaMock.audibleCache.findMany.mockResolvedValue([]);
    prismaMock.request.findMany.mockResolvedValue([]);
    prismaMock.request.updateMany.mockResolvedValue({ count: 0 });
    extractEpubCoverMock.mockResolvedValue(null);
    cacheEmbeddedCoverMock.mockResolvedValue(null);
  });

  const mockDirectory = (root: string, files: string[]) => {
    vi.mocked(fs.readdir).mockImplementation(async (dir: any) => {
      const dirPath = String(dir);
      const entries = new Map<string, { isDirectory: boolean }>();

      for (const file of files) {
        const relative = path.relative(root, file);
        const parts = relative.split(path.sep);
        const current = dirPath === root ? '' : path.relative(root, dirPath);
        let remaining = parts;
        if (current) {
          if (!relative.startsWith(current + path.sep)) continue;
          remaining = path.relative(current, relative).split(path.sep);
        }
        entries.set(remaining[0], { isDirectory: remaining.length > 1 });
      }

      return [...entries.entries()].map(([name, info]) => ({
        name,
        isDirectory: () => info.isDirectory,
        isFile: () => !info.isDirectory,
      })) as any;
    });
  };

  it('backfills the ASIN from AudibleCache when the BookOrbit file drops the Audible subtitle', async () => {
    const root = bookOrbitRoot;
    mockDirectory(root, [path.join(root, 'Books', 'Jane Author', 'The Housemaid', 'The Housemaid.epub')]);

    prismaMock.audibleCache.findMany.mockResolvedValue([
      { asin: 'B00HOUSEMAID', title: 'The Housemaid: A Novel', author: 'Jane Author' },
    ]);

    const { processBookOrbitScan } = await import('@/lib/processors/bookorbit-scan.processor');
    await processBookOrbitScan();

    expect(prismaMock.plexLibrary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ asin: 'B00HOUSEMAID' }),
      }),
    );
  });

  it('marks a pending ebook request available when the request title carries an Audible subtitle', async () => {
    const root = bookOrbitRoot;
    mockDirectory(root, [path.join(root, 'Books', 'Jane Author', 'The Housemaid', 'The Housemaid.epub')]);

    prismaMock.request.findMany.mockResolvedValue([
      {
        id: 'req-1',
        audiobook: { title: 'The Housemaid: A Novel', author: 'Jane Author' },
      },
    ]);
    prismaMock.request.updateMany.mockResolvedValue({ count: 1 });

    const { processBookOrbitScan } = await import('@/lib/processors/bookorbit-scan.processor');
    const result = await processBookOrbitScan();

    expect(prismaMock.request.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['req-1'] } },
        data: expect.objectContaining({ status: 'available' }),
      }),
    );
    expect(result.markedAvailable).toBe(1);
  });

  it('stores an embedded EPUB cover in the shared library cache', async () => {
    const root = bookOrbitRoot;
    const file = path.join(root, 'Books', 'Jane Author', 'Cover Book', 'Cover Book.epub');
    mockDirectory(root, [file]);
    extractEpubCoverMock.mockResolvedValue({ data: Buffer.from('cover'), extension: '.jpg' });
    cacheEmbeddedCoverMock.mockResolvedValue('/app/cache/library/cover.jpg');

    const { processBookOrbitScan } = await import('@/lib/processors/bookorbit-scan.processor');
    await processBookOrbitScan();

    expect(cacheEmbeddedCoverMock).toHaveBeenCalledWith(
      expect.stringMatching(/^bookorbit:\/\//),
      Buffer.from('cover'),
      '.jpg',
    );
    expect(prismaMock.plexLibrary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ cachedLibraryCoverPath: '/app/cache/library/cover.jpg' }),
      }),
    );
  });
});
