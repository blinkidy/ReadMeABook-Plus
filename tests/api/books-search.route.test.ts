/**
 * Component: Book Search API Route Tests
 * Documentation: documentation/integrations/hardcover-search.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const configMock = vi.hoisted(() => ({ get: vi.fn() }));
const searchHardcoverBooksMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/services/config.service', () => ({
  getConfigService: () => configMock,
}));

vi.mock('@/lib/services/hardcover-api.service', () => ({
  searchHardcoverBooks: searchHardcoverBooksMock,
  HARDCOVER_SEARCH_PAGE_SIZE: 20,
}));

function makeRequest(url: string) {
  return { nextUrl: new URL(url) } as any;
}

describe('GET /api/books/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when query is missing', async () => {
    const { GET } = await import('@/app/api/books/search/route');
    const response = await GET(makeRequest('http://localhost/api/books/search'));
    expect(response.status).toBe(400);
  });

  it('returns 400 when no Hardcover API key is configured', async () => {
    configMock.get.mockResolvedValue(null);

    const { GET } = await import('@/app/api/books/search/route');
    const response = await GET(makeRequest('http://localhost/api/books/search?q=housemaid'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('NotConfigured');
    expect(searchHardcoverBooksMock).not.toHaveBeenCalled();
  });

  it('shapes Hardcover results with a null asin and hardcover source', async () => {
    configMock.get.mockResolvedValue('admin-key');
    searchHardcoverBooksMock.mockResolvedValue({
      found: 1,
      books: [
        {
          hardcoverId: '123',
          title: 'The Housemaid',
          author: 'Freida McFadden',
          coverUrl: 'https://example.com/cover.jpg',
          isbn: '9780000000001',
          description: 'A thriller.',
        },
      ],
    });

    const { GET } = await import('@/app/api/books/search/route');
    const response = await GET(makeRequest('http://localhost/api/books/search?q=housemaid&page=1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(searchHardcoverBooksMock).toHaveBeenCalledWith('admin-key', 'housemaid', 1);
    expect(data.results).toEqual([
      {
        hardcoverId: '123',
        source: 'hardcover',
        asin: null,
        title: 'The Housemaid',
        author: 'Freida McFadden',
        coverArtUrl: 'https://example.com/cover.jpg',
        isbn: '9780000000001',
        description: 'A thriller.',
      },
    ]);
    expect(data.totalResults).toBe(1);
    expect(data.hasMore).toBe(false);
  });
});
