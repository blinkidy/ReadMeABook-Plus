/**
 * Component: BookDate Library API
 * Documentation: documentation/features/bookdate.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { getConfigService } from '@/lib/services/config.service';
import { RMABLogger } from '@/lib/utils/logger';

const logger = RMABLogger.create('API.BookDate.Library');

const BOOKORBIT_LIBRARY_ID = 'bookorbit';

/**
 * GET /api/bookdate/library
 * Get user's full library for book picker modal
 * Returns: id, title, author, coverUrl (thumbnail)
 */
async function getLibraryBooks(req: AuthenticatedRequest) {
  try {
    const userId = req.user!.id;

    // Get library ID based on backend mode
    const configService = getConfigService();
    const backendMode = await configService.getBackendMode();

    let libraryId: string;
    if (backendMode === 'audiobookshelf') {
      const absLibraryId = await configService.get('audiobookshelf.library_id');
      if (!absLibraryId) {
        return NextResponse.json(
          { error: 'No Audiobookshelf library ID configured' },
          { status: 400 }
        );
      }
      libraryId = absLibraryId;
    } else {
      // Plex mode
      const plexConfig = await configService.getPlexConfig();
      if (!plexConfig.libraryId) {
        return NextResponse.json(
          { error: 'No Plex library ID configured' },
          { status: 400 }
        );
      }
      libraryId = plexConfig.libraryId;
    }

    const libraryIds = [libraryId, BOOKORBIT_LIBRARY_ID];

    // Fetch ALL books from the audiobook library and BookOrbit ebook library (no limit - client handles pagination/infinite scroll)
    // Join with AudibleCache to get cached cover images
    const books = await prisma.plexLibrary.findMany({
      where: { plexLibraryId: { in: libraryIds } },
      select: {
        id: true,
        title: true,
        author: true,
        asin: true, // For joining with AudibleCache
        cachedLibraryCoverPath: true, // For library cached covers
        plexLibraryId: true,
      },
      orderBy: { addedAt: 'desc' },
    });

    logger.info(`Fetched ${books.length} books from audiobook and BookOrbit libraries for user ${userId}`);

    // Get ASINs for books that have them
    const asins = books.map(b => b.asin).filter((asin): asin is string => !!asin);

    // Fetch cached covers from AudibleCache (only for books with ASINs)
    const cachedCovers = await prisma.audibleCache.findMany({
      where: {
        asin: { in: asins },
      },
      select: {
        asin: true,
        coverArtUrl: true,
      },
    });

    // Create ASIN -> coverUrl map
    const coverMap = new Map<string, string>();
    cachedCovers.forEach(cache => {
      if (cache.coverArtUrl) {
        coverMap.set(cache.asin, cache.coverArtUrl);
      }
    });

    logger.info(`Found ${coverMap.size} cached covers out of ${asins.length} books with ASINs`);

    // Map books with their covers (priority: library cache > Audible cache > null)
    return NextResponse.json({
      books: books.map(book => {
        let coverUrl: string | null = null;

        // Priority 1: Library cached cover (most books should have this)
        if (book.cachedLibraryCoverPath) {
          const filename = book.cachedLibraryCoverPath.split('/').pop();
          coverUrl = `/api/cache/library/${filename}`;
        }
        // Priority 2: Audible cache (fallback for books with ASIN but no library cache)
        else if (book.asin && coverMap.has(book.asin)) {
          coverUrl = coverMap.get(book.asin)!;
        }
        // Priority 3: null (show placeholder)

        return {
          id: book.id,
          title: book.title,
          author: book.author,
          coverUrl,
          source: book.plexLibraryId === BOOKORBIT_LIBRARY_ID ? 'bookorbit' : 'audiobook',
        };
      }),
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch library books';
    logger.error('Get library books error', { error: message });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return requireAuth(req, getLibraryBooks);
}
