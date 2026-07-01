/**
 * Component: User Preferences Context Provider
 * Documentation: Manages user preferences (card size, etc.) with localStorage persistence
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Preferences {
  cardSize: number; // 1-9, default 5
  squareCovers: boolean; // true = square (1:1), false = rectangle (2:3)
  hideAvailable?: boolean; // legacy combined toggle, migrated to the two below
  hideAudiobookAvailable: boolean; // true = hide titles already owned as an audiobook
  hideEbookAvailable: boolean; // true = hide titles already owned as an ebook
}

interface PreferencesContextType {
  cardSize: number;
  setCardSize: (size: number) => void;
  squareCovers: boolean;
  setSquareCovers: (enabled: boolean) => void;
  hideAudiobookAvailable: boolean;
  setHideAudiobookAvailable: (enabled: boolean) => void;
  hideEbookAvailable: boolean;
  setHideEbookAvailable: (enabled: boolean) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

const DEFAULT_PREFERENCES: Preferences = {
  cardSize: 5,
  squareCovers: true,
  hideAudiobookAvailable: false,
  hideEbookAvailable: false,
};

const STORAGE_KEY = 'preferences';

// Migrate the old combined "hideAvailable" toggle (hid a title if either
// format was owned) to both new toggles, so existing users keep the same
// effective behavior after upgrading.
function resolveHideToggles(preferences: Preferences): { hideAudiobookAvailable: boolean; hideEbookAvailable: boolean } {
  if (preferences.hideAudiobookAvailable !== undefined || preferences.hideEbookAvailable !== undefined) {
    return {
      hideAudiobookAvailable: preferences.hideAudiobookAvailable ?? DEFAULT_PREFERENCES.hideAudiobookAvailable,
      hideEbookAvailable: preferences.hideEbookAvailable ?? DEFAULT_PREFERENCES.hideEbookAvailable,
    };
  }
  if (preferences.hideAvailable) {
    return { hideAudiobookAvailable: true, hideEbookAvailable: true };
  }
  return { hideAudiobookAvailable: false, hideEbookAvailable: false };
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [cardSize, setCardSizeState] = useState<number>(DEFAULT_PREFERENCES.cardSize);
  const [squareCovers, setSquareCoversState] = useState<boolean>(DEFAULT_PREFERENCES.squareCovers);
  const [hideAudiobookAvailable, setHideAudiobookAvailableState] = useState<boolean>(DEFAULT_PREFERENCES.hideAudiobookAvailable);
  const [hideEbookAvailable, setHideEbookAvailableState] = useState<boolean>(DEFAULT_PREFERENCES.hideEbookAvailable);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const preferences: Preferences = JSON.parse(stored);
        // Validate cardSize is within range 1-9
        if (preferences.cardSize >= 1 && preferences.cardSize <= 9) {
          setCardSizeState(preferences.cardSize);
        } else {
          // Invalid size, reset to default
          setCardSizeState(DEFAULT_PREFERENCES.cardSize);
        }
        // Load squareCovers preference (defaults to false if not set)
        setSquareCoversState(preferences.squareCovers ?? DEFAULT_PREFERENCES.squareCovers);
        // Load hide toggles, migrating the legacy combined toggle if present
        const { hideAudiobookAvailable: hideAB, hideEbookAvailable: hideEB } = resolveHideToggles(preferences);
        setHideAudiobookAvailableState(hideAB);
        setHideEbookAvailableState(hideEB);
      }
    } catch (error) {
      console.error('Failed to load preferences from localStorage:', error);
      setCardSizeState(DEFAULT_PREFERENCES.cardSize);
      setSquareCoversState(DEFAULT_PREFERENCES.squareCovers);
      setHideAudiobookAvailableState(DEFAULT_PREFERENCES.hideAudiobookAvailable);
      setHideEbookAvailableState(DEFAULT_PREFERENCES.hideEbookAvailable);
    }
  }, []);

  // Update card size in state and localStorage
  const setCardSize = (size: number) => {
    if (typeof window === 'undefined') return;

    // Validate size is within range 1-9
    const validSize = Math.max(1, Math.min(9, size));

    setCardSizeState(validSize);

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const preferences: Preferences = stored ? JSON.parse(stored) : { ...DEFAULT_PREFERENCES };
      preferences.cardSize = validSize;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save preferences to localStorage:', error);
    }
  };

  // Update square covers preference in state and localStorage
  const setSquareCovers = (enabled: boolean) => {
    if (typeof window === 'undefined') return;

    setSquareCoversState(enabled);

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const preferences: Preferences = stored ? JSON.parse(stored) : { ...DEFAULT_PREFERENCES };
      preferences.squareCovers = enabled;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save preferences to localStorage:', error);
    }
  };

  // Update hideAudiobookAvailable preference in state and localStorage
  const setHideAudiobookAvailable = (enabled: boolean) => {
    if (typeof window === 'undefined') return;

    setHideAudiobookAvailableState(enabled);

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const preferences: Preferences = stored ? JSON.parse(stored) : { ...DEFAULT_PREFERENCES };
      preferences.hideAudiobookAvailable = enabled;
      delete preferences.hideAvailable;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save preferences to localStorage:', error);
    }
  };

  // Update hideEbookAvailable preference in state and localStorage
  const setHideEbookAvailable = (enabled: boolean) => {
    if (typeof window === 'undefined') return;

    setHideEbookAvailableState(enabled);

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const preferences: Preferences = stored ? JSON.parse(stored) : { ...DEFAULT_PREFERENCES };
      preferences.hideEbookAvailable = enabled;
      delete preferences.hideAvailable;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save preferences to localStorage:', error);
    }
  };

  // Listen for storage changes in other tabs (cross-tab sync)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const preferences: Preferences = JSON.parse(e.newValue);
          // Validate cardSize is within range 1-9
          if (preferences.cardSize >= 1 && preferences.cardSize <= 9) {
            setCardSizeState(preferences.cardSize);
          }
          // Sync squareCovers preference
          setSquareCoversState(preferences.squareCovers ?? DEFAULT_PREFERENCES.squareCovers);
          // Sync hide toggles
          const { hideAudiobookAvailable: hideAB, hideEbookAvailable: hideEB } = resolveHideToggles(preferences);
          setHideAudiobookAvailableState(hideAB);
          setHideEbookAvailableState(hideEB);
        } catch (error) {
          console.error('Failed to parse preferences from storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <PreferencesContext.Provider value={{
      cardSize,
      setCardSize,
      squareCovers,
      setSquareCovers,
      hideAudiobookAvailable,
      setHideAudiobookAvailable,
      hideEbookAvailable,
      setHideEbookAvailable,
    }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
