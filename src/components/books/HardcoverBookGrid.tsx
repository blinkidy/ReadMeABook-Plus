/**
 * Component: Hardcover Book Grid
 * Documentation: documentation/integrations/hardcover-search.md
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { HardcoverBookModal } from './HardcoverBookModal';
import type { HardcoverBook } from '@/lib/hooks/useBookSearch';

const PLACEHOLDER_COVER = '/placeholder_cover.svg';

interface HardcoverBookGridProps {
  books: HardcoverBook[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function HardcoverBookGrid({ books, isLoading = false, emptyMessage = 'No books found' }: HardcoverBookGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-6 lg:gap-8">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[2/3] rounded-2xl bg-gray-200 dark:bg-gray-700" />
            <div className="mt-3 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-4/5" />
              <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded-lg w-3/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-6 lg:gap-8">
      {books.map((book) => (
        <HardcoverBookCard key={book.hardcoverId} book={book} />
      ))}
    </div>
  );
}

function HardcoverBookCard({ book }: { book: HardcoverBook }) {
  const [showModal, setShowModal] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [requested, setRequested] = useState(false);

  return (
    <>
      <article
        className="group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-2xl"
        onClick={() => setShowModal(true)}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setShowModal(true)}
        role="button"
        aria-label={`View details for ${book.title} by ${book.author}`}
      >
        <div className="relative overflow-hidden rounded-2xl aspect-[2/3] shadow-lg shadow-black/20 dark:shadow-black/40 group-hover:shadow-xl transform group-hover:scale-[1.02] group-hover:-translate-y-1 transition-all duration-300 ease-out">
          <Image
            src={book.coverArtUrl && !coverError ? book.coverArtUrl : PLACEHOLDER_COVER}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            onError={() => setCoverError(true)}
          />
          {requested && (
            <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-blue-400 shadow-lg" />
          )}
        </div>
        <div className="mt-3 px-1">
          <h3 className="font-semibold text-[15px] leading-snug text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
            {book.title}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
            {book.author}
          </p>
        </div>
      </article>

      <HardcoverBookModal
        book={book}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onRequested={() => setRequested(true)}
      />
    </>
  );
}
