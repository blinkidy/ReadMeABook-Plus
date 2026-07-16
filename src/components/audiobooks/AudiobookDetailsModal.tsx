/**
 * Component: Audiobook Details Modal
 * Documentation: documentation/frontend/components.md
 *
 * Premium modal design with mobile-first sticky actions
 * Matches the Apple-inspired card aesthetic
 */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useAudiobookDetails } from '@/lib/hooks/useAudiobooks';
import { useCreateRequest, useEbookStatus, useDownloadStatus } from '@/lib/hooks/useRequests';
import { useAuth } from '@/contexts/AuthContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { InteractiveTorrentSearchModal } from '@/components/requests/InteractiveTorrentSearchModal';
import { ReportIssueModal } from '@/components/audiobooks/ReportIssueModal';
import { ManualImportBrowser } from '@/components/audiobooks/ManualImportBrowser';
import { FolderArrowDownIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { EyeSlashIcon as EyeSlashSolidIcon } from '@heroicons/react/24/solid';
import { fetchWithAuth } from '@/lib/utils/api';
import { useIsIgnored, useToggleIgnore } from '@/lib/hooks/useIgnoredAudiobooks';
import { useIsClamped } from '@/lib/hooks/useIsClamped';

interface AudiobookDetailsModalProps {
  asin: string;
  isOpen: boolean;
  onClose: () => void;
  onRequestSuccess?: (format?: RequestFormat) => void;
  onStatusChange?: (newStatus: string) => void;
  onIgnoreChange?: (isIgnored: boolean) => void;
  isRequested?: boolean;
  requestStatus?: string | null;
  isAvailable?: boolean;
  requestedByUsername?: string | null;
  hideRequestActions?: boolean;
  hasReportedIssue?: boolean;
  aiReason?: string | null;
  /** Optional admin action buttons (Approve / Search / Deny) rendered as a second row in the action bar */
  adminActions?: React.ReactNode;
}

type RequestFormat = 'audiobook' | 'epub' | 'both';

const FORMAT_OPTIONS: Array<{
  value: RequestFormat;
  label: string;
  description: string;
  accent: string;
}> = [
  { value: 'audiobook', label: 'Audiobook', description: 'Listen on the go', accent: 'text-purple-500' },
  { value: 'epub', label: 'eBook (EPUB)', description: 'Read digitally', accent: 'text-emerald-400' },
  { value: 'both', label: 'Both formats', description: 'Get both versions', accent: 'text-blue-400' },
];

type ReviewMarkupTag = 'root' | 'p' | 'strong' | 'em' | 'ul' | 'ol' | 'li' | 'blockquote' | 'br';

interface ReviewMarkupNode {
  tag: ReviewMarkupTag;
  children: Array<ReviewMarkupNode | string>;
}

const REVIEW_MARKUP_TAGS = new Set<ReviewMarkupTag>([
  'p',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'blockquote',
  'br',
]);

function decodeReviewEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: '\u00a0',
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();
    if (normalized.startsWith('#')) {
      const radix = normalized.startsWith('#x') ? 16 : 10;
      const number = Number.parseInt(normalized.slice(radix === 16 ? 2 : 1), radix);
      return Number.isSafeInteger(number) && number >= 0 && number <= 0x10ffff
        ? String.fromCodePoint(number)
        : entity;
    }
    return namedEntities[normalized] ?? entity;
  });
}

function parseReviewMarkup(html: string): ReviewMarkupNode {
  const root: ReviewMarkupNode = { tag: 'root', children: [] };
  const stack: ReviewMarkupNode[] = [root];
  const tokens = /<!--[\s\S]*?-->|<\/?([a-z][\w-]*)(?:\s[^<>]*?)?\s*\/?>|([^<]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = tokens.exec(html)) !== null) {
    const text = match[2];
    if (text) {
      stack[stack.length - 1].children.push(decodeReviewEntities(text));
      continue;
    }

    if (match[0].startsWith('<!--')) continue;
    const tag = match[1]?.toLowerCase() as ReviewMarkupTag | undefined;
    if (!tag || !REVIEW_MARKUP_TAGS.has(tag)) continue;

    const isClosingTag = match[0].startsWith('</');
    if (isClosingTag) {
      const openTagIndex = stack.map((node) => node.tag).lastIndexOf(tag);
      if (openTagIndex > 0) stack.length = openTagIndex;
      continue;
    }

    const node: ReviewMarkupNode = { tag, children: [] };
    stack[stack.length - 1].children.push(node);
    if (tag !== 'br' && !match[0].endsWith('/>')) stack.push(node);
  }

  return root;
}

