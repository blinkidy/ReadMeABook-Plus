/**
 * Component: Blocked Results Filter Tests
 * Documentation: documentation/backend/database.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getBlocklistForRequestMock = vi.fn();

vi.mock('@/lib/services/blocklist.service', () => ({
  getBlocklistForRequest: getBlocklistForRequestMock,
}));

describe('filterBlockedResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns input unchanged when results array is empty', async () => {
    const { filterBlockedResults } = await import('@/lib/utils/filter-blocked-results');
    const { kept, blockedCount } = await filterBlockedResults('req-1', []);
    expect(kept).toEqual([]);
    expect(blockedCount).toBe(0);
    // Empty results should short-circuit before hitting the DB.
    expect(getBlocklistForRequestMock).not.toHaveBeenCalled();
  });

  it('returns input unchanged when blocklist is empty', async () => {
    getBlocklistForRequestMock.mockResolvedValueOnce([]);
    const { filterBlockedResults } = await import('@/lib/utils/filter-blocked-results');
    const results = [{ title: 'Some Release' }];
    const { kept, blockedCount } = await filterBlockedResults('req-1', results);
    expect(kept).toBe(results);
    expect(blockedCount).toBe(0);
  });

  it('removes results that match a blocked release name case-insensitively', async () => {
    getBlocklistForRequestMock.mockResolvedValueOnce([
      { releaseKey: 'foo bar [m4b]', releaseHash: null },
    ]);
    const { filterBlockedResults } = await import('@/lib/utils/filter-blocked-results');
    const { kept, blockedCount } = await filterBlockedResults('req-1', [
      { title: '  FOO BAR [M4B]  ' },
      { title: 'Other Release' },
    ]);
    expect(kept).toEqual([{ title: 'Other Release' }]);
    expect(blockedCount).toBe(1);
  });

  it('removes results that match by infoHash even when title differs', async () => {
    getBlocklistForRequestMock.mockResolvedValueOnce([
      { releaseKey: 'something else', releaseHash: 'abc123' },
    ]);
    const { filterBlockedResults } = await import('@/lib/utils/filter-blocked-results');
    const { kept, blockedCount } = await filterBlockedResults('req-1', [
      { title: 'Different Title', infoHash: 'abc123' },
      { title: 'Keep Me', infoHash: 'zzz999' },
    ]);
    expect(kept).toEqual([{ title: 'Keep Me', infoHash: 'zzz999' }]);
    expect(blockedCount).toBe(1);
  });

  it('scopes grab_fail entries to the failing indexer — same title elsewhere survives', async () => {
    getBlocklistForRequestMock.mockResolvedValueOnce([
      { releaseKey: 'heart bones epub', releaseHash: null, source: 'grab_fail', indexerId: 10 },
    ]);
    const { filterBlockedResults } = await import('@/lib/utils/filter-blocked-results');
    const { kept, blockedCount } = await filterBlockedResults('req-1', [
      { title: 'Heart Bones EPUB', indexerId: 10 }, // failing indexer — blocked
      { title: 'Heart Bones EPUB', indexerId: 20 }, // identical title, other indexer — kept
    ]);
    expect(kept).toEqual([{ title: 'Heart Bones EPUB', indexerId: 20 }]);
    expect(blockedCount).toBe(1);
  });

  it('scopes grab_fail hash matches to the failing indexer', async () => {
    getBlocklistForRequestMock.mockResolvedValueOnce([
      { releaseKey: 'other name', releaseHash: 'abc123', source: 'grab_fail', indexerId: 10 },
    ]);
    const { filterBlockedResults } = await import('@/lib/utils/filter-blocked-results');
    const { kept, blockedCount } = await filterBlockedResults('req-1', [
      { title: 'Cross Seed A', infoHash: 'abc123', indexerId: 10 }, // blocked
      { title: 'Cross Seed B', infoHash: 'abc123', indexerId: 20 }, // same hash, other indexer — kept
    ]);
    expect(kept).toEqual([{ title: 'Cross Seed B', infoHash: 'abc123', indexerId: 20 }]);
    expect(blockedCount).toBe(1);
  });

  it('treats grab_fail entries without an indexerId as global blocks', async () => {
    getBlocklistForRequestMock.mockResolvedValueOnce([
      { releaseKey: 'heart bones epub', releaseHash: null, source: 'grab_fail', indexerId: null },
    ]);
    const { filterBlockedResults } = await import('@/lib/utils/filter-blocked-results');
    const { kept, blockedCount } = await filterBlockedResults('req-1', [
      { title: 'Heart Bones EPUB', indexerId: 20 },
    ]);
    expect(kept).toEqual([]);
    expect(blockedCount).toBe(1);
  });

  it('download_fail entries with an indexerId still block globally', async () => {
    getBlocklistForRequestMock.mockResolvedValueOnce([
      { releaseKey: 'bad release', releaseHash: null, source: 'download_fail', indexerId: 10 },
    ]);
    const { filterBlockedResults } = await import('@/lib/utils/filter-blocked-results');
    const { kept, blockedCount } = await filterBlockedResults('req-1', [
      { title: 'Bad Release', indexerId: 20 }, // different indexer, still blocked
    ]);
    expect(kept).toEqual([]);
    expect(blockedCount).toBe(1);
  });

  it('does not filter by hash when the result has no infoHash', async () => {
    getBlocklistForRequestMock.mockResolvedValueOnce([
      { releaseKey: 'unrelated', releaseHash: 'abc123' },
    ]);
    const { filterBlockedResults } = await import('@/lib/utils/filter-blocked-results');
    const results = [{ title: 'No Hash Result' }];
    const { kept, blockedCount } = await filterBlockedResults('req-1', results);
    expect(kept).toEqual(results);
    expect(blockedCount).toBe(0);
  });
});
