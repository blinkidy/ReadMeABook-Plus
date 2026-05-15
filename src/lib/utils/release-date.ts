/**
 * Component: Release Date Utilities
 * Documentation: documentation/backend/database.md
 *
 * Pure helpers for reasoning about a book's release date relative to "today".
 * Date-only comparison in UTC — no local-timezone arithmetic and no string slicing.
 */

/**
 * Returns true when the given release date is strictly after today (UTC date-only).
 * Null, undefined, empty, or malformed input returns false (safe fallback).
 */
export function isUnreleased(
  releaseDate: Date | string | null | undefined
): boolean {
  if (releaseDate === null || releaseDate === undefined || releaseDate === '') {
    return false;
  }

  try {
    const date = releaseDate instanceof Date ? releaseDate : new Date(releaseDate);
    if (isNaN(date.getTime())) {
      return false;
    }

    const now = new Date();
    const releaseY = date.getUTCFullYear();
    const releaseM = date.getUTCMonth();
    const releaseD = date.getUTCDate();
    const nowY = now.getUTCFullYear();
    const nowM = now.getUTCMonth();
    const nowD = now.getUTCDate();

    if (releaseY !== nowY) return releaseY > nowY;
    if (releaseM !== nowM) return releaseM > nowM;
    return releaseD > nowD;
  } catch {
    return false;
  }
}

/**
 * Decides whether auto-search should be skipped because the book is unreleased.
 * Short-circuits when the admin toggle is off.
 */
export function shouldSkipAutoSearch(
  request: { releaseDate?: Date | string | null },
  settingOn: boolean
): { skip: boolean; reason?: 'unreleased' } {
  if (!settingOn) return { skip: false };
  if (isUnreleased(request.releaseDate)) {
    return { skip: true, reason: 'unreleased' };
  }
  return { skip: false };
}
