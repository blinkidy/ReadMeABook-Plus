/**
 * Component: Hardcover Book Modal
 * Documentation: documentation/integrations/hardcover-search.md
 *
 * Lightweight details modal for books with no audiobook edition (Hardcover
 * search results). Only supports one action: request the EPUB.
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/utils/api';
import type { HardcoverBook } from '@/lib/hooks/useBookSearch';

const PLACEHOLDER_COVER = '/placeholder_cover.svg';

interface HardcoverBookModalProps {
  book: HardcoverBook;
  isOpen: boolean;
  onClose: () => void;
  onRequested?: () => void;
}

export function HardcoverBookModal({ book, isOpen, onClose, onRequested }: HardcoverBookModalProps) {
  const { user } = useAuth();
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestState, setRequestState] = useState<'idle' | 'requested' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequest = async () => {
    setIsRequesting(true);
    setErrorMessage(null);

    try {
      const response = await fetchWithAuth('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audiobook: {
            title: book.title,
            author: book.author,
            description: book.description || undefined,
            coverArtUrl: book.coverArtUrl || undefined,
          },
          mediaType: 'epub',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to request EPUB');
      }

      setRequestState('requested');
      onRequested?.();
    } catch (error) {
      setRequestState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to request EPUB');
    } finally {
      setIsRequesting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Book Details</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-4">
            <div className="relative w-28 aspect-[2/3] flex-shrink-0 overflow-hidden rounded-xl shadow-lg">
              <Image
                src={book.coverArtUrl || PLACEHOLDER_COVER}
                alt=""
                fill
                className="object-cover"
                sizes="112px"
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{book.title}</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{book.author}</p>
              <span className="mt-2 inline-block text-xs font-medium px-2 py-1 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                No audiobook edition found
              </span>
            </div>
          </div>

          {book.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">
              {book.description}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-700/50">
          {requestState === 'requested' ? (
            <button disabled className="w-full py-3 px-4 rounded-xl font-semibold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30">
              EPUB Requested
            </button>
          ) : (
            <button
              onClick={handleRequest}
              disabled={isRequesting || !user}
              className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRequesting ? 'Requesting...' : !user ? 'Sign in to Request' : 'Request EPUB'}
            </button>
          )}
          {requestState === 'error' && errorMessage && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 text-center">{errorMessage}</p>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
