/**
 * Component: Audiobook Matcher Tests
 * Documentation: documentation/integrations/audible.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from '../helpers/prisma';

const prismaMock = createPrismaMock() as ReturnType<typeof createPrismaMock> & {
  reportedIssue: { findMany: ReturnType<typeof vi.fn> };
};

// Add reportedIssue mock (not yet in shared helper) for getOpenIssuesByAsins
(prismaMock as any).reportedIssue = { findMany: vi.fn() };

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

describe('audiobook-matcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.plexLibrary.findFirst.mockResolvedValue(null);
  });

  it('returns ASIN exact match from dedicated field', async () => {
    prismaMock.plexLibrary.findMany.mockResolvedValue([
      {
        plexGuid: 'guid-1',
        plexRatingKey: 'rating-1',
        title: 'Test Book',
        author: 'Test Author',
        asin: 'B00TEST123',
        isbn: null,
      },
    ]);

    const { findPlexMatch } = await import('@/lib/utils/audiobook-matcher');
    const match = await findPlexMatch({
      asin: 'B00TEST123',
      title: 'Test Book',
      author: 'Test Author',
    });

    expect(match?.plexGuid).toBe('guid-1');
  });

  it('rejects candidates with mismatched ASINs in plexGuid', async () => {
    prismaMock.plexLibrary.findMany.mockResolvedValue([
      {
        plexGuid: 'com.plexapp.agents.audible://B00WRONG999',
        plexRatingKey: null,
        title: 'Test Book',
        author: 'Test Author',
        asin: null,
        isbn: null,
      },
    ]);

    const { findPlexMatch } = await import('@/lib/utils/audiobook-matcher');
    const match = await findPlexMatch({
      asin: 'B00RIGHT123',
      title: 'Test Book',
      author: 'Test Author',
    });

    expect(match).toBeNull();
  });

  it('returns null when no ASIN match exists (fuzzy matching removed)', async () => {
    prismaMock.plexLibrary.findMany.mockResolvedValue([]);

    const { findPlexMatch } = await import('@/lib/utils/audiobook-matcher');
    const match = await findPlexMatch({
      asin: 'B00TEST999',
      title: 'Great Book',
      author: 'Different Author',
      narrator: 'Jane Narrator',
    });

    expect(match).toBeNull();
  });

  it('matches BookOrbit-scanned ebooks by exact normalized title and author when ASIN is missing', async () => {
    prismaMock.plexLibrary.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          plexGuid: 'bookorbit://abc123',
          plexRatingKey: null,
          title: 'Yesteryear',
          author: 'Caro Claire Burke',
          asin: null,
          isbn: null,
        },
      ]);

    const { findPlexMatch } = await import('@/lib/utils/audiobook-matcher');
    const match = await findPlexMatch({
      asin: 'B00NOASIN1',
      title: 'Yesteryear',
      author: 'Caro Claire Burke',
    });

    expect(match?.plexGuid).toBe('bookorbit://abc123');
  });

  it('matches BookOrbit author against request authors that include translator metadata', async () => {
    prismaMock.plexLibrary.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          plexGuid: 'bookorbit://yesteryear',
          plexRatingKey: null,
          title: 'Yesteryear',
          author: 'Caro Claire Burke',
          asin: null,
          isbn: null,
        },
      ]);

    const { findPlexMatch } = await import('@/lib/utils/audiobook-matcher');
    const match = await findPlexMatch({
      asin: 'B0G446KTPG',
      title: 'Yesteryear',
      author: 'Caro Claire Burke, Dietlind Falk - Übersetzer, Lisa Kögeböhn - Übersetzer',
    });

    expect(match?.plexGuid).toBe('bookorbit://yesteryear');
  });

  it('matches a unique BookOrbit ebook by cleaned title when library author is unknown', async () => {
    prismaMock.plexLibrary.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          plexGuid: 'bookorbit://yesteryear',
          plexRatingKey: null,
          title: 'Yesteryear',
          author: 'Unknown Author',
          asin: null,
          isbn: null,
        },
      ]);

    const { findPlexMatch } = await import('@/lib/utils/audiobook-matcher');
    const match = await findPlexMatch({
      asin: 'B00NOASIN2',
      title: 'Yesteryear: A GMA Book Club Pick',
      author: 'Caro Claire Burke',
    });

    expect(match?.plexGuid).toBe('bookorbit://yesteryear');
  });

  it('matches BookOrbit ebooks by primary title when the Audible subtitle was dropped', async () => {
    prismaMock.plexLibrary.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          plexGuid: 'bookorbit://housemaid',
          plexRatingKey: null,
          title: 'The Housemaid',
          author: 'Freida McFadden',
          asin: null,
          isbn: null,
        },
      ]);

    const { findPlexMatch } = await import('@/lib/utils/audiobook-matcher');
    const match = await findPlexMatch({
      asin: 'B00NOASIN4',
      title: 'The Housemaid: A Novel',
      author: 'Freida McFadden',
    });

    expect(match?.plexGuid).toBe('bookorbit://housemaid');
  });

  it('does not use loose BookOrbit title matching when multiple candidates share the title', async () => {
    prismaMock.plexLibrary.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          plexGuid: 'bookorbit://one',
          plexRatingKey: null,
          title: 'The Last Thing',
          author: 'Unknown Author',
          asin: null,
          isbn: null,
        },
        {
          plexGuid: 'bookorbit://two',
          plexRatingKey: null,
          title: 'The Last Thing',
          author: 'Unknown Author',
          asin: null,
          isbn: null,
        },
      ]);

    const { findPlexMatch } = await import('@/lib/utils/audiobook-matcher');
    const match = await findPlexMatch({
      asin: 'B00NOASIN3',
      title: 'The Last Thing',
      author: 'Some Author',
    });

    expect(match).toBeNull();
  });

  it('matches library items by ASIN or ISBN only (no fuzzy fallback)', async () => {
    const items = [
      { id: '1', externalId: 'g1', title: 'Alpha', author: 'Author A', asin: 'ASIN1' },
      { id: '2', externalId: 'g2', title: 'Beta', author: 'Author B', isbn: '978-1-23456-789-7' },
      { id: '3', externalId: 'g3', title: 'Gamma Book', author: 'Author C' },
    ];

    const { matchAudiobook } = await import('@/lib/utils/audiobook-matcher');
    const asinMatch = matchAudiobook({ title: 'x', author: 'y', asin: 'ASIN1' }, items);
    expect(asinMatch?.externalId).toBe('g1');

    const isbnMatch = matchAudiobook({ title: 'x', author: 'y', isbn: '9781234567897' }, items);
    expect(isbnMatch?.externalId).toBe('g2');

    const noMatch = matchAudiobook({ title: 'Gamma Book', author: 'Author C' }, items);
    expect(noMatch).toBeNull();
  });

  it('enriches audiobooks with availability and request status', async () => {
    prismaMock.plexLibrary.findMany
      .mockResolvedValueOnce([
        {
          plexGuid: 'guid-1',
          plexRatingKey: null,
          title: 'Book One',
          author: 'Author One',
          asin: 'ASIN1',
          isbn: null,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    prismaMock.audiobook.findMany.mockResolvedValue([
      {
        id: 'a1',
        audibleAsin: 'ASIN1',
        requests: [
          {
            id: 'r1',
            status: 'downloading',
            userId: 'other-user',
            user: { plexUsername: 'OtherUser' },
          },
        ],
      },
    ]);

    // Mock reported issues (none for this test)
    prismaMock.reportedIssue.findMany.mockResolvedValue([]);

    const { enrichAudiobooksWithMatches } = await import('@/lib/utils/audiobook-matcher');
    const results = await enrichAudiobooksWithMatches(
      [
        { asin: 'ASIN1', title: 'Book One', author: 'Author One' },
        { asin: 'ASIN2', title: 'Book Two', author: 'Author Two' },
      ],
      'current-user'
    );

    expect(results[0].isAvailable).toBe(true);
    expect(results[0].isRequested).toBe(true);
    expect(results[0].requestedByUsername).toBe('OtherUser');

    expect(results[1].isAvailable).toBe(false);
    expect(results[1].isRequested).toBe(false);
  });

  it('treats fulfilled ebook requests as requested/completed search state', async () => {
    prismaMock.plexLibrary.findMany.mockResolvedValue([]);

    prismaMock.audiobook.findMany.mockResolvedValue([
      {
        id: 'a1',
        audibleAsin: 'ASIN1',
        requests: [
          {
            id: 'r-ebook',
            status: 'available',
            type: 'ebook',
            userId: 'other-user',
            user: { plexUsername: 'OtherUser' },
          },
        ],
      },
    ]);

    prismaMock.reportedIssue.findMany.mockResolvedValue([]);

    const { enrichAudiobooksWithMatches } = await import('@/lib/utils/audiobook-matcher');
    const results = await enrichAudiobooksWithMatches(
      [{ asin: 'ASIN1', title: 'Ebook One', author: 'Author One' }],
      'current-user',
    );

    expect(results[0].isRequested).toBe(true);
    expect((results[0] as any).requestStatus).toBe('available');
    expect((results[0] as any).requestId).toBe('r-ebook');
  });

  it('reports audiobookAvailable and ebookAvailable independently when only the audiobook is owned', async () => {
    prismaMock.plexLibrary.findMany.mockResolvedValueOnce([
      { plexGuid: 'plex://guid-1', asin: 'ASIN1', plexLibraryId: 'audiobooks' },
    ]);

    const { enrichAudiobookWithMatch } = await import('@/lib/utils/audiobook-matcher');
    const result = await enrichAudiobookWithMatch({ asin: 'ASIN1', title: 'Book', author: 'Author' });

    expect(result.isAvailable).toBe(true);
    expect(result.audiobookAvailable).toBe(true);
    expect(result.ebookAvailable).toBe(false);
    expect(result.plexGuid).toBe('plex://guid-1');
  });

  it('reports ebookAvailable only when the matching row is a BookOrbit library row', async () => {
    prismaMock.plexLibrary.findMany.mockResolvedValueOnce([
      { plexGuid: 'bookorbit://guid-1', asin: 'ASIN1', plexLibraryId: 'bookorbit' },
    ]);

    const { enrichAudiobookWithMatch } = await import('@/lib/utils/audiobook-matcher');
    const result = await enrichAudiobookWithMatch({ asin: 'ASIN1', title: 'Book', author: 'Author' });

    expect(result.isAvailable).toBe(true);
    expect(result.audiobookAvailable).toBe(false);
    expect(result.ebookAvailable).toBe(true);
  });

  it('reports both formats available when both an audiobook and BookOrbit row match', async () => {
    prismaMock.plexLibrary.findMany.mockResolvedValueOnce([
      { plexGuid: 'plex://guid-1', asin: 'ASIN1', plexLibraryId: 'audiobooks' },
      { plexGuid: 'bookorbit://guid-1', asin: 'ASIN1', plexLibraryId: 'bookorbit' },
    ]);

    const { enrichAudiobookWithMatch } = await import('@/lib/utils/audiobook-matcher');
    const result = await enrichAudiobookWithMatch({ asin: 'ASIN1', title: 'Book', author: 'Author' });

    expect(result.audiobookAvailable).toBe(true);
    expect(result.ebookAvailable).toBe(true);
  });

  it('falls back to the BookOrbit fuzzy match for ebookAvailable when no direct ASIN row exists', async () => {
    prismaMock.plexLibrary.findMany
      .mockResolvedValueOnce([]) // no direct ASIN match
      .mockResolvedValueOnce([
        { plexGuid: 'bookorbit://fuzzy', plexRatingKey: null, title: 'Book', author: 'Author', asin: null, isbn: null },
      ]);

    const { enrichAudiobookWithMatch } = await import('@/lib/utils/audiobook-matcher');
    const result = await enrichAudiobookWithMatch({ asin: 'ASIN1', title: 'Book', author: 'Author' });

    expect(result.audiobookAvailable).toBe(false);
    expect(result.ebookAvailable).toBe(true);
  });
});

describe('getAvailableAsins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes library rows and request types to "audiobook" when a format is given', async () => {
    prismaMock.plexLibrary.findMany.mockResolvedValue([]);
    prismaMock.audiobook.findMany.mockResolvedValue([]);

    const { getAvailableAsins } = await import('@/lib/utils/audiobook-matcher');
    await getAvailableAsins('audiobook');

    expect(prismaMock.plexLibrary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { asin: { not: null }, plexLibraryId: { not: 'bookorbit' } },
      })
    );
    expect(prismaMock.audiobook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requests: { some: expect.objectContaining({ type: { in: ['audiobook'] } }) },
        }),
      })
    );
  });

  it('scopes library rows and request types to "ebook" when a format is given', async () => {
    prismaMock.plexLibrary.findMany.mockResolvedValue([]);
    prismaMock.audiobook.findMany.mockResolvedValue([]);

    const { getAvailableAsins } = await import('@/lib/utils/audiobook-matcher');
    await getAvailableAsins('ebook');

    expect(prismaMock.plexLibrary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { asin: { not: null }, plexLibraryId: 'bookorbit' },
      })
    );
    expect(prismaMock.audiobook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requests: { some: expect.objectContaining({ type: { in: ['ebook'] } }) },
        }),
      })
    );
  });

  it('defaults to combined (either format) behavior when no format is given', async () => {
    prismaMock.plexLibrary.findMany.mockResolvedValue([]);
    prismaMock.audiobook.findMany.mockResolvedValue([]);

    const { getAvailableAsins } = await import('@/lib/utils/audiobook-matcher');
    await getAvailableAsins();

    expect(prismaMock.plexLibrary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { asin: { not: null } } })
    );
    expect(prismaMock.audiobook.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requests: { some: expect.objectContaining({ type: { in: ['audiobook', 'ebook'] } }) },
        }),
      })
    );
  });
});


