/**
 * Component: Audiobook Card
 * Documentation: documentation/frontend/components.md
 *
 * Premium "Cover First" design - Apple-inspired aesthetic
 * The cover is the hero. Metadata supports, never overwhelms.
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { AudiobookDetailsModal } from '@/components/audiobooks/AudiobookDetailsModal';
import { Audiobook } from '@/lib/hooks/useAudiobooks';

interface AudiobookCardProps {
  audiobook: Audiobook;
  isRequested?: boolean;
  requestStatus?: string;
  onRequestSuccess?: () => void;
  squareCovers?: boolean;
}

// Status configuration for elegant display
const getStatusConfig = (audiobook: Audiobook) => {
  if (audiobook.isAvailable || audiobook.requestStatus === 'completed') {
    return { type: 'available', label: 'In Library', color: 'emerald' };
  }

  const processingStatuses = ['downloading', 'processing', 'downloaded', 'awaiting_import'];
  if (audiobook.requestStatus && processingStatuses.includes(audiobook.requestStatus)) {
    return { type: 'processing', label: 'Processing', color: 'amber' };
  }

  const pendingStatuses = ['pending', 'awaiting_search', 'awaiting_release', 'searching', 'awaiting_approval'];
  if (audiobook.requestStatus && pendingStatuses.includes(audiobook.requestStatus)) {
    return { type: 'pending', label: 'Requested', color: 'blue' };
  }

  if (audiobook.requestStatus === 'denied') {
    return { type: 'denied', label: 'Denied', color: 'red' };
  }

  return null;
};

const PLACEHOLDER_COVER = '/placeholder_cover.svg';

export function AudiobookCard({
  audiobook,
  onRequestSuccess,
  squareCovers = false,
}: AudiobookCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [localRequestStatus, setLocalRequestStatus] = useState<string | undefined>(undefined);
  const [localIsIgnored, setLocalIsIgnored] = useState<boolean | undefined>(undefined);
  const [coverError, setCoverError] = useState(false);

  // Build a display-only audiobook with local overrides
  const displayAudiobook = localRequestStatus !== undefined
    ? { ...audiobook, requestStatus: localRequestStatus }
    : audiobook;
  const status = getStatusConfig(displayAudiobook);
  const isIgnored = localIsIgnored !== undefined ? localIsIgnored : audiobook.isIgnored;

  return (
    <>
      <article
        className="group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-2xl"
        onClick={() => setShowModal(true)}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setShowModal(true)}
        role="button"
        aria-label={`View details for ${audiobook.title} by ${audiobook.author}`}
      >
        {/* Cover Container - The Hero */}
        <div className="relative">
          {/* Cover Image with Premium Shadow */}
          <div
            className={`
              relative overflow-hidden rounded-2xl
              shadow-lg shadow-black/20 dark:shadow-black/40
              group-hover:shadow-xl group-hover:shadow-black/25 dark:group-hover:shadow-black/50
              transform group-hover:scale-[1.02] group-hover:-translate-y-1
              transition-all duration-300 ease-out
              ${squareCovers ? 'aspect-square' : 'aspect-[2/3]'}
              ${status?.type === 'available' ? 'ring-2 ring-emerald-400/60 dark:ring-emerald-500/50' : ''}
              ${status?.type === 'processing' ? 'ring-2 ring-amber-400/60 dark:ring-amber-500/50' : ''}
            `}
          >
            {/* Cover Art */}
            {audiobook.coverArtUrl && !coverError ? (
              <Image
                src={audiobook.coverArtUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                onError={() => setCoverError(true)}
              />
            ) : (
              <Image
                src={PLACEHOLDER_COVER}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              />
            )}

            {/* Subtle Status Indicator */}
            {status && (
              <div className={`
                absolute top-3 right-3 w-3 h-3 rounded-full
                shadow-lg
                ${status.type === 'available' ? 'bg-emerald-400' : ''}
                ${status.type === 'processing' ? 'bg-amber-400 animate-pulse' : ''}
                ${status.type === 'pending' ? 'bg-blue-400' : ''}
                ${status.type === 'denied' ? 'bg-red-400' : ''}
              `} />
            )}

            {/* Rating Badge - Top Left, Elegant */}
            {audiobook.rating && audiobook.rating > 0 && (
              <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-md text-white text-xs font-medium">
                <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>{audiobook.rating.toFixed(1)}</span>
              </div>
            )}

            {/* Ignored Indicator - Bottom Left */}
            {isIgnored && (
              <div
                className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-md text-gray-300 text-xs font-medium"
                title="Ignored from auto-requests"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
                <span>Ignored</span>
              </div>
            )}

            {/* Owned Format Badges - Bottom Right */}
            {(audiobook.audiobookAvailable || audiobook.ebookAvailable) && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1">
                {audiobook.audiobookAvailable && (
                  <div
                    className="p-1.5 rounded-lg bg-black/50 backdrop-blur-md text-white"
                    title="You own this as an audiobook"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 18v-6a9 9 0 1118 0v6" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z" />
                    </svg>
                  </div>
                )}
                {audiobook.ebookAvailable && (
                  <div
                    className="p-1.5 rounded-lg bg-black/50 backdrop-blur-md text-white"
                    title="You own this as an ebook"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Metadata - Clean, Minimal */}
        <div className="mt-3 px-1">
          <h3 className="font-semibold text-[15px] leading-snug text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
            {audiobook.title}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
            {audiobook.author}
          </p>
        </div>

      </article>

      {/* Details Modal */}
      <AudiobookDetailsModal
        asin={audiobook.asin}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onRequestSuccess={onRequestSuccess}
        onStatusChange={(newStatus) => setLocalRequestStatus(newStatus)}
        onIgnoreChange={(ignored) => setLocalIsIgnored(ignored)}
        isRequested={audiobook.isRequested || localRequestStatus !== undefined}
        requestStatus={displayAudiobook.requestStatus}
        isAvailable={audiobook.isAvailable}
        requestedByUsername={audiobook.requestedByUsername}
        hasReportedIssue={audiobook.hasReportedIssue}
      />
    </>
  );
}
