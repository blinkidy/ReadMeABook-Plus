/**
 * Component: Hide Audiobook Available Toggle
 * Documentation: UI toggle for hiding titles already owned as an audiobook
 */

'use client';

import React from 'react';

interface HideAudiobookAvailableToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function HideAudiobookAvailableToggle({ enabled, onToggle }: HideAudiobookAvailableToggleProps) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      aria-label={enabled ? 'Show titles owned as an audiobook' : 'Hide titles owned as an audiobook'}
      aria-pressed={enabled}
      title={enabled ? 'Hide owned audiobooks (on)' : 'Hide owned audiobooks (off)'}
      className={`
        p-1.5 rounded-md transition-all duration-200
        ${enabled
          ? 'bg-blue-500/20 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30 dark:ring-blue-400/30 shadow-inner'
          : 'text-gray-600 dark:text-gray-400 hover:bg-white/20 dark:hover:bg-gray-700/50'
        }
      `}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 18v-6a9 9 0 1118 0v6" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z" />
        {enabled && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
        )}
      </svg>
    </button>
  );
}
