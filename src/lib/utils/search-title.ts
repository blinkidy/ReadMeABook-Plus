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

const PROMOTIONAL_TAIL_PATTERNS = [
  /\s*(?:[-:]\s*)?(?:a|an|the)?\s*gma\s+book\s+club\s+pick\s*$/i,
  /\s*(?:[-:]\s*)?(?:a|an|the)?\s*book\s+club\s+pick\s*$/i,
  /\s*(?:[-:]\s*)?(?:a|an|the)?\s*oprah'?s\s+book\s+club\s*$/i,
  /\s*(?:[-:]\s*)?(?:a|an|the)?\s*reese'?s\s+book\s+club\s*$/i,
  /\s*(?:[-:]\s*)?(?:a|an|the)?\s*nyt\s+bestseller\s*$/i,
  /\s*(?:[-:]\s*)?(?:a|an|the)?\s*new\s+york\s+times\s+bestseller\s*$/i,
  /\s*(?:[-:]\s*)?(?:a|an|the)?\s*international\s+bestseller\s*$/i,
  /\s*(?:[-:]\s*)?(?:a|an|the)?\s*national\s+bestseller\s*$/i,
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
    for (const pattern of PROMOTIONAL_TAIL_PATTERNS) {
      const cleaned = normalizeSpaces(normalized.replace(pattern, ''));
      if (cleaned && cleaned !== normalized) {
        return cleaned;
      }
    }
    return normalized;
  }

  const [, primaryTitle, suffix] = subtitleMatch;

  if (!hasPromotionalSuffix(suffix)) {
    return normalized;
  }

  return normalizeSpaces(primaryTitle) || normalized;
}
