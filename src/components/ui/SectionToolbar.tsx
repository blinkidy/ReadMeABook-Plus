/**
 * Component: Section Toolbar
 * Documentation: Responsive toolbar that shows inline controls on sm+ and collapses to popover on mobile
 */

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSmartDropdownPosition } from '@/hooks/useSmartDropdownPosition';
import { HideAudiobookAvailableToggle } from '@/components/ui/HideAudiobookAvailableToggle';
import { HideEbookAvailableToggle } from '@/components/ui/HideEbookAvailableToggle';
import { SquareCoversToggle } from '@/components/ui/SquareCoversToggle';
import { CardSizeControls } from '@/components/ui/CardSizeControls';

interface SectionToolbarProps {
  hideAudiobookAvailable: boolean;
  onToggleHideAudiobookAvailable: (v: boolean) => void;
  hideEbookAvailable: boolean;
  onToggleHideEbookAvailable: (v: boolean) => void;
  squareCovers: boolean;
  onToggleSquareCovers: (v: boolean) => void;
  cardSize: number;
  onCardSizeChange: (v: number) => void;
}

export function SectionToolbar({
  hideAudiobookAvailable,
  onToggleHideAudiobookAvailable,
  hideEbookAvailable,
  onToggleHideEbookAvailable,
  squareCovers,
  onToggleSquareCovers,
  cardSize,
  onCardSizeChange,
}: SectionToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { containerRef, dropdownRef, style } = useSmartDropdownPosition(isOpen);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, containerRef, dropdownRef]);

  return (
    <div className="ml-auto flex items-center gap-1">
      {/* Inline controls — visible at sm and above */}
      <div className="hidden sm:flex items-center gap-1">
        <HideAudiobookAvailableToggle enabled={hideAudiobookAvailable} onToggle={onToggleHideAudiobookAvailable} />
        <HideEbookAvailableToggle enabled={hideEbookAvailable} onToggle={onToggleHideEbookAvailable} />
        <SquareCoversToggle enabled={squareCovers} onToggle={onToggleSquareCovers} />
        <CardSizeControls size={cardSize} onSizeChange={onCardSizeChange} />
      </div>

      {/* Collapsed ellipsis trigger — visible below sm */}
      <div className="sm:hidden" ref={containerRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="View options"
          aria-expanded={isOpen}
          className={`
            p-1.5 rounded-md transition-all duration-200
            ${isOpen
              ? 'bg-blue-500/20 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30 dark:ring-blue-400/30'
              : 'text-gray-600 dark:text-gray-400 hover:bg-white/20 dark:hover:bg-gray-700/50'
            }
          `}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>

        {/* Portal dropdown */}
        {isOpen && typeof document !== 'undefined' && style && createPortal(
          <div
            ref={dropdownRef}
            style={style}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg ring-1 ring-black/5 dark:ring-white/10 z-50 py-1 min-w-[220px] animate-in fade-in duration-150"
          >
            {/* Hide Owned Audiobooks */}
            <button
              onClick={() => onToggleHideAudiobookAvailable(!hideAudiobookAvailable)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span className={`
                p-1 rounded-md transition-all duration-200
                ${hideAudiobookAvailable
                  ? 'bg-blue-500/20 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30 dark:ring-blue-400/30 shadow-inner'
                  : 'text-gray-500 dark:text-gray-400'
                }
              `}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 18v-6a9 9 0 1118 0v6" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z" />
                  {hideAudiobookAvailable && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                  )}
                </svg>
              </span>
              <span className="text-gray-700 dark:text-gray-300">Hide Owned Audiobooks</span>
              {hideAudiobookAvailable && (
                <span className="ml-auto text-xs text-blue-600 dark:text-blue-400 font-medium">On</span>
              )}
            </button>

            {/* Hide Owned Ebooks */}
            <button
              onClick={() => onToggleHideEbookAvailable(!hideEbookAvailable)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span className={`
                p-1 rounded-md transition-all duration-200
                ${hideEbookAvailable
                  ? 'bg-blue-500/20 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30 dark:ring-blue-400/30 shadow-inner'
                  : 'text-gray-500 dark:text-gray-400'
                }
              `}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  {hideEbookAvailable && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                  )}
                </svg>
              </span>
              <span className="text-gray-700 dark:text-gray-300">Hide Owned Ebooks</span>
              {hideEbookAvailable && (
                <span className="ml-auto text-xs text-blue-600 dark:text-blue-400 font-medium">On</span>
              )}
            </button>

            {/* Square Covers */}
            <button
              onClick={() => onToggleSquareCovers(!squareCovers)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span className={`
                p-1 rounded-md transition-all duration-200
                ${squareCovers
                  ? 'bg-blue-500/20 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30 dark:ring-blue-400/30 shadow-inner'
                  : 'text-gray-500 dark:text-gray-400'
                }
              `}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9h4M3 15h4M21 9h-4M21 15h-4" opacity={squareCovers ? 1 : 0.4} />
                </svg>
              </span>
              <span className="text-gray-700 dark:text-gray-300">Square Covers</span>
              {squareCovers && (
                <span className="ml-auto text-xs text-blue-600 dark:text-blue-400 font-medium">On</span>
              )}
            </button>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

            {/* Card Size */}
            <div className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="p-1 text-gray-500 dark:text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <span className="text-gray-700 dark:text-gray-300">Card Size</span>
              <div className="ml-auto">
                <CardSizeControls size={cardSize} onSizeChange={onCardSizeChange} />
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
