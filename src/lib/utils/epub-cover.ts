import path from 'path';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

type XmlNode = Record<string, any>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeEntryPath(value: string): string | null {
  const normalized = path.posix.normalize(value.replace(/\\/g, '/')).replace(/^\/+/, '');
  return normalized.startsWith('../') || normalized === '..' ? null : normalized;
}

export interface ExtractedEpubCover {
  data: Buffer;
  extension: string;
}

/** Extract the cover image referenced by an EPUB package without modifying the book. */
export async function extractEpubCover(filePath: string): Promise<ExtractedEpubCover | null> {
  const zip = new AdmZip(filePath);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const containerEntry = zip.getEntry('META-INF/container.xml');
  if (!containerEntry) return null;

  const container = parser.parse(containerEntry.getData().toString('utf8')) as XmlNode;
  const rootFile = asArray(container?.container?.rootfiles?.rootfile)[0];
  const packagePath = normalizeEntryPath(rootFile?.['@_full-path']);
  if (!packagePath) return null;

  const packageEntry = zip.getEntry(packagePath);
  if (!packageEntry) return null;

  const opf = parser.parse(packageEntry.getData().toString('utf8')) as XmlNode;
  const pkg = opf?.package;
  const items = asArray<XmlNode>(pkg?.manifest?.item);
  const metadata = asArray<XmlNode>(pkg?.metadata?.meta);
  const coverId = metadata.find((meta) => String(meta?.['@_name']).toLowerCase() === 'cover')?.['@_content'];

  const coverItem = items.find((item) => coverId && item?.['@_id'] === coverId)
    || items.find((item) => String(item?.['@_properties'] || '').split(/\s+/).includes('cover-image'))
    || items.find((item) => /cover/i.test(String(item?.['@_id'] || item?.['@_href'] || '')));
  const href = coverItem?.['@_href'];
  if (!href) return null;

  const entryPath = normalizeEntryPath(path.posix.join(path.posix.dirname(packagePath), href));
  if (!entryPath) return null;
  const extension = path.posix.extname(entryPath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return null;

  const coverEntry = zip.getEntry(entryPath);
  if (!coverEntry || coverEntry.header.size > MAX_COVER_BYTES) return null;
  const data = coverEntry.getData();
  return data.length > 0 && data.length <= MAX_COVER_BYTES ? { data, extension } : null;
}
