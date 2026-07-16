/**
 * Component: Shelf Sync Core Tests
 * Documentation: documentation/backend/services/goodreads-sync.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from '../helpers/prisma';

const prismaMock = createPrismaMock();
const createRequestForUserMock = vi.hoisted(() => vi.fn());
const audibleSearchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/services/request-creator.service', () => ({
  createRequestForUser: createRequestForUserMock,
}));

vi.mock('@/lib/integrations/audible.service', () => ({
  getAudibleService: () => ({
    search: audibleSearchMock,
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

  it('creates an EPUB request from Hardcover metadata when no Audible edition exists', async () => {
    prismaMock.bookMapping.findUnique.mockResolvedValueOnce(null);
    const { processShelfBooks, resolveShelfRequestMediaType, createEmptyStats } = await import('@/lib/services/shelf-sync-core.service');
    const stats = createEmptyStats();

    await processShelfBooks(
      'hardcover',
      [{
        bookId: 'hardcover-1421',
        title: 'Drowning: The Rescue of Flight 1421',
        author: 'T.J. Newman',
        coverUrl: 'https://example.com/drowning.jpg',
      }],
      'user-1',
      'shelf-1',
      stats,
      log,
      10,
      true,
      resolveShelfRequestMediaType('Want To Own Books'),
    );

    expect(createRequestForUserMock).toHaveBeenCalledWith(
      'user-1',
      {
        title: 'Drowning: The Rescue of Flight 1421',
        author: 'T.J. Newman',
        coverArtUrl: 'https://example.com/drowning.jpg',
      },
      { mediaType: 'epub' },
    );
    expect(audibleSearchMock).not.toHaveBeenCalled();
    expect(stats).toEqual(expect.objectContaining({
      booksFound: 1,
      lookupsPerformed: 0,
      requestsCreated: 1,
    }));
  });
});
