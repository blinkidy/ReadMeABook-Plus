/**
 * Component: Hardcover Search Service Tests
 * Documentation: documentation/integrations/hardcover-search.md
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('axios', () => ({
  default: axiosMock,
  ...axiosMock,
}));

describe('hardcover-api.service searchHardcoverBooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses Typesense-style hits into HardcoverSearchResult objects', async () => {
    axiosMock.post.mockResolvedValue({
      data: {
        data: {
          search: {
            results: {
              found: 2,
              hits: [
                {
                  document: {
                    id: 123,
                    title: 'The Housemaid',
                    author_names: ['Freida McFadden'],
                    image: { url: 'https://example.com/cover.jpg' },
                    isbns: ['9780000000001'],
                    description: 'A thriller.',
                    slug: 'the-housemaid',
                    pages: 336,
                    rating: 4.31,
                    ratings_count: 1280,
                    reviews_count: 245,
                  },
                },
                {
                  document: {
                    id: 456,
                    title: 'Another Book',
                    author_names: ['Some Author'],
                  },
                },
              ],
            },
          },
        },
      },
    });

    const { searchHardcoverBooks } = await import('@/lib/services/hardcover-api.service');
    const { books, found } = await searchHardcoverBooks('token-123', 'housemaid', 1);

    expect(found).toBe(2);
    expect(books).toHaveLength(2);
    expect(books[0]).toEqual({
      hardcoverId: '123',
      title: 'The Housemaid',
      author: 'Freida McFadden',
      coverUrl: 'https://example.com/cover.jpg',
      isbn: '9780000000001',
      description: 'A thriller.',
      slug: 'the-housemaid',
      pageCount: 336,
      rating: 4.31,
      ratingsCount: 1280,
      reviewsCount: 245,
    });
    expect(books[1].author).toBe('Some Author');
    expect(books[1].coverUrl).toBeUndefined();

    expect(axiosMock.post).toHaveBeenCalledWith(
      'https://api.hardcover.app/v1/graphql',
      expect.objectContaining({
        variables: { query: 'housemaid', page: 1, perPage: 20 },
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
      }),
    );
  });

  it('returns an empty array when the results payload has no hits', async () => {
    axiosMock.post.mockResolvedValue({ data: { data: { search: { results: {} } } } });

    const { searchHardcoverBooks } = await import('@/lib/services/hardcover-api.service');
    const { books, found } = await searchHardcoverBooks('token-123', 'nothing', 1);

    expect(books).toEqual([]);
    expect(found).toBe(0);
  });

  it('throws when the Hardcover API returns a GraphQL error', async () => {
    axiosMock.post.mockResolvedValue({ data: { errors: [{ message: 'bad token' }] } });

    const { searchHardcoverBooks } = await import('@/lib/services/hardcover-api.service');
    await expect(searchHardcoverBooks('bad-token', 'query', 1)).rejects.toThrow('bad token');
  });

  it('fetches aggregate ratings and top public reviews', async () => {
    axiosMock.post.mockResolvedValue({
      data: {
        data: {
          books_by_pk: {
            rating: 4.18,
            ratings_count: 4200,
            reviews_count: 610,
          },
          user_books: [
            {
              id: 99,
              rating: 4.5,
              review: 'An excellent space opera.',
              review_has_spoilers: false,
              reviewed_at: '2026-07-01T12:00:00Z',
              likes_count: 42,
              user: { name: 'Reader One', username: 'reader-one' },
            },
            {
              id: 100,
              rating: null,
              review: '  A thoughtful spoiler review.  ',
              review_has_spoilers: true,
              reviewed_at: null,
              likes_count: 3,
              user: { name: null, username: 'reader-two' },
            },
          ],
        },
      },
    });

    const { fetchHardcoverBookCommunityDetails } = await import('@/lib/services/hardcover-api.service');
    const result = await fetchHardcoverBookCommunityDetails('token-123', '456', 5);

    expect(result).toEqual({
      rating: 4.18,
      ratingsCount: 4200,
      reviewsCount: 610,
      reviews: [
        {
          id: '99',
          rating: 4.5,
          text: 'An excellent space opera.',
          hasSpoilers: false,
          reviewedAt: '2026-07-01T12:00:00Z',
          likesCount: 42,
          reviewer: 'Reader One',
        },
        {
          id: '100',
          rating: undefined,
          text: 'A thoughtful spoiler review.',
          hasSpoilers: true,
          reviewedAt: undefined,
          likesCount: 3,
          reviewer: 'reader-two',
        },
      ],
    });
    expect(axiosMock.post).toHaveBeenCalledWith(
      'https://api.hardcover.app/v1/graphql',
      expect.objectContaining({ variables: { bookId: 456, limit: 5 } }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
      }),
    );
  });
});