function renderReviewMarkupNode(node: ReviewMarkupNode, key: string): React.ReactNode {
  const children = node.children.map((child, index) => (
    typeof child === 'string' ? child : renderReviewMarkupNode(child, `${key}-${index}`)
  ));

  switch (node.tag) {
    case 'p': return <p key={key} className="mt-3 first:mt-0">{children}</p>;
    case 'strong': return <strong key={key} className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>;
    case 'em': return <em key={key}>{children}</em>;
    case 'ul': return <ul key={key} className="mt-3 list-disc space-y-1 pl-5">{children}</ul>;
    case 'ol': return <ol key={key} className="mt-3 list-decimal space-y-1 pl-5">{children}</ol>;
    case 'li': return <li key={key}>{children}</li>;
    case 'blockquote': return <blockquote key={key} className="mt-3 border-l-2 border-gray-400 pl-3 italic dark:border-gray-600">{children}</blockquote>;
    case 'br': return <br key={key} />;
    default: return <React.Fragment key={key}>{children}</React.Fragment>;
  }
}

function ReviewMarkup({ html }: { html: string }) {
  return <>{renderReviewMarkupNode(parseReviewMarkup(html), 'review')}</>;
}

function FormatOptionIcon({ format, className }: { format: RequestFormat; className: string }) {
  if (format === 'epub') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.25c-1.35-1.1-3.1-1.75-5-1.75-1.1 0-2.1.2-3 .55V18c.9-.35 1.9-.55 3-.55 1.9 0 3.65.65 5 1.75m0-12.95c1.35-1.1 3.1-1.75 5-1.75 1.1 0 2.1.2 3 .55V18c-.9-.35-1.9-.55-3-.55-1.9 0-3.65.65-5 1.75m0-12.95V19.2" />
      </svg>
    );
  }

  const headphones = (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 14v-2a8 8 0 0116 0v2m-16 0v3a2 2 0 002 2h1v-7H6a2 2 0 00-2 2zm16 0v3a2 2 0 01-2 2h-1v-7h1a2 2 0 012 2z" />
    </svg>
  );

  if (format === 'both') {
    return (
      <div className="flex items-center -space-x-1" aria-hidden="true">
        {headphones}
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.25c-1.35-1.1-3.1-1.75-5-1.75-1.1 0-2.1.2-3 .55V18c.9-.35 1.9-.55 3-.55 1.9 0 3.65.65 5 1.75m0-12.95c1.35-1.1 3.1-1.75 5-1.75 1.1 0 2.1.2 3 .55V18c-.9-.35-1.9-.55-3-.55-1.9 0-3.65.65-5 1.75m0-12.95V19.2" />
        </svg>
      </div>
    );
  }

  return headphones;
}

