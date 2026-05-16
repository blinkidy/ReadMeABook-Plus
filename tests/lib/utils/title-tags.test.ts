/**
 * Tests for extractTitleTags — one case per row of the Edge Cases table
 * in .zach-flow/engineering-brief.md.
 */

import { describe, it, expect } from 'vitest';
import { extractTitleTags } from '@/lib/utils/title-tags';

describe('extractTitleTags', () => {
  it('returns the original title and no tags when there are no brackets', () => {
    expect(extractTitleTags('Foundation')).toEqual({ residual: 'Foundation', tags: [] });
  });

  it('extracts a single bracketed tag', () => {
    expect(extractTitleTags('Foundation [German]')).toEqual({
      residual: 'Foundation',
      tags: ['German'],
    });
  });

  it('splits a single bracket group on slash', () => {
    expect(extractTitleTags('Foundation [German / Unabridged]')).toEqual({
      residual: 'Foundation',
      tags: ['German', 'Unabridged'],
    });
  });

  it('extracts multiple bracket groups in order', () => {
    expect(extractTitleTags('Foundation [German] [Unabridged]')).toEqual({
      residual: 'Foundation',
      tags: ['German', 'Unabridged'],
    });
  });

  it('collapses inner whitespace and trailing text after stripped brackets', () => {
    expect(extractTitleTags('Foundation [German]  [Unabridged]  v2')).toEqual({
      residual: 'Foundation v2',
      tags: ['German', 'Unabridged'],
    });
  });

  it('handles a leading bracket group', () => {
    expect(extractTitleTags('[Audible] Foundation')).toEqual({
      residual: 'Foundation',
      tags: ['Audible'],
    });
  });

  it('leaves a malformed unclosed bracket in the residual and returns no tags', () => {
    expect(extractTitleTags('Foundation [unclosed')).toEqual({
      residual: 'Foundation [unclosed',
      tags: [],
    });
  });

  it('treats an empty bracket group as no tags', () => {
    expect(extractTitleTags('Foundation []')).toEqual({
      residual: 'Foundation',
      tags: [],
    });
  });

  it('treats a bracket group of only separators as no tags', () => {
    expect(extractTitleTags('Foundation [ / / ]')).toEqual({
      residual: 'Foundation',
      tags: [],
    });
  });

  it('splits a bracket group with multiple slash-separated values', () => {
    expect(extractTitleTags('Foundation [a/b/c]')).toEqual({
      residual: 'Foundation',
      tags: ['a', 'b', 'c'],
    });
  });

  it('extracts the inner tag from a nested bracket group and accepts the partial residual', () => {
    expect(extractTitleTags('Foundation [Edition [Deluxe]]')).toEqual({
      residual: 'Foundation [Edition ]',
      tags: ['Deluxe'],
    });
  });

  it('de-duplicates tags case-insensitively, preserving first-seen casing', () => {
    expect(extractTitleTags('Foundation [German] [german]')).toEqual({
      residual: 'Foundation',
      tags: ['German'],
    });
  });

  it('trims surrounding whitespace from the title', () => {
    expect(extractTitleTags('   Foundation   [German]   ')).toEqual({
      residual: 'Foundation',
      tags: ['German'],
    });
  });

  it('handles 200+ char titles', () => {
    const longBody = 'A'.repeat(220);
    const result = extractTitleTags(`${longBody} [German]`);
    expect(result.tags).toEqual(['German']);
    expect(result.residual).toBe(longBody);
  });

  it('returns empty values for an empty string', () => {
    expect(extractTitleTags('')).toEqual({ residual: '', tags: [] });
  });

  it('returns empty values for a whitespace-only string', () => {
    expect(extractTitleTags('   ')).toEqual({ residual: '', tags: [] });
  });
});
