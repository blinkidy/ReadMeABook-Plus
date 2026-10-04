/**
 * Component: Admin Indexer Options Settings API
 * Documentation: documentation/settings-pages.md
 *
 * Manages indexer-wide behavioral options that are not tied to a specific
 * indexer connection (e.g., auto-search behavior toggles).
 *
 * Read contract (consumed by background auto-search workers):
 *   - Config key: `indexer.skip_unreleased`
 *   - Category:   `indexer`
 *   - Value:      string `'true'` | `'false'`
 *   - Default:    ON when the key is missing OR its value is anything other
 *                 than the exact string `'false'`. In other words, skipping
 *                 unreleased books is enabled unless the admin explicitly
 *                 opted out. Workers MUST match this contract:
 *
 *                   const skip = (await config.get('indexer.skip_unreleased')) !== 'false';
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '@/lib/middleware/auth';
import { getConfigService } from '@/lib/services/config.service';
import { RMABLogger } from '@/lib/utils/logger';
import { AUDIO_CODEC_PENALTY_KEY, parseAudioCodecPenalty } from '@/lib/utils/audio-codec';

const logger = RMABLogger.create('API.Admin.Settings.IndexerOptions');

const CONFIG_KEY = 'indexer.skip_unreleased';

/**
 * GET /api/admin/settings/indexer-options
 * Returns the current indexer-wide options.
 */
export async function GET(request: NextRequest) {
  return requireAuth(request, async (req: AuthenticatedRequest) => {
    return requireAdmin(req, async () => {
      try {
        const configService = getConfigService();
        const value = await configService.get(CONFIG_KEY);

        // Default ON: missing or any value other than 'false' is treated as enabled.
        const skipUnreleased = value !== 'false';

        const xheAacPenalty = parseAudioCodecPenalty(await configService.get(AUDIO_CODEC_PENALTY_KEY));
        return NextResponse.json({ skipUnreleased, xheAacPenalty });
      } catch (error) {
        logger.error('Failed to fetch indexer options', {
          error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
          { error: 'Failed to fetch indexer options' },
          { status: 500 }
        );
      }
    });
  });
}

/**
 * PUT /api/admin/settings/indexer-options
 * Persists indexer-wide options. Body: { skipUnreleased: boolean }
 */
export async function PUT(request: NextRequest) {
  return requireAuth(request, async (req: AuthenticatedRequest) => {
    return requireAdmin(req, async () => {
      try {
        const body = await request.json();
        const { skipUnreleased } = body ?? {};
        const xheAacPenalty = body?.xheAacPenalty;
        if (xheAacPenalty !== undefined && (
          typeof xheAacPenalty !== 'number' || !Number.isFinite(xheAacPenalty)
          || xheAacPenalty < 0 || xheAacPenalty > 100
        )) {
          return NextResponse.json({ error: 'xheAacPenalty must be a number from 0 to 100' }, { status: 400 });
        }

        if (typeof skipUnreleased !== 'boolean') {
          return NextResponse.json(
            { error: 'skipUnreleased must be a boolean' },
            { status: 400 }
          );
        }

        const configService = getConfigService();
        const updates = [
          {
            key: CONFIG_KEY,
            value: String(skipUnreleased),
            category: 'indexer',
            description:
              'Skip auto-searches for books with future release dates',
          },
        ];
        if (xheAacPenalty !== undefined) {
          updates.push({
            key: AUDIO_CODEC_PENALTY_KEY,
            value: String(xheAacPenalty),
            category: 'indexer',
            description: 'Audiobook xHE-AAC / USAC score penalty percentage',
          });
        }
        await configService.setMany(updates);
        configService.clearCache(AUDIO_CODEC_PENALTY_KEY);

        // Explicitly clear cache for the key after write. `setMany` already
        // does this, but we make it visible here to guarantee fresh reads
        // by any sibling service that has cached the value.
        configService.clearCache(CONFIG_KEY);

        logger.info('Indexer options updated', { skipUnreleased });

        return NextResponse.json({
          success: true,
          message: 'Indexer options updated successfully',
        });
      } catch (error) {
        logger.error('Failed to update indexer options', {
          error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to update indexer options',
          },
          { status: 500 }
        );
      }
    });
  });
}
