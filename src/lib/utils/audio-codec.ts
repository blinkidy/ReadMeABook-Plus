/**
 * Component: Audiobook Codec Preferences
 * Documentation: documentation/phase3/ranking-algorithm.md
 */

export const AUDIO_CODEC_PENALTY_KEY = 'indexer.xhe_aac_penalty';
export const DEFAULT_AUDIO_CODEC_PENALTY = 100;

export function parseAudioCodecPenalty(value: string | null | undefined): number {
  if (!value || !value.trim()) return DEFAULT_AUDIO_CODEC_PENALTY;
  const penalty = Number(value);
  return Number.isFinite(penalty) && penalty >= 0 && penalty <= 100
    ? penalty
    : DEFAULT_AUDIO_CODEC_PENALTY;
}

/** Match explicit codec labels, including punctuation-separated release names. */
export function hasXheAacMarker(title: string): boolean {
  return /(?:^|[^a-z0-9])(?:xhe[\s._-]*aac|usac)(?=$|[^a-z0-9])/i.test(title);
}
