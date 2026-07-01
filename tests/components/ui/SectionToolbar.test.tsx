/**
 * Component: Section Toolbar Tests
 * Documentation: documentation/frontend/components.md
 */

// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SectionToolbar } from '@/components/ui/SectionToolbar';

function renderToolbar(overrides: Partial<React.ComponentProps<typeof SectionToolbar>> = {}) {
  const props: React.ComponentProps<typeof SectionToolbar> = {
    hideAudiobookAvailable: false,
    onToggleHideAudiobookAvailable: vi.fn(),
    hideEbookAvailable: false,
    onToggleHideEbookAvailable: vi.fn(),
    squareCovers: false,
    onToggleSquareCovers: vi.fn(),
    cardSize: 5,
    onCardSizeChange: vi.fn(),
    ...overrides,
  };
  render(<SectionToolbar {...props} />);
  return props;
}

describe('SectionToolbar', () => {
  it('toggles hiding owned audiobooks independently of ebooks', () => {
    const props = renderToolbar();

    fireEvent.click(screen.getByTitle('Hide owned audiobooks (off)'));

    expect(props.onToggleHideAudiobookAvailable).toHaveBeenCalledWith(true);
    expect(props.onToggleHideEbookAvailable).not.toHaveBeenCalled();
  });

  it('toggles hiding owned ebooks independently of audiobooks', () => {
    const props = renderToolbar();

    fireEvent.click(screen.getByTitle('Hide owned ebooks (off)'));

    expect(props.onToggleHideEbookAvailable).toHaveBeenCalledWith(true);
    expect(props.onToggleHideAudiobookAvailable).not.toHaveBeenCalled();
  });

  it('reflects the "on" state for each toggle independently', () => {
    renderToolbar({ hideAudiobookAvailable: true, hideEbookAvailable: false });

    expect(screen.getByTitle('Hide owned audiobooks (on)')).toBeInTheDocument();
    expect(screen.getByTitle('Hide owned ebooks (off)')).toBeInTheDocument();
  });
});
