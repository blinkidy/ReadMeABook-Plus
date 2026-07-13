/**
 * Component: Blocked Results Filter
 * Documentation: documentation/backend/database.md
 *
 * Pre-rank filter applied by every automatic search path (audiobook, ebook, RSS)
 * to remove releases already on a request's blocklist. Matches case-insensitive
 * on release name and exact on hash (when both sides have one).
 *
 * `grab_fail` entries (indexer failed to serve the download) are scoped to the
 * indexer that failed: ebook releases from different indexers often share an
 * identical title (and cross-seeds share a hash), and the same release is
 * usually still downloadable from another indexer. All other sources block
 * globally — a bad release (par2 failure, no audiobook files) is bad wherever
 * it's cross-posted.
 *
 * Interactive admin search does NOT call this — admins see all results and the
 * UI surfaces a blocked badge instead.
 */

import { getBlocklistForRequest } from '@/lib/services/blocklist.service';
import { normalizeReleaseKey } from '@/lib/utils/release-key';

export interface FilterableResult {
  title: string;
  infoHash?: string;
  indexerId?: number;
}

export interface FilterBlockedResultsOutput<T> {
  kept: T[];
  blockedCount: number;
}

/**
 * Filter out search results that match a row on the request's blocklist.
 *
 * Match rules:
 * - Name: case-insensitive exact via [[normalize-release-key]].
 * - Hash: exact, only when both the result and a blocklist row have one.
 * - `grab_fail` rows with an indexerId only match results from that indexer;
 *   grab_fail rows without one fall back to global matching.
 *
 * Returns the original array unchanged when there are no results or no
 * blocklist rows — both are common hot-path cases, so we short-circuit.
 */
export async function filterBlockedResults<T extends FilterableResult>(
  requestId: string,
  results: T[]
): Promise<FilterBlockedResultsOutput<T>> {
  if (results.length === 0) {
    return { kept: results, blockedCount: 0 };
  }

  const blocklist = await getBlocklistForRequest(requestId);
  if (blocklist.length === 0) {
    return { kept: results, blockedCount: 0 };
  }

  const isIndexerScoped = (b: { source: string; indexerId: number | null }) =>
    b.source === 'grab_fail' && b.indexerId != null;

  const globalKeys = new Set(
    blocklist.filter(b => !isIndexerScoped(b)).map(b => b.releaseKey)
  );
  const scopedKeys = new Set(
    blocklist.filter(isIndexerScoped).map(b => `${b.indexerId}:${b.releaseKey}`)
  );
  const globalHashes = new Set(
    blocklist
      .filter(b => b.releaseHash && !isIndexerScoped(b))
      .map(b => b.releaseHash as string)
  );
  const scopedHashes = new Set(
    blocklist
      .filter(b => b.releaseHash && isIndexerScoped(b))
      .map(b => `${b.indexerId}:${b.releaseHash}`)
  );

  const kept = results.filter(r => {
    const key = normalizeReleaseKey(r.title);
    if (globalKeys.has(key)) return false;
    if (r.infoHash && globalHashes.has(r.infoHash)) return false;
    if (r.indexerId != null) {
      if (scopedKeys.has(`${r.indexerId}:${key}`)) return false;
      if (r.infoHash && scopedHashes.has(`${r.indexerId}:${r.infoHash}`)) return false;
    }
    return true;
  });

  return { kept, blockedCount: results.length - kept.length };
}
