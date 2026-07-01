/**
 * Component: Hide Ebook Available Toggle
 * Documentation: UI toggle for hiding titles already owned as an ebook
 */

'use client';

import React from 'react';

interface HideEbookAvailableToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function HideEbookAvailableToggle({ enabled, onToggle }: HideEbookAvailableToggleProps) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      aria-label={enabled ? 'Show titles owned as an ebook' : 'Hide titles owned as an ebook'}
      aria-pressed={enabled}
      title={enabled ? 'Hide owned ebooks (on)' : 'Hide owned ebooks (off)'}
      className={`
        p-1.5 rounded-md transition-all duration-200
        ${enabled
          ? 'bg-blue-500/20 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30 dark:ring-blue-400/30 shadow-inner'
          : 'text-gray-600 dark:text-gray-400 hover:bg-white/20 dark:hover:bg-gray-700/50'
        }
      `}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        {enabled && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
        )}
      </svg>
    </button>
  );
}
