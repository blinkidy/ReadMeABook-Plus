/**
 * Component: Request Creator No-ASIN Tests
 * Documentation: documentation/integrations/hardcover-search.md
 *
 * Tests createRequestForUser for books with no ASIN (e.g. Hardcover search
 * results with no audiobook edition) — these must be matched by title+author
 * instead of audibleAsin, since Prisma silently drops `undefined` filter keys.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from '../helpers/prisma';

const prismaMock = createPrismaMock();

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/utils/logger', () => ({
  RMABLogger: {
    create: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

const findBookOrbitMatchMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock('@/lib/utils/audiobook-matcher', () => ({
  findPlexMatch: vi.fn().mockResolvedValue(null),
  findBookOrbitMatch: findBookOrbitMatchMock,
}));

const audibleServiceMock = vi.hoisted(() => ({
  getAudiobookDetails: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/integrations/audible.service', () => ({
  getAudibleService: () => audibleServiceMock,
}));

const jobQueueAddSearchJob = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const jobQueueAddSearchEbookJob = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const jobQueueAddNotificationJob = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/lib/services/job-queue.service', () => ({
  getJobQueueService: () => ({
    addSearchJob: jobQueueAddSearchJob,
    addSearchEbookJob: jobQueueAddSearchEbookJob,
    addNotificationJob: jobQueueAddNotificationJob,
  }),
}));

const configServiceGet = vi.hoisted(() => vi.fn());
vi.mock('@/lib/services/config.service', () => ({
  getConfigService: () => ({ get: configServiceGet }),
}));

const mockSeedAsin = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/lib/services/works.service', () => ({
  getSiblingAsins: vi.fn().mockResolvedValue(new Map()),
  seedAsin: (...args: any[]) => mockSeedAsin(...args),
}));

const HARDCOVER_BOOK = {
  title: 'The Housemaid',
  author: 'Freida McFadden',
  description: 'A thriller.',
  coverArtUrl: 'https://example.com/cover.jpg',
};

const TEST_USER_ID = 'user-123';

describe('createRequestForUser — no ASIN (Hardcover-sourced books)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jobQueueAddSearchJob.mockResolvedValue(undefined);
    jobQueueAddSearchEbookJob.mockResolvedValue(undefined);
    jobQueueAddNotificationJob.mockResolvedValue(undefined);
    findBookOrbitMatchMock.mockResolvedValue(null);
    audibleServiceMock.getAudiobookDetails.mockResolvedValue(null);
    configServiceGet.mockResolvedValue(null);

    prismaMock.request.findFirst.mockResolvedValue(null);
    prismaMock.plexLibrary.findFirst.mockResolvedValue(null);
    prismaMock.audiobook.findFirst.mockResolvedValue(null);
    prismaMock.audiobook.create.mockResolvedValue({
      id: 'audiobook-1',
      audibleAsin: null,
      title: HARDCOVER_BOOK.title,
      author: HARDCOVER_BOOK.author,
      narrator: null,
    });
    prismaMock.request.create.mockResolvedValue({
      id: 'request-1',
      userId: TEST_USER_ID,
      audiobookId: 'audiobook-1',
      status: 'pending',
      audiobook: { id: 'audiobook-1', title: HARDCOVER_BOOK.title },
      user: { id: TEST_USER_ID, plexUsername: 'testuser' },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      role: 'user',
      autoApproveRequests: true,
      plexUsername: 'testuser',
    });
  });

  it('rejects audiobook-type requests with no ASIN instead of matching an arbitrary row', async () => {
    const { createRequestForUser } = await import('@/lib/services/request-creator.service');
    const result = await createRequestForUser(TEST_USER_ID, HARDCOVER_BOOK, { mediaType: 'audiobook' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe('duplicate');
    }
    // Must never reach a Prisma query that could match on an undefined ASIN filter
    expect(prismaMock.request.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.plexLibrary.findFirst).not.toHaveBeenCalled();
  });

  it('creates a first-class EPUB request keyed by title+author when there is no ASIN', async () => {
    const { createRequestForUser } = await import('@/lib/services/request-creator.service');
    const result = await createRequestForUser(TEST_USER_ID, HARDCOVER_BOOK, {
      mediaType: 'epub',
      bypassIgnore: true,
    });

    expect(result.success).toBe(true);

    // The "already fulfilled" lookup must filter by audibleAsin: null + title/author,
    // never by an unguarded `audibleAsin: undefined` (which Prisma treats as "no filter").
    expect(prismaMock.request.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          audiobook: expect.objectContaining({
            audibleAsin: null,
            title: { equals: HARDCOVER_BOOK.title, mode: 'insensitive' },
            author: { equals: HARDCOVER_BOOK.author, mode: 'insensitive' },
          }),
        }),
      })
    );

    // Audiobook record lookup must be similarly guarded
    expect(prismaMock.audiobook.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          audibleAsin: null,
          title: { equals: HARDCOVER_BOOK.title, mode: 'insensitive' },
          author: { equals: HARDCOVER_BOOK.author, mode: 'insensitive' },
        }),
      })
    );

    expect(prismaMock.audiobook.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ audibleAsin: null }),
      })
    );

    // No Audnexus enrichment or works-table seeding without an ASIN
    expect(audibleServiceMock.getAudiobookDetails).not.toHaveBeenCalled();
    expect(mockSeedAsin).not.toHaveBeenCalled();

    expect(jobQueueAddSearchEbookJob).toHaveBeenCalledWith(
      'request-1',
      expect.objectContaining({ id: 'audiobook-1', asin: undefined }),
      'epub'
    );
  });
});