function FormatOptionCard({
  option,
  selected,
  disabled,
  onSelect,
}: {
  option: (typeof FORMAT_OPTIONS)[number];
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-label={option.label}
      aria-pressed={selected}
      className={`relative flex min-h-[88px] items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all sm:min-h-[96px] sm:flex-col sm:justify-center sm:gap-2 sm:text-center ${
        selected
          ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_28px_rgba(139,92,246,0.12)] ring-1 ring-purple-500/40'
          : 'border-gray-300 bg-white/40 hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-gray-600'
      } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
    >
      <FormatOptionIcon format={option.value} className={`h-8 w-8 ${option.accent}`} />
      <span>
        <span className={`block text-base font-semibold ${selected ? 'text-purple-500 dark:text-purple-400' : 'text-gray-900 dark:text-gray-100'}`}>
          {option.label}
        </span>
        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400 sm:hidden">{option.description}</span>
      </span>
      <span className={`absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border-2 sm:right-3 sm:top-3 sm:translate-y-0 ${
        selected
          ? 'border-purple-500 bg-purple-500 text-white'
          : 'border-gray-400 text-transparent dark:border-gray-600'
      }`} aria-hidden="true">
        {selected && (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
    </button>
  );
}

// Status helper
const getStatusInfo = (isAvailable: boolean, requestStatus: string | null, requestedByUsername: string | null) => {
  if (isAvailable || requestStatus === 'completed') {
    return { type: 'available', label: 'In Your Library', canRequest: false };
  }

  const processingStatuses = ['downloading', 'processing', 'downloaded', 'awaiting_import'];
  if (requestStatus && processingStatuses.includes(requestStatus)) {
    return { type: 'processing', label: 'Processing', canRequest: false };
  }

  const pendingStatuses = ['pending', 'awaiting_search', 'awaiting_release', 'searching', 'awaiting_approval'];
  if (requestStatus && pendingStatuses.includes(requestStatus)) {
    const label = requestStatus === 'awaiting_approval'
      ? requestedByUsername ? `Pending Approval (${requestedByUsername})` : 'Pending Approval'
      : requestedByUsername ? `Requested by ${requestedByUsername}` : 'Requested';
    return { type: 'pending', label, canRequest: false };
  }

  if (requestStatus === 'denied') {
    return { type: 'denied', label: 'Request Denied', canRequest: true };
  }

  return { type: 'none', label: '', canRequest: true };
};

export function AudiobookDetailsModal({
  asin,
  isOpen,
  onClose,
  onRequestSuccess,
  onStatusChange,
  onIgnoreChange,
  isRequested = false,
  requestStatus = null,
  isAvailable = false,
  requestedByUsername = null,
  hideRequestActions = false,
  hasReportedIssue = false,
  aiReason = null,
  adminActions,
}: AudiobookDetailsModalProps) {
  const { user } = useAuth();
  const { squareCovers } = usePreferences();
  const { audiobook, hardcover, audibleBaseUrl, isLoading, error } = useAudiobookDetails(isOpen ? asin : null);
  const { createRequest, isLoading: isRequesting } = useCreateRequest();
  const { ebookStatus, revalidate: revalidateEbookStatus } = useEbookStatus(isOpen ? asin : null);
  const { downloadAvailable, requestId } = useDownloadStatus(isOpen ? asin : null);

  const { isIgnored, ignoredId, isLoading: isLoadingIgnore } = useIsIgnored(isOpen ? asin : null);
  const { addIgnore, removeIgnore } = useToggleIgnore();

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [mounted, setMounted] = useState(false);
  const [showInteractiveSearch, setShowInteractiveSearch] = useState(false);
  const [showInteractiveSearchEbook, setShowInteractiveSearchEbook] = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [showManualImport, setShowManualImport] = useState(false);
  const [asinCopied, setAsinCopied] = useState(false);
  const [localRequestStatus, setLocalRequestStatus] = useState<string | null>(requestStatus ?? null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [isTogglingIgnore, setIsTogglingIgnore] = useState(false);
  const [requestFormat, setRequestFormat] = useState<RequestFormat>('audiobook');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [revealedSpoilerReviews, setRevealedSpoilerReviews] = useState<Set<string>>(new Set());
  const [showAdminTools, setShowAdminTools] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  // Real overflow detection instead of a character-count guess, since the same
  // text wraps into more lines on narrower (mobile) viewports.
  // `mounted` must be a dependency: this modal renders once before `mounted`
  // flips true (see below), so the paragraph doesn't exist yet on the first
  // pass — without this, the effect never re-measures once it actually mounts.
  const isDescriptionClamped = useIsClamped(descriptionRef, [audiobook?.description, descriptionExpanded, mounted]);

  // Sync local status when the prop changes (e.g. page data refreshes)
  useEffect(() => {
    setLocalRequestStatus(requestStatus ?? null);
  }, [requestStatus]);

  // Collapse the summary again when a different book's details are opened
  useEffect(() => {
    setDescriptionExpanded(false);
    setReviewsExpanded(false);
    setRevealedSpoilerReviews(new Set());
    setShowAdminTools(false);
  }, [asin]);

  const effectiveStatus = localRequestStatus;
  const ebookAvailable = ebookStatus?.ebookAvailable ?? false;
  const audiobookAvailable = ebookStatus?.audiobookAvailable ?? (isAvailable && !ebookAvailable);
  const audiobookEffectiveStatus = ebookStatus ? ebookStatus.existingAudiobookStatus : effectiveStatus;
  const status = getStatusInfo(audiobookAvailable, audiobookEffectiveStatus, requestedByUsername);
  const bothFormatsAvailable = audiobookAvailable && ebookAvailable;
  const hasEbookInProgress = !!ebookStatus?.hasActiveEbookRequest && !ebookAvailable;
  const canRequestAudiobook = !audiobookAvailable && status.canRequest;
  const canSearchAudiobook = !audiobookAvailable;
  const canRequestEbook = !ebookAvailable && !!ebookStatus?.ebookSourcesEnabled && !ebookStatus?.hasActiveEbookRequest;
  const canSearchEbook = canRequestEbook && audiobookAvailable;
  const requestableFormats = useMemo<RequestFormat[]>(() => [
    ...(canRequestAudiobook ? ['audiobook' as const] : []),
    ...(canRequestEbook ? ['epub' as const] : []),
    ...(canRequestAudiobook && canRequestEbook ? ['both' as const] : []),
  ], [canRequestAudiobook, canRequestEbook]);
  const canRequestSelectedFormat = requestableFormats.includes(requestFormat);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (requestableFormats.length > 0 && !requestableFormats.includes(requestFormat)) {
      setRequestFormat(requestableFormats[0]);
    }
  }, [requestableFormats, requestFormat]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleRequest = async () => {
    if (!user || !audiobook) {
      showNotification('Please log in to request books', 'error');
      return;
    }

    try {
      if (requestFormat === 'both') {
        await createRequest(audiobook, { mediaType: 'audiobook' });
        await createRequest(audiobook, { mediaType: 'epub' });
        setLocalRequestStatus('pending');
        onStatusChange?.('pending');
        revalidateEbookStatus();
      } else {
        await createRequest(audiobook, { mediaType: requestFormat });
      }

      if (requestFormat === 'audiobook') {
        setLocalRequestStatus('pending');
        onStatusChange?.('pending');
      } else if (requestFormat === 'epub') {
        revalidateEbookStatus();
      }
      showNotification(`${requestFormat === 'both' ? 'Audiobook and EPUB' : requestFormat === 'epub' ? 'EPUB' : 'Audiobook'} request created!`);
      setTimeout(onClose, 1500);
      onRequestSuccess?.(requestFormat);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to create request', 'error');
    }
  };

  const handleInteractiveSearch = () => {
    if (!user || !audiobook) {
      showNotification('Please log in to request books', 'error');
      return;
    }
    setShowInteractiveSearch(true);
  };

  const handleCopyAsin = async () => {
    try {
      await navigator.clipboard.writeText(asin);
      setAsinCopied(true);
      setTimeout(() => setAsinCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy ASIN:', err);
    }
  };

  const handleDownload = async () => {
    if (!requestId) return;
    setIsDownloading(true);
    try {
      const res = await fetchWithAuth(`/api/requests/${requestId}/download-token`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to get download link');
      const { downloadUrl } = await res.json();
      window.location.href = downloadUrl;
    } catch (err) {
      console.error('Failed to initiate download:', err);
      showNotification('Failed to start download. Please try again.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleToggleIgnore = async () => {
    if (!user || !audiobook) return;
    setIsTogglingIgnore(true);
    try {
      if (isIgnored && ignoredId) {
        await removeIgnore(ignoredId, asin);
        onIgnoreChange?.(false);
        showNotification('Removed from ignore list');
      } else {
        await addIgnore({
          asin,
          title: audiobook.title,
          author: audiobook.author,
          coverArtUrl: audiobook.coverArtUrl,
        });
        onIgnoreChange?.(true);
        showNotification('Added to ignore list — auto-requests will skip this book');
      }
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to update ignore status', 'error');
    } finally {
      setIsTogglingIgnore(false);
    }
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      style={{ height: '100dvh' }}
      onClick={onClose}
    >
      {/* Modal Container - uses dvh for PWA support */}
      <div
        className="relative w-full sm:max-w-2xl lg:max-w-3xl bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300"
        style={{
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px))',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile: Sticky Header with Close */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 sm:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Audiobook Details</span>

          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Desktop: Close Button */}
        <button
          onClick={onClose}
          className="hidden sm:flex absolute top-4 right-4 z-20 p-2 rounded-full bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-gray-900 dark:text-gray-100 font-medium">Failed to load details</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Please try again later</p>
            </div>
          )}

          {/* Content */}
          {audiobook && !isLoading && (
            <div className="p-4 sm:p-6 lg:p-8">
              {/* Hero Section - Cover + Title/Author */}
              <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
                {/* Cover Art */}
                <div className="flex-shrink-0 mx-auto sm:mx-0">
                  <div className={`
                    relative overflow-hidden rounded-2xl shadow-xl shadow-black/20 dark:shadow-black/40
                    ${squareCovers ? 'w-40 sm:w-44 lg:w-52 aspect-square' : 'w-32 sm:w-40 lg:w-48 aspect-[2/3]'}
                    ${status.type === 'available' ? 'ring-2 ring-emerald-400/60' : ''}
                  `}>
                    {audiobook.coverArtUrl && !coverError ? (
                      <Image
                        src={audiobook.coverArtUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="200px"
                        priority
                        onError={() => setCoverError(true)}
                      />
                    ) : (
                      <Image
                        src="/placeholder_cover.svg"
                        alt=""
                        fill
                        className="object-cover"
                        sizes="200px"
                      />
                    )}

                    {/* Audible + Hardcover rating badges */}
                    {((audiobook.rating && audiobook.rating > 0) || (hardcover?.rating && hardcover.rating > 0)) && (
                      <div className="absolute top-2 left-2 right-2 flex flex-wrap items-center gap-1.5">
                        {audiobook.rating && audiobook.rating > 0 && (
                          <div
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-white text-[11px] font-semibold shadow-sm"
                            title="Audible rating"
                            aria-label={`Audible rating ${audiobook.rating.toFixed(1)} out of 5`}
                          >
                            <span className="text-amber-400" aria-hidden="true">★</span>
                            <span>Aud {audiobook.rating.toFixed(1)}</span>
                          </div>
                        )}
                        {hardcover?.rating && hardcover.rating > 0 && (
                          <div
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-700/90 backdrop-blur-sm text-white text-[11px] font-semibold shadow-sm"
                            title="Hardcover rating"
                            aria-label={`Hardcover rating ${hardcover.rating.toFixed(1)} out of 5`}
                          >
                            <span className="text-amber-300" aria-hidden="true">★</span>
                            <span>HC {hardcover.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Title & Author */}
                <div className="flex-1 text-center sm:text-left min-w-0">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                    {audiobook.title}
                  </h2>
                  <p className="mt-2 text-base sm:text-lg text-gray-600 dark:text-gray-300">
                    {audiobook.authorAsin ? (
                      <Link
                        href={`/authors/${audiobook.authorAsin}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                        }}
                        className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        {audiobook.author}
                      </Link>
                    ) : (
                      audiobook.author
                    )}
                  </p>
                  {audiobook.narrator && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Narrated by {audiobook.narrator}
                    </p>
                  )}
                  {audiobook.series && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {audiobook.seriesAsin ? (
                        <Link
                          href={`/series/${audiobook.seriesAsin}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                          }}
                          className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        >
                          {audiobook.series}{audiobook.seriesPart ? `, Book ${audiobook.seriesPart}` : ''}
                        </Link>
                      ) : (
                        <span>{audiobook.series}{audiobook.seriesPart ? `, Book ${audiobook.seriesPart}` : ''}</span>
                      )}
                    </p>
                  )}

                  {/* Status Badge */}
                  {status.type !== 'none' && (
                    <div className="mt-4 inline-flex">
                      <span className={`
                        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                        ${status.type === 'available' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : ''}
                        ${status.type === 'processing' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : ''}
                        ${status.type === 'pending' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : ''}
                        ${status.type === 'denied' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : ''}
                      `}>
                        {status.type === 'available' && (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                        {status.type === 'processing' && (
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        )}
                        {status.label}
                      </span>
                    </div>
                  )}

                  {/* Issue Reported Badge */}
                  {isAvailable && hasReportedIssue && (
                    <div className="mt-2 inline-flex">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                        Issue Reported
                      </span>
                    </div>
                  )}

                  {/* Report Issue Button - inline with metadata, not in action bar */}
                  {isAvailable && !hasReportedIssue && user && (
                    <div className="mt-2 inline-flex">
                      <button
                        onClick={() => setShowReportIssue(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                        Report Issue
                      </button>
                    </div>
                  )}

                  {/* Quick Metadata */}
                  <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-sm text-gray-500 dark:text-gray-400">
                    {audiobook.durationMinutes && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatDuration(audiobook.durationMinutes)}
                      </span>
                    )}
                    {hardcover?.pageCount && (
                      <span>{hardcover.pageCount.toLocaleString()} pages</span>
                    )}
                    {audiobook.releaseDate && (
                      <span>{formatDate(audiobook.releaseDate)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Genres */}
              {audiobook.genres && audiobook.genres.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {audiobook.genres.map((genre: string) => (
                    <span
                      key={genre}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm rounded-full"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              {audiobook.description && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700/50">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Summary
                  </h3>
                  <p
                    ref={descriptionRef}
                    className={`text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-[15px] ${
                      !descriptionExpanded ? 'line-clamp-4' : ''
                    }`}
                  >
                    {audiobook.description}
                  </p>
                  {(isDescriptionClamped || descriptionExpanded) && (
                    <button
                      onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                      className="mt-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      {descriptionExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}

              {/* AI Recommendation Reasoning */}
              {aiReason && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700/50">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Why This Was Recommended
                  </h3>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                      {aiReason}
                    </p>
                  </div>
                </div>
              )}

              {/* Hardcover Reviews */}
              {hardcover?.reviews && hardcover.reviews.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700/50">
                  <button
                    type="button"
                    onClick={() => setReviewsExpanded((expanded) => !expanded)}
                    className="w-full flex items-center justify-between gap-4 text-left group"
                    aria-expanded={reviewsExpanded}
                    aria-controls="hardcover-reviews"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Hardcover Reviews
                      </span>
                      <span className="block mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {hardcover.rating ? `${hardcover.rating.toFixed(1)} average` : 'Reader reviews'}
                        {hardcover.ratingsCount !== undefined ? ` from ${hardcover.ratingsCount.toLocaleString()} ratings` : ''}
                        {' · '}{hardcover.reviews.length} top {hardcover.reviews.length === 1 ? 'review' : 'reviews'}
                      </span>
                    </span>
                    <svg
                      className={`w-5 h-5 flex-shrink-0 text-gray-500 transition-transform ${reviewsExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {reviewsExpanded && (
                    <div id="hardcover-reviews" className="mt-4 space-y-3">
                      {hardcover.reviews.map((review) => {
                        const spoilerRevealed = !review.hasSpoilers || revealedSpoilerReviews.has(review.id);
                        return (
                          <article
                            key={review.id}
                            className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">{review.reviewer}</span>
                              <span className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                                {review.rating && (
                                  <span aria-label={`${review.rating.toFixed(1)} out of 5 stars`}>
                                    <span className="text-amber-500" aria-hidden="true">★</span> {review.rating.toFixed(1)}
                                  </span>
                                )}
                                {review.likesCount > 0 && <span>{review.likesCount.toLocaleString()} likes</span>}
                              </span>
                            </div>

                            {spoilerRevealed ? (
                              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                <ReviewMarkup html={review.text} />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setRevealedSpoilerReviews((revealed) => new Set(revealed).add(review.id))}
                                className="mt-3 w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
                              >
                                This review contains spoilers — click to reveal
                              </button>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Details Grid */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700/50">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* ASIN */}
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">ASIN</p>
                    <button
                      onClick={handleCopyAsin}
                      className="flex items-center gap-1.5 font-mono text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      {asin}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {asinCopied ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        )}
                      </svg>
                    </button>
                  </div>

                  {hardcover?.isbn && (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">ISBN</p>
                      <p className="font-mono text-gray-900 dark:text-gray-100">{hardcover.isbn}</p>
                    </div>
                  )}

                  {/* Audible Link */}
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Sources</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <a
                      href={`${audibleBaseUrl}/pd/${asin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 hover:underline"
                    >
                      Audible
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    {hardcover?.url && (
                      <a
                        href={hardcover.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Hardcover
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                    </div>
                  </div>

                  {/* Language */}
                  {audiobook.language && (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Language</p>
                      <p className="text-gray-900 dark:text-gray-100 capitalize">{audiobook.language}</p>
                    </div>
                  )}

                  {/* Format */}
                  {audiobook.formatType && (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Format</p>
                      <p className="text-gray-900 dark:text-gray-100 capitalize">{audiobook.formatType}</p>
                    </div>
                  )}

                  {/* Publisher */}
                  {audiobook.publisherName && (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Publisher</p>
                      <p className="text-gray-900 dark:text-gray-100">{audiobook.publisherName}</p>
                    </div>
                  )}

                  {/* Download Link - subtle utility, visible from any context */}
                  {isAvailable && downloadAvailable && requestId && user?.permissions?.download !== false && (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Download</p>
                      <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                        aria-label={isDownloading ? 'Preparing download...' : 'Download audiobook files'}
                      >
                        {isDownloading ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span>Preparing...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Download files</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Ebook Status */}
              {(ebookAvailable || hasEbookInProgress) && (
                <div className="mt-4 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50">
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 text-sm">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>
                      {ebookStatus?.existingEbookStatus === 'awaiting_approval'
                        ? 'Ebook: Pending Approval'
                        : ebookAvailable
                          ? (audiobookAvailable
                              ? 'Ebook: Available'
                              : "This book is in your library as an ebook. If you'd like the audiobook version, request it below.")
                          : 'Ebook: In Progress'}
                    </span>
                  </div>
                </div>
              )}

              {/* Audiobook Status - mirrors the ebook banner above when only the audiobook is owned */}
              {audiobookAvailable && !ebookAvailable && (
                <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-sm">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0-11a3 3 0 003-3V5a3 3 0 00-6 0v3a3 3 0 003 3z" />
                    </svg>
                    <span>
                      This book is in your library as an audiobook. If you&apos;d like the EPUB version, request it below.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>


        {/* Sticky Action Bar - hidden when opened from read-only contexts */}
        {audiobook && !isLoading && !hideRequestActions && (
          <div
            className="sticky bottom-0 z-20 border-t border-gray-200/50 bg-white/90 p-3 backdrop-blur-md dark:border-gray-700/50 dark:bg-gray-900/90"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex flex-col gap-3">
              {requestableFormats.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Format</h3>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">Choose the format you&apos;d like.</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {FORMAT_OPTIONS.map((option) => (
                      <FormatOptionCard
                        key={option.value}
                        option={option}
                        selected={requestFormat === option.value}
                        disabled={!requestableFormats.includes(option.value)}
                        onSelect={() => setRequestFormat(option.value)}
                      />
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3">
                    <span className="text-2xl text-amber-400" aria-hidden="true">✧</span>
                    <span>
                      <span className="block font-semibold text-gray-900 dark:text-gray-100">Can&apos;t find what you&apos;re looking for?</span>
                      <span className="mt-0.5 block text-sm text-gray-500 dark:text-gray-400">We&apos;ll do our best to get it for you!</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Main Action */}
              <div>
                {bothFormatsAvailable ? (
                  <button
                    disabled
                    className="w-full py-3 px-4 rounded-xl font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30"
                  >
                    In Your Library
                  </button>
                ) : requestableFormats.length > 0 ? (
                  <button
                    onClick={handleRequest}
                    disabled={isRequesting || !user || !canRequestSelectedFormat}
                    className="w-full rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-blue-600 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-purple-900/20 transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isRequesting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Requesting...
                      </span>
                    ) : !user ? 'Sign in to Request' : (
                      <span className="flex items-center justify-center gap-3">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 11.5L21 3l-8.5 18-2.25-7.25L3 11.5zM10.25 13.75L15 9" />
                        </svg>
                        Submit Request
                      </span>
                    )}
                  </button>
                ) : (
                  <button
                    disabled
                    className={`
                      w-full py-3 px-4 rounded-xl font-semibold
                      ${audiobookAvailable || ebookAvailable ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30' : ''}
                      ${hasEbookInProgress ? 'text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30' : ''}
                      ${status.type === 'processing' ? 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30' : ''}
                      ${status.type === 'pending' ? 'text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30' : ''}
                      ${status.type === 'denied' ? 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30' : ''}
                    `}
                  >
                    {status.type === 'processing' && (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing
                      </span>
                    )}
                    {status.type === 'pending' && status.label}
                    {status.type === 'denied' && 'Request Denied'}
                    {hasEbookInProgress && 'EPUB In Progress'}
                    {!hasEbookInProgress && status.type === 'available' && !ebookAvailable && 'Audiobook In Library'}
                    {!hasEbookInProgress && status.type !== 'available' && ebookAvailable && !audiobookAvailable && 'EPUB In Library'}
                    {!hasEbookInProgress && status.type === 'none' && !ebookAvailable && !audiobookAvailable && 'No request options available'}
                  </button>
                )}
              </div>
            </div>

            {user?.role === 'admin' && showAdminTools && (
              <div id="audiobook-admin-tools" className="mt-1 rounded-2xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Admin tools</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {adminActions && (
                    <div className="mb-1 border-b border-gray-200 pb-3 dark:border-gray-700 sm:col-span-2">
                      {adminActions}
                    </div>
                  )}
                  {canSearchAudiobook && (
                    <button type="button" onClick={handleInteractiveSearch} className="flex items-center gap-3 rounded-xl bg-purple-100 px-4 py-3 text-left text-sm font-medium text-purple-700 transition-colors hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      Interactive Search
                    </button>
                  )}
                  {canSearchAudiobook && !['downloading', 'processing', 'searching', 'downloaded', 'completed', 'available'].includes(audiobookEffectiveStatus || '') && (
                    <button type="button" onClick={() => setShowManualImport(true)} className="flex items-center gap-3 rounded-xl bg-teal-100 px-4 py-3 text-left text-sm font-medium text-teal-700 transition-colors hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50">
                      <FolderArrowDownIcon className="h-5 w-5" />
                      Manual Import
                    </button>
                  )}
                  {canSearchEbook && (
                    <button type="button" onClick={() => setShowInteractiveSearchEbook(true)} className="flex items-center gap-3 rounded-xl bg-orange-100 px-4 py-3 text-left text-sm font-medium text-orange-700 transition-colors hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      Search Ebook Sources
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex min-w-0 items-center gap-2">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11V7a5 5 0 0110 0v4m-11 0h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z" /></svg>
                <span className="truncate">Request handling follows your server&apos;s approval settings.</span>
              </span>
              <span className="flex flex-shrink-0 items-center gap-1">
                {user && !isLoadingIgnore && (
                  <button
                    type="button"
                    onClick={handleToggleIgnore}
                    disabled={isTogglingIgnore}
                    aria-label={isIgnored ? 'Stop Ignoring' : 'Ignore from Auto-Requests'}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    title={isIgnored ? 'Stop ignoring — shelf auto-requests will resume for this book' : 'Ignore this book from shelf auto-requests'}
                  >
                    {isIgnored ? <EyeSlashSolidIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
                    <span className="hidden sm:inline">{isIgnored ? 'Stop Ignoring' : 'Ignore'}</span>
                  </button>
                )}
                {user?.role === 'admin' && (
                  <button type="button" onClick={() => setShowAdminTools((show) => !show)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200" aria-expanded={showAdminTools} aria-controls="audiobook-admin-tools">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.6 3.2l.5 1.6a7.5 7.5 0 013.8 0l.5-1.6 2.1.9-.8 1.5a7.4 7.4 0 012.7 2.7l1.5-.8.9 2.1-1.6.5a7.5 7.5 0 010 3.8l1.6.5-.9 2.1-1.5-.8a7.4 7.4 0 01-2.7 2.7l.8 1.5-2.1.9-.5-1.6a7.5 7.5 0 01-3.8 0l-.5 1.6-2.1-.9.8-1.5a7.4 7.4 0 01-2.7-2.7l-1.5.8-.9-2.1 1.6-.5a7.5 7.5 0 010-3.8l-1.6-.5.9-2.1 1.5.8a7.4 7.4 0 012.7-2.7l-.8-1.5 2.1-.9zM12 9a3 3 0 100 6 3 3 0 000-6z" /></svg>
                    Admin
                  </button>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {showToast && (
          <div className={`
            absolute bottom-20 left-1/2 -translate-x-1/2 z-30
            px-4 py-2.5 rounded-xl shadow-lg backdrop-blur-md
            ${toastType === 'success' ? 'bg-emerald-500/95 text-white' : 'bg-red-500/95 text-white'}
            animate-in fade-in slide-in-from-bottom-2 duration-200
          `}>
            <p className="text-sm font-medium whitespace-nowrap">{toastMessage}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}

      {/* Interactive Search Modal (Audiobook) */}
      {showInteractiveSearch && audiobook && createPortal(
        <div className="fixed inset-0 z-[60]">
          <InteractiveTorrentSearchModal
            isOpen={showInteractiveSearch}
            onClose={() => {
              setShowInteractiveSearch(false);
              onClose();
            }}
            onSuccess={() => {
              onRequestSuccess?.();
            }}
            audiobook={{
              title: audiobook.title,
              author: audiobook.author,
            }}
            fullAudiobook={audiobook}
          />
        </div>,
        document.body
      )}

      {/* Interactive Search Modal (Ebook) */}
      {showInteractiveSearchEbook && audiobook && createPortal(
        <div className="fixed inset-0 z-[60]">
          <InteractiveTorrentSearchModal
            isOpen={showInteractiveSearchEbook}
            onClose={() => {
              setShowInteractiveSearchEbook(false);
              revalidateEbookStatus();
            }}
            onSuccess={() => {
              revalidateEbookStatus();
              showNotification('Ebook download started!');
            }}
            asin={asin}
            audiobook={{
              title: audiobook.title,
              author: audiobook.author,
            }}
            searchMode="ebook"
          />
        </div>,
        document.body
      )}

      {/* Report Issue Modal */}
      {showReportIssue && audiobook && (
        <ReportIssueModal
          isOpen={showReportIssue}
          onClose={() => setShowReportIssue(false)}
          onSuccess={() => {
            setShowReportIssue(false);
            showNotification('Issue reported!');
          }}
          asin={asin}
          bookTitle={audiobook.title}
          bookAuthor={audiobook.author}
          coverArtUrl={audiobook.coverArtUrl}
        />
      )}

      {/* Manual Import Browser */}
      {showManualImport && audiobook && (
        <ManualImportBrowser
          isOpen={showManualImport}
          onClose={() => setShowManualImport(false)}
          onSuccess={() => {
            setLocalRequestStatus('processing');
            onStatusChange?.('processing');
            showNotification('Import started — files are being processed');
            onRequestSuccess?.();
          }}
          audiobook={{
            asin: audiobook.asin,
            title: audiobook.title,
            author: audiobook.author,
            coverArtUrl: audiobook.coverArtUrl,
          }}
        />
      )}
    </>
  );
}
