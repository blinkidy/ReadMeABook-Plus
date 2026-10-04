import { describe, expect, it } from 'vitest';
import { hasXheAacMarker, parseAudioCodecPenalty } from '@/lib/utils/audio-codec';
import { rankTorrents, rankEbookTorrents, type TorrentResult } from '@/lib/utils/ranking-algorithm';

const release: TorrentResult = {
  title: 'Craig Alanson - Paradise [M4B]',
  indexer: 'Test', indexerId: 1, size: 500 * 1024 * 1024,
  publishDate: new Date('2026-01-01'), downloadUrl: 'http://example.test/download', guid: 'test',
};
const book = { title: 'Paradise', author: 'Craig Alanson', durationMinutes: 300 };

describe('audiobook codec preferences', () => {
  it.each(['USAC', 'usac', 'xHE-AAC', 'XHE AAC', 'xhe_aac', 'xHE.AAC'])('detects explicit %s labels', marker => {
    expect(hasXheAacMarker(`Paradise [CBR 95k 44.1kHz ${marker}]`)).toBe(true);
  });
  it.each(['AAC-LC', 'HE-AAC', 'CBR 95k 44.1kHz', 'Musac', 'USACA', 'MP3'])('does not penalize %s alone', marker => {
    expect(hasXheAacMarker(`Paradise [${marker}]`)).toBe(false);
  });
  it('defaults safely and accepts a disabled penalty', () => {
    expect(parseAudioCodecPenalty(null)).toBe(100);
    expect(parseAudioCodecPenalty('invalid')).toBe(100);
    expect(parseAudioCodecPenalty('101')).toBe(100);
    expect(parseAudioCodecPenalty('0')).toBe(0);
    expect(parseAudioCodecPenalty('60')).toBe(60);
  });
  it('penalizes both aliases once, even with maximum priority and positive flags', () => {
    const [result] = rankTorrents([{ ...release, title: `${release.title} USAC (Codec: xHE-AAC)`, flags: ['Freeleech'] }], book, {
      indexerPriorities: new Map([[1, 25]]), flagConfigs: [{ name: 'Freeleech', modifier: 100 }],
    });
    expect(result.finalScore).toBeCloseTo(0);
    expect(result.bonusModifiers.filter(mod => mod.type === 'custom')).toHaveLength(1);
    expect(result.score).toBeGreaterThan(50);
  });
  it('supports a partial penalty and disabling it while preserving ordinary releases', () => {
    const unwanted = { ...release, title: `${release.title} [USAC]` };
    const [disabled] = rankTorrents([unwanted], book, { xheAacPenalty: 0 });
    const [partial] = rankTorrents([unwanted], book, { xheAacPenalty: 60 });
    expect(partial.finalScore).toBeCloseTo(disabled.finalScore * 0.4);
    const results = rankTorrents([unwanted, release], book, { requireAuthor: false });
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe(release.title);
    expect(results[0].bonusModifiers.some(mod => mod.type === 'custom')).toBe(false);
  });
  it('does not apply audio codec penalties to ebooks', () => {
    const [result] = rankEbookTorrents([{ ...release, title: 'Craig Alanson - Paradise USAC EPUB', size: 1024 * 1024 }], { ...book, preferredFormat: 'epub' });
    expect(result.bonusModifiers.some(mod => mod.type === 'custom')).toBe(false);
  });
});
