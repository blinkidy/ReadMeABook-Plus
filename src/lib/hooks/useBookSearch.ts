/**
 * Component: Book Search Hook (Hardcover)
 * Documentation: documentation/frontend/components.md
 */

'use client';

import { useEffect, useRef } from 'react';
import useSWRInfinite from 'swr/infinite';
import { authenticatedFetcher } from '@/lib/utils/api';

export interface HardcoverBook {
  hardcoverId: string;
  source: 'hardcover';
  asin: null;
  title: string;
  author: string;
  coverArtUrl: string | null;
  isbn: string | null;
  description: string | null;
}

/**
 * Searches Hardcover's catalog for books with no audiobook edition.
 * Used as a fallback to Audible search on the search page.
 */
export function useBookSearch(query: string) {
  const prevQueryRef = useRef(query);

  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite(
    (pageIndex, prevPageData) => {
      if (!query || query.length === 0) return null;
      if (pageIndex === 0) return `/api/books/search?q=${encodeURIComponent(query)}&page=1`;
      if (!prevPageData?.hasMore) return null;
      return `/api/books/search?q=${encodeURIComponent(query)}&page=${pageIndex + 1}`;
    },
    authenticatedFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      revalidateFirstPage: false,
    }
  );

  useEffect(() => {
    if (query !== prevQueryRef.current) {
      prevQueryRef.current = query;
      setSize(1);
    }
  }, [query, setSize]);

  const results: HardcoverBook[] = data ? data.flatMap((page) => page?.results || []) : [];
  const totalResults = data?.[0]?.totalResults || 0;
  const hasMore = !!(data && data.length > 0 && data[data.length - 1]?.hasMore);
  const isLoadingInitial = !data && !error && !!query;
  const isLoadingMore = !!(data && typeof data[size - 1] === 'undefined' && isValidating);

  return {
    results,
    totalResults,
    hasMore,
    isLoading: isLoadingInitial,
    isLoadingMore,
    error,
    loadMore: () => setSize(size + 1),
  };
}
