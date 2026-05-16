/**
 * Component: Title Tag Extraction Utility
 * Documentation: documentation/frontend/components.md
 *
 * Pure parser used by the Interactive Search modal to split a result title
 * into a "residual" string and a list of bracketed metadata tags. Brackets
 * are ASCII `[`/`]` only (full-width `【】` is intentionally unsupported —
 * Audible/indexer titles use ASCII in practice). Inner content is split on
 * `/`, trimmed, empty segments dropped, then de-duplicated case-insensitively
 * while preserving first-seen casing. The regex is non-nested by design:
 * `Foundation [Edition [Deluxe]]` extracts `Deluxe` and leaves the outer
 * `[Edition ]` in the residual. Accepted trade-off for v1 (rare).
 */
export interface TitleTags {
  residual: string;
  tags: string[];
}

// Why: character class excludes brackets so the regex never spans a nested
// pair — this is what makes the inner `[Deluxe]` win over the outer group.
const BRACKET_GROUP = /\[([^\[\]]*)\]/g;

export function extractTitleTags(title: string): TitleTags {
  if (!title) return { residual: '', tags: [] };

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const match of title.matchAll(BRACKET_GROUP)) {
    for (const segment of match[1].split('/')) {
      const trimmed = segment.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(trimmed);
    }
  }

  const residual = title.replace(BRACKET_GROUP, ' ').replace(/\s+/g, ' ').trim();
  return { residual, tags };
}
