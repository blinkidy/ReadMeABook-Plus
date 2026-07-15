/**
 * Component: EPUB Cover Extraction Tests
 * Documentation: documentation/features/library-thumbnail-cache.md
 */

import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { extractEpubCover } from '@/lib/utils/epub-cover';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('extractEpubCover', () => {
  it('extracts the package cover image from a standard EPUB', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rmab-epub-'));
    tempDirectories.push(directory);
    const epubPath = path.join(directory, 'book.epub');
    const expectedCover = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const zip = new AdmZip();
    zip.addFile('META-INF/container.xml', Buffer.from(`<?xml version="1.0"?>
      <container><rootfiles><rootfile full-path="OEBPS/content.opf" /></rootfiles></container>`));
    zip.addFile('OEBPS/content.opf', Buffer.from(`<?xml version="1.0"?>
      <package><metadata><meta name="cover" content="cover-image" /></metadata>
      <manifest><item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" /></manifest></package>`));
    zip.addFile('OEBPS/images/cover.jpg', expectedCover);
    zip.writeZip(epubPath);

    const result = await extractEpubCover(epubPath);

    expect(result?.extension).toBe('.jpg');
    expect(result?.data).toEqual(expectedCover);
  });
});
