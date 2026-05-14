/**
 * Component: Narrator Extraction Utility
 * Documentation: documentation/integrations/audible.md
 *
 * Shared helper for Audible HTML scrapers. Audible product listings render
 * each narrator as a separate `<a href="?searchNarrator=...">` link; using
 * `.first()` on that selector silently drops co-narrators and breaks dedup
 * for multi-narrator productions (e.g. full-cast audiobooks). This helper
 * captures every narrator link and joins them, falling back to the
 * `.narratorLabel` span when no anchor links are present.
 */

import type * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

/**
 * Extract a comma-joined narrator string from an Audible product list item.
 *
 * Order is not semantically significant — downstream `normalizeNarrator()`
 * sorts before comparison — but document-order preserves a stable, legible
 * value for caching and logging.
 */
export function extractAllNarrators(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<AnyNode>,
): string {
  const links = $el.find('a[href*="searchNarrator="]');
  if (links.length > 0) {
    const names: string[] = [];
    links.each((_, link) => {
      const name = $(link).text().trim();
      if (name) names.push(name);
    });
    if (names.length > 0) return names.join(', ');
  }
  return $el.find('.narratorLabel').text().trim();
}
