/**
 * Component: Search Title Utilities
 * Documentation: documentation/phase3/prowlarr.md
 */

const PROMOTIONAL_SUFFIX_PATTERNS = [
  /\bbook\s+club\s+pick\b/i,
  /\bgma\s+book\s+club\b/i,
  /\boprah'?s\s+book\s+club\b/i,
  /\breese'?s\s+book\s+club\b/i,
  /\bnyt\s+bestseller\b/i,
  /\bnew\s+york\s+times\s+bestseller\b/i,
  /\binternational\s+bestseller\b/i,
  /\bnational\s+bestseller\b/i,
  /\bbestselling\s+author\b/i,
];

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function hasPromotionalSuffix(value: string): boolean {
  return PROMOTIONAL_SUFFIX_PATTERNS.some((pattern) => pattern.test(value));
}

export function cleanIndexerSearchTitle(title: string): string {
  const normalized = normalizeSpaces(title);

  if (!normalized) {
    return title;
  }

  const subtitleMatch = normalized.match(/^(.+?)\s*:\s*(.+)$/);
  if (!subtitleMatch) {
    return normalized;
  }

  const [, primaryTitle, suffix] = subtitleMatch;

  if (!hasPromotionalSuffix(suffix)) {
    return normalized;
  }

  return normalizeSpaces(primaryTitle) || normalized;
}
