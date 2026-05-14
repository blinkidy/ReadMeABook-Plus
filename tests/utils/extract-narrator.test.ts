/**
 * Component: Narrator Extraction Utility Tests
 * Documentation: documentation/integrations/audible.md
 */

import { describe, expect, it } from 'vitest';
import * as cheerio from 'cheerio';
import { extractAllNarrators } from '@/lib/utils/extract-narrator';

function load(html: string) {
  const $ = cheerio.load(`<div id="item">${html}</div>`);
  return { $, $el: $('#item') };
}

describe('extractAllNarrators', () => {
  it('returns the single narrator name when only one searchNarrator link is present', () => {
    const { $, $el } = load(
      `<a href="/search?searchNarrator=Andy%20Serkis">Andy Serkis</a>`,
    );
    expect(extractAllNarrators($, $el)).toBe('Andy Serkis');
  });

  it('joins multiple narrator names from separate searchNarrator links', () => {
    const { $, $el } = load(`
      <a href="/search?searchNarrator=Kristin%20Atherton">Kristin Atherton</a>,
      <a href="/search?searchNarrator=Roy%20McMillan">Roy McMillan</a>,
      <a href="/search?searchNarrator=Clare%20Corbett">Clare Corbett</a>,
      <a href="/search?searchNarrator=Tom%20Bateman">Tom Bateman</a>,
      <a href="/search?searchNarrator=Patience%20Tomlinson">Patience Tomlinson</a>,
      <a href="/search?searchNarrator=Shaheen%20Khan">Shaheen Khan</a>
    `);
    expect(extractAllNarrators($, $el)).toBe(
      'Kristin Atherton, Roy McMillan, Clare Corbett, Tom Bateman, Patience Tomlinson, Shaheen Khan',
    );
  });

  it('preserves document order (downstream sorts before comparing, but order should be stable)', () => {
    const { $, $el } = load(`
      <a href="/search?searchNarrator=Z">Zelda</a>
      <a href="/search?searchNarrator=A">Alice</a>
      <a href="/search?searchNarrator=M">Mallory</a>
    `);
    expect(extractAllNarrators($, $el)).toBe('Zelda, Alice, Mallory');
  });

  it('falls back to .narratorLabel text when no searchNarrator links exist', () => {
    const { $, $el } = load(
      `<span class="narratorLabel">Narrated by: Single Narrator</span>`,
    );
    expect(extractAllNarrators($, $el)).toBe('Narrated by: Single Narrator');
  });

  it('prefers searchNarrator links over .narratorLabel when both are present', () => {
    const { $, $el } = load(`
      <span class="narratorLabel">Narrated by: ONLY ONE</span>
      <a href="/search?searchNarrator=First">First</a>
      <a href="/search?searchNarrator=Second">Second</a>
    `);
    expect(extractAllNarrators($, $el)).toBe('First, Second');
  });

  it('returns empty string when neither links nor .narratorLabel exist', () => {
    const { $, $el } = load(`<span>some other content</span>`);
    expect(extractAllNarrators($, $el)).toBe('');
  });

  it('skips empty link text and joins only non-empty names', () => {
    const { $, $el } = load(`
      <a href="/search?searchNarrator=A"></a>
      <a href="/search?searchNarrator=B">Bob</a>
      <a href="/search?searchNarrator=C">  </a>
      <a href="/search?searchNarrator=D">Diana</a>
    `);
    expect(extractAllNarrators($, $el)).toBe('Bob, Diana');
  });

  it('trims whitespace from each captured name', () => {
    const { $, $el } = load(`
      <a href="/search?searchNarrator=A">  Alice  </a>
      <a href="/search?searchNarrator=B">
        Bob
      </a>
    `);
    expect(extractAllNarrators($, $el)).toBe('Alice, Bob');
  });

  it('falls back to .narratorLabel when all searchNarrator links are empty', () => {
    const { $, $el } = load(`
      <a href="/search?searchNarrator=A"></a>
      <a href="/search?searchNarrator=B">   </a>
      <span class="narratorLabel">Fallback Narrator</span>
    `);
    expect(extractAllNarrators($, $el)).toBe('Fallback Narrator');
  });
});
