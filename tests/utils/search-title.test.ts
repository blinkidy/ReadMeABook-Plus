/**
 * Component: Search Title Utilities Tests
 * Documentation: documentation/phase3/prowlarr.md
 */

import { describe, expect, it } from 'vitest';
import { cleanIndexerSearchTitle } from '@/lib/utils/search-title';

describe('cleanIndexerSearchTitle', () => {
  it('removes promotional book club suffixes after a colon', () => {
    expect(cleanIndexerSearchTitle('Yesteryear: A GMA Book Club Pick')).toBe('Yesteryear');
  });

  it('removes promotional book club suffixes after punctuation is stripped', () => {
    expect(cleanIndexerSearchTitle('Yesteryear A GMA Book Club Pick')).toBe('Yesteryear');
  });

  it('preserves normal subtitles', () => {
    expect(cleanIndexerSearchTitle('The Hobbit: There and Back Again')).toBe('The Hobbit: There and Back Again');
  });

  it('normalizes extra whitespace', () => {
    expect(cleanIndexerSearchTitle('  Yesteryear:   A GMA Book Club Pick  ')).toBe('Yesteryear');
  });
});
