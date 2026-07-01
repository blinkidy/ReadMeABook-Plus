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
});
