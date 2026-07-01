/**
 * Component: Shelf Sync Core Tests
 * Documentation: documentation/backend/services/goodreads-sync.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from '../helpers/prisma';

const prismaMock = createPrismaMock();
const createRequestForUserMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/services/request-creator.service', () => ({
  createRequestForUser: createRequestForUserMock,
}));

vi.mock('@/lib/integrations/audible.service', () => ({
  getAudibleService: () => ({
    search: vi.fn(),
  }),
}));

const log = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

describe('shelf sync core request media type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.bookMapping.findUnique.mockResolvedValue({
      id: 'mapping-1',
      provider: 'hardcover',
      externalBookId: 'book-1',
      title: 'Shelf Book',
      author: 'Shelf Author',
      audibleAsin: 'B00SHELF01',
      coverUrl: null,
      noMatch: false,
      lastSearchAt: new Date(),
    });
    prismaMock.bookMapping.findMany.mockResolvedValue([]);
    prismaMock.audibleCache.findMany.mockResolvedValue([]);
    createRequestForUserMock.mockResolvedValue({ success: true, request: { id: 'request-1' } });
  });

  it('maps Want To Own Books shelves to EPUB requests', async () => {
    const { processShelfBooks, resolveShelfRequestMediaType, createEmptyStats } = await import('@/lib/services/shelf-sync-core.service');
    const stats = createEmptyStats();

    await processShelfBooks(
      'hardcover',
      [{ bookId: 'book-1', title: 'Shelf Book', author: 'Shelf Author' }],
      'user-1',
      'shelf-1',
      stats,
      log,
      0,
      true,
      resolveShelfRequestMediaType('Want To Own Books'),
    );

    expect(createRequestForUserMock).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        asin: 'B00SHELF01',
        title: 'Shelf Book',
        author: 'Shelf Author',
      }),
      { mediaType: 'epub' },
    );
  });

  it('keeps Want To Own Audiobooks shelves on audiobook requests', async () => {
    const { processShelfBooks, resolveShelfRequestMediaType, createEmptyStats } = await import('@/lib/services/shelf-sync-core.service');
    const stats = createEmptyStats();

    await processShelfBooks(
      'hardcover',
      [{ bookId: 'book-1', title: 'Shelf Book', author: 'Shelf Author' }],
      'user-1',
      'shelf-1',
      stats,
      log,
      0,
      true,
      resolveShelfRequestMediaType('Want To Own Audiobooks'),
    );

    expect(createRequestForUserMock).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        asin: 'B00SHELF01',
      }),
      { mediaType: 'audiobook' },
    );
  });
});
