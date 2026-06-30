/**
 * Component: Ebook Status API Route
 * Documentation: documentation/integrations/ebook-sidecar.md
 *
 * Returns ebook availability status for a specific audiobook
 * Used by AudiobookDetailsModal to determine if ebook buttons should be shown
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { RMABLogger } from '@/lib/utils/logger';
import { findBookOrbitMatch } from '@/lib/utils/audiobook-matcher';

const logger = RMABLogger.create('API.Audiobooks.EbookStatus');

// Statuses that indicate an active/in-progress ebook request
const ACTIVE_EBOOK_STATUSES = [
  'pending',
  'awaiting_approval',
  'searching',
  'downloading',
  'processing',
  'downloaded',
  'available',
];

/**
 * GET /api/audiobooks/[asin]/ebook-status
 * Returns format-aware availability and whether an active ebook request exists.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ asin: string }> }
) {
  return requireAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { asin } = await params;

      if (!asin || asin.length !== 10) {
        return NextResponse.json(
          { error: 'Valid ASIN is required' },
          { status: 400 }
        );
      }

      // Check which ebook sources are enabled
      const [annasArchiveConfig, indexerSearchConfig, legacyConfig] = await Promise.all([
        prisma.configuration.findUnique({ where: { key: 'ebook_annas_archive_enabled' } }),
        prisma.configuration.findUnique({ where: { key: 'ebook_indexer_search_enabled' } }),
        prisma.configuration.findUnique({ where: { key: 'ebook_sidecar_enabled' } }),
      ]);

      // Legacy migration: check old key if new keys don't exist
      const isAnnasArchiveEnabled = annasArchiveConfig?.value === 'true' ||
        (annasArchiveConfig === null && legacyConfig?.value === 'true');
      const isIndexerSearchEnabled = indexerSearchConfig?.value === 'true';
      const ebookSourcesEnabled = isAnnasArchiveEnabled || isIndexerSearchEnabled;

      // Find the audiobook by ASIN
      const audiobook = await prisma.audiobook.findFirst({
        where: { audibleAsin: asin },
        select: { id: true, title: true, author: true, narrator: true },
      });

      const cachedAudiobook = audiobook ? null : await prisma.audibleCache.findUnique({
        where: { asin },
        select: { title: true, author: true, narrator: true },
      });

      if (!audiobook) {
        const [audioLibraryMatch, bookOrbitMatch] = await Promise.all([
          prisma.plexLibrary.findFirst({
            where: {
              plexLibraryId: { not: 'bookorbit' },
              OR: [
                { asin },
                { plexGuid: { contains: asin } },
              ],
            },
            select: { plexGuid: true },
          }),
          cachedAudiobook
            ? findBookOrbitMatch({
                asin,
                title: cachedAudiobook.title,
                author: cachedAudiobook.author,
                narrator: cachedAudiobook.narrator || undefined,
              })
            : prisma.plexLibrary.findFirst({
                where: {
                  plexLibraryId: 'bookorbit',
                  OR: [
                    { asin },
                    { plexGuid: { contains: asin } },
                  ],
                },
                select: {
                  plexGuid: true,
                  plexRatingKey: true,
                  title: true,
                  author: true,
                },
              }),
        ]);

        return NextResponse.json({
          ebookSourcesEnabled,
          hasActiveEbookRequest: false,
          existingEbookStatus: null,
          existingEbookRequestId: null,
          ebookAvailable: !!bookOrbitMatch,
          audiobookAvailable: !!audioLibraryMatch,
          hasActiveAudiobookRequest: false,
          existingAudiobookStatus: null,
        });
      }

      const [
        existingEbookRequest,
        existingAudiobookRequest,
        audioLibraryMatch,
        bookOrbitMatch,
      ] = await Promise.all([
        // Check for any active ebook request for this audiobook
        prisma.request.findFirst({
          where: {
            audiobookId: audiobook.id,
            type: 'ebook',
            deletedAt: null,
            status: { in: ACTIVE_EBOOK_STATUSES },
          },
          select: {
            id: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.request.findFirst({
          where: {
            audiobookId: audiobook.id,
            type: 'audiobook',
            deletedAt: null,
            status: { in: ACTIVE_EBOOK_STATUSES },
          },
          select: {
            id: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.plexLibrary.findFirst({
          where: {
            plexLibraryId: { not: 'bookorbit' },
            OR: [
              { asin },
              { plexGuid: { contains: asin } },
            ],
          },
          select: { plexGuid: true },
        }),
        findBookOrbitMatch({
          asin,
          title: audiobook.title,
          author: audiobook.author,
          narrator: audiobook.narrator || undefined,
        }),
      ]);

      const ebookAvailable = !!bookOrbitMatch ||
        existingEbookRequest?.status === 'available' ||
        existingEbookRequest?.status === 'downloaded';
      const audiobookAvailable = !!audioLibraryMatch ||
        existingAudiobookRequest?.status === 'available' ||
        existingAudiobookRequest?.status === 'downloaded';

      return NextResponse.json({
        ebookSourcesEnabled,
        hasActiveEbookRequest: !!existingEbookRequest,
        existingEbookStatus: existingEbookRequest?.status || null,
        existingEbookRequestId: existingEbookRequest?.id || null,
        ebookAvailable,
        audiobookAvailable,
        hasActiveAudiobookRequest: !!existingAudiobookRequest,
        existingAudiobookStatus: existingAudiobookRequest?.status || null,
      });

    } catch (error) {
      logger.error('Failed to get ebook status', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: 'Failed to fetch ebook status' },
        { status: 500 }
      );
    }
  });
}
