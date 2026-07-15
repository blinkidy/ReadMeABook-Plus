/**
 * Component: Audiobook Details API Route
 * Documentation: documentation/integrations/audible.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAudibleService } from '@/lib/integrations/audible.service';
import { RMABLogger } from '@/lib/utils/logger';
import { getConfigService } from '@/lib/services/config.service';
import { searchHardcoverBooks, HardcoverSearchResult } from '@/lib/services/hardcover-api.service';

const logger = RMABLogger.create('API.Audiobooks.Details');

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function selectHardcoverMatch(
  books: HardcoverSearchResult[],
  title: string,
  author: string,
): HardcoverSearchResult | null {
  const titleKey = normalize(title);
  const authorKey = normalize(author.split(',')[0] || author);
  return books.find((book) => normalize(book.title) === titleKey && normalize(book.author).includes(authorKey))
    || books.find((book) => normalize(book.title) === titleKey)
    || null;
}

/**
 * GET /api/audiobooks/[asin]
 * Get detailed information for a specific audiobook
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ asin: string }> }
) {
  try {
    const { asin } = await params;

    if (!asin || asin.length !== 10) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Valid ASIN is required',
        },
        { status: 400 }
      );
    }

    const audibleService = getAudibleService();
    const audiobook = await audibleService.getAudiobookDetails(asin);

    if (!audiobook) {
      return NextResponse.json(
        {
          error: 'NotFound',
          message: 'Audiobook not found',
        },
        { status: 404 }
      );
    }

    let hardcover = null;
    try {
      const apiToken = await getConfigService().get('hardcover_search_api_key');
      if (apiToken) {
        const result = await searchHardcoverBooks(apiToken, `${audiobook.title} ${audiobook.author}`, 1);
        const match = selectHardcoverMatch(result.books, audiobook.title, audiobook.author);
        if (match) {
          hardcover = {
            id: match.hardcoverId,
            isbn: match.isbn,
            pageCount: match.pageCount,
            slug: match.slug,
            url: match.slug ? `https://hardcover.app/books/${match.slug}` : `https://hardcover.app/books/${match.hardcoverId}`,
          };
        }
      }
    } catch (error) {
      logger.warn('Hardcover enrichment failed; returning Audible details only', {
        error: error instanceof Error ? error.message : String(error),
        asin,
      });
    }

    return NextResponse.json({
      success: true,
      audiobook,
      hardcover,
      audibleBaseUrl: audibleService.getBaseUrl(),
    });
  } catch (error) {
    logger.error('Failed to get audiobook details', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        error: 'FetchError',
        message: 'Failed to fetch audiobook details',
      },
      { status: 500 }
    );
  }
}
