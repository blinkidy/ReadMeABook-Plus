/**
 * Component: Book Search API Route (Hardcover)
 * Documentation: documentation/integrations/hardcover-search.md
 *
 * Searches Hardcover's catalog for books with no Audible audiobook edition,
 * using an admin-level API key shared across all users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigService } from '@/lib/services/config.service';
import { searchHardcoverBooks, HARDCOVER_SEARCH_PAGE_SIZE } from '@/lib/services/hardcover-api.service';
import { RMABLogger } from '@/lib/utils/logger';

const logger = RMABLogger.create('API.Books.Search');

/**
 * GET /api/books/search?q=query&page=1
 * Search Hardcover's book catalog (for books without an audiobook edition)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || searchParams.get('query');
    const page = parseInt(searchParams.get('page') || '1', 10);

    if (!query) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Search query is required' },
        { status: 400 }
      );
    }

    const configService = getConfigService();
    const apiKey = await configService.get('hardcover_search_api_key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'NotConfigured', message: 'Hardcover book search is not configured' },
        { status: 400 }
      );
    }

    const { books, found } = await searchHardcoverBooks(apiKey, query, page);

    const results = books.map((book) => ({
      hardcoverId: book.hardcoverId,
      source: 'hardcover' as const,
      asin: null,
      title: book.title,
      author: book.author,
      coverArtUrl: book.coverUrl || null,
      isbn: book.isbn || null,
      description: book.description || null,
    }));

    return NextResponse.json({
      success: true,
      query,
      results,
      totalResults: found,
      page,
      hasMore: results.length === HARDCOVER_SEARCH_PAGE_SIZE && page * HARDCOVER_SEARCH_PAGE_SIZE < found,
    });
  } catch (error) {
    logger.error('Failed to search Hardcover books', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'SearchError', message: 'Failed to search books' },
      { status: 500 }
    );
  }
}
