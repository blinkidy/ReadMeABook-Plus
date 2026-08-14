/**
 * Component: Format-aware audiobook/ebook status route tests
 * Documentation: documentation/integrations/ebook-sidecar.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAuthMock = vi.hoisted(() => vi.fn());
const findBookOrbitMatchMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  configuration: { findUnique: vi.fn() },
  audiobook: { findFirst: vi.fn() },
  audibleCache: { findUnique: vi.fn() },
  request: { findFirst: vi.fn() },
  plexLibrary: { findFirst: vi.fn() },
}));

vi.mock('@/lib/middleware/auth', () => ({
  requireAuth: requireAuthMock,
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/utils/audiobook-matcher', () => ({
  findBookOrbitMatch: findBookOrbitMatchMock,
}));

describe('GET /api/audiobooks/[asin]/ebook-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockImplementation((_request: unknown, handler: (request: unknown) => unknown) => handler({}));
    prismaMock.configuration.findUnique.mockResolvedValue(null);
    prismaMock.audibleCache.findUnique.mockResolvedValue(null);
    prismaMock.plexLibrary.findFirst.mockResolvedValue(null);
    findBookOrbitMatchMock.mockResolvedValue(null);
  });

  it('returns an authoritative advanceable audiobook request tuple', async () => {
    prismaMock.audiobook.findFirst.mockResolvedValue({
      id: 'audiobook-1',
      title: 'Book',
      author: 'Author',
      narrator: null,
    });
    prismaMock.request.findFirst
      .mockResolvedValueOnce({ id: 'ebook-request', status: 'pending' })
      .mockResolvedValueOnce({ id: 'audiobook-request', status: 'awaiting_search', userId: 'audio-owner' });

    const { GET } = await import('@/app/api/audiobooks/[asin]/ebook-status/route');
    const response = await GET({} as any, { params: Promise.resolve({ asin: 'B012345678' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      existingEbookRequestId: 'ebook-request',
      existingAudiobookStatus: 'awaiting_search',
      existingAudiobookRequestId: 'audiobook-request',
      existingAudiobookRequestedByUserId: 'audio-owner',
    });

    const audiobookLookup = prismaMock.request.findFirst.mock.calls[1][0];
    expect(audiobookLookup.where.status.in).toEqual(expect.arrayContaining([
      'failed',
      'awaiting_search',
      'awaiting_release',
    ]));
    expect(audiobookLookup.select).toMatchObject({ id: true, status: true, userId: true });
  });

  it('returns null audiobook request identity when the ASIN has no audiobook record', async () => {
    prismaMock.audiobook.findFirst.mockResolvedValue(null);
    prismaMock.audibleCache.findUnique.mockResolvedValue({
      title: 'Book',
      author: 'Author',
      narrator: null,
    });

    const { GET } = await import('@/app/api/audiobooks/[asin]/ebook-status/route');
    const response = await GET({} as any, { params: Promise.resolve({ asin: 'B012345678' }) });
    const payload = await response.json();

    expect(payload).toMatchObject({
      existingAudiobookStatus: null,
      existingAudiobookRequestId: null,
      existingAudiobookRequestedByUserId: null,
    });
  });
});
