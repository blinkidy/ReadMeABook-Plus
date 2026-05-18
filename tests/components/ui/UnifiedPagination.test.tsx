/**
 * Component: Unified Pagination Tests
 * Documentation: documentation/frontend/components.md
 */

// @vitest-environment jsdom

import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnifiedPagination, PaginationSection } from '@/components/ui/UnifiedPagination';

type ObserverEntry = {
  isIntersecting: boolean;
  intersectionRatio: number;
  target: Element;
};

function makeSections(
  overrides?: Partial<PaginationSection>[]
): [PaginationSection, PaginationSection] {
  const defaults: [PaginationSection, PaginationSection] = [
    {
      label: 'Popular',
      accentColor: 'bg-blue-500',
      currentPage: 1,
      totalPages: 3,
      onPageChange: vi.fn(),
      sectionRef: { current: document.createElement('section') },
      onScrollToSection: vi.fn(),
    },
    {
      label: 'New Releases',
      accentColor: 'bg-emerald-500',
      currentPage: 1,
      totalPages: 2,
      onPageChange: vi.fn(),
      sectionRef: { current: document.createElement('section') },
      onScrollToSection: vi.fn(),
    },
  ];

  if (overrides) {
    overrides.forEach((o, i) => {
      if (o) Object.assign(defaults[i], o);
    });
  }

  return defaults;
}

describe('UnifiedPagination', () => {
  const observers: {
    callback: IntersectionObserverCallback;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];

  beforeEach(() => {
    observers.length = 0;

    class MockIntersectionObserver {
      callback: IntersectionObserverCallback;
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn();

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        observers.push(this);
      }
    }

    (global as any).IntersectionObserver = MockIntersectionObserver;
  });

  it('renders nothing when both sections have only one page', () => {
    const sections = makeSections([{ totalPages: 1 }, { totalPages: 1 }]);
    const { container } = render(
      <UnifiedPagination
        sections={sections}
        activeIndex={0}
        onDominantSectionChange={vi.fn()}
      />
    );
    // The pill should be hidden (pointer-events-none, opacity-0)
    const root = container.querySelector('div.fixed') as HTMLElement;
    expect(root).toHaveClass('pointer-events-none');
  });

  it('is visible by default on the homepage main content (no footer in view)', () => {
    const sections = makeSections();
    const { container } = render(
      <UnifiedPagination
        sections={sections}
        activeIndex={0}
        onDominantSectionChange={vi.fn()}
      />
    );

    const root = container.querySelector('div.fixed') as HTMLElement;
    // Pill shows immediately — no longer gated on a section being intersected.
    // This is what keeps it visible in the CTA-card gap between last section and footer.
    expect(root).toHaveClass('opacity-100');
  });

  it('hides when footer becomes visible', () => {
    const sections = makeSections();
    const footerRef = { current: document.createElement('footer') };
    const { container } = render(
      <UnifiedPagination
        sections={sections}
        footerRef={footerRef}
        activeIndex={0}
        onDominantSectionChange={vi.fn()}
      />
    );

    const root = container.querySelector('div.fixed') as HTMLElement;

    // Make section visible
    act(() => {
      observers[0].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.5,
            target: sections[0].sectionRef.current as Element,
          } as ObserverEntry,
        ],
        observers[0] as unknown as IntersectionObserver
      );
    });

    expect(root).toHaveClass('opacity-100');

    // Footer observer is the 3rd (index 2): section0, section1, footer
    act(() => {
      observers[2].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.1,
            target: footerRef.current as Element,
          } as ObserverEntry,
        ],
        observers[2] as unknown as IntersectionObserver
      );
    });

    expect(root).toHaveClass('opacity-0');
  });

  it('calls onPageChange for prev/next buttons', () => {
    const sections = makeSections([{ currentPage: 2, totalPages: 4 }]);
    render(
      <UnifiedPagination
        sections={sections}
        activeIndex={0}
        onDominantSectionChange={vi.fn()}
      />
    );

    // Make section visible so controls render interactably
    act(() => {
      observers[0].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.5,
            target: sections[0].sectionRef.current as Element,
          } as ObserverEntry,
        ],
        observers[0] as unknown as IntersectionObserver
      );
    });

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(sections[0].onPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(sections[0].onPageChange).toHaveBeenCalledWith(1);
  });

  it('handles page jump input', () => {
    const sections = makeSections([{ currentPage: 2, totalPages: 5 }]);
    render(
      <UnifiedPagination
        sections={sections}
        activeIndex={0}
        onDominantSectionChange={vi.fn()}
      />
    );

    // Make section visible
    act(() => {
      observers[0].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.5,
            target: sections[0].sectionRef.current as Element,
          } as ObserverEntry,
        ],
        observers[0] as unknown as IntersectionObserver
      );
    });

    const input = screen.getByLabelText('Jump to page') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.blur(input);
    expect(sections[0].onPageChange).toHaveBeenCalledWith(4);
  });

  it('uses pointer-events-none when hidden', () => {
    const sections = makeSections();
    const footerRef = { current: document.createElement('footer') };
    const { container } = render(
      <UnifiedPagination
        sections={sections}
        footerRef={footerRef}
        activeIndex={0}
        onDominantSectionChange={vi.fn()}
      />
    );

    const root = container.querySelector('div.fixed') as HTMLElement;

    // Hide the pill by bringing the footer into view (sections + footer = 3 observers; footer is index 2).
    act(() => {
      observers[2].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.1,
            target: footerRef.current as Element,
          } as ObserverEntry,
        ],
        observers[2] as unknown as IntersectionObserver
      );
    });

    expect(root).toHaveClass('pointer-events-none');
  });

  // --- Controlled-component / lock-aware behavior ------------------------

  it('reports the observer-chosen dominant section to the parent', () => {
    const sections = makeSections();
    const onDominant = vi.fn();
    render(
      <UnifiedPagination
        sections={sections}
        activeIndex={0}
        onDominantSectionChange={onDominant}
      />
    );

    // Section 0 mildly visible
    act(() => {
      observers[0].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.2,
            target: sections[0].sectionRef.current as Element,
          } as ObserverEntry,
        ],
        observers[0] as unknown as IntersectionObserver
      );
    });

    // Section 1 dominates
    act(() => {
      observers[1].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.9,
            target: sections[1].sectionRef.current as Element,
          } as ObserverEntry,
        ],
        observers[1] as unknown as IntersectionObserver
      );
    });

    expect(onDominant).toHaveBeenCalledWith(1);
  });

  it('does NOT swap rendered controls when observer reports a different dominant (parent decides)', () => {
    const sections = makeSections([
      { currentPage: 2, totalPages: 4, label: 'Popular' },
      { currentPage: 1, totalPages: 5, label: 'New Releases' },
    ]);
    // Parent keeps activeIndex pinned to 0 regardless of what the observer reports.
    render(
      <UnifiedPagination
        sections={sections}
        activeIndex={0}
        onDominantSectionChange={vi.fn()}
      />
    );

    // Make at least one section visible so controls render
    act(() => {
      observers[0].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.5,
            target: sections[0].sectionRef.current as Element,
          } as ObserverEntry,
        ],
        observers[0] as unknown as IntersectionObserver
      );
    });

    expect(screen.getByText('Popular')).toBeInTheDocument();

    // Observer reports section 1 dominates
    act(() => {
      observers[1].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.95,
            target: sections[1].sectionRef.current as Element,
          } as ObserverEntry,
        ],
        observers[1] as unknown as IntersectionObserver
      );
    });

    // Controls still belong to section 0 — the pill is controlled.
    expect(screen.getByText('Popular')).toBeInTheDocument();
    expect(screen.queryByText('New Releases')).not.toBeInTheDocument();
    // And Next still targets section 0's onPageChange
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(sections[0].onPageChange).toHaveBeenCalledWith(3);
    expect(sections[1].onPageChange).not.toHaveBeenCalled();
  });

  it('swaps rendered controls when the parent updates activeIndex', () => {
    const sections = makeSections([
      { currentPage: 1, totalPages: 4, label: 'Popular' },
      { currentPage: 1, totalPages: 5, label: 'New Releases' },
    ]);

    // Wrapper that lets us flip activeIndex from outside.
    function Harness() {
      const [idx, setIdx] = useState(0);
      return (
        <>
          <button onClick={() => setIdx(1)}>flip</button>
          <UnifiedPagination
            sections={sections}
            activeIndex={idx}
            onDominantSectionChange={vi.fn()}
          />
        </>
      );
    }

    render(<Harness />);

    // Make at least one section visible
    act(() => {
      observers[0].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.5,
            target: sections[0].sectionRef.current as Element,
          } as ObserverEntry,
        ],
        observers[0] as unknown as IntersectionObserver
      );
    });

    expect(screen.getByText('Popular')).toBeInTheDocument();

    fireEvent.click(screen.getByText('flip'));

    expect(screen.getByText('New Releases')).toBeInTheDocument();
    expect(screen.queryByText('Popular')).not.toBeInTheDocument();
  });

  it('does not re-emit dominant when the same section continues to dominate', () => {
    const sections = makeSections();
    const onDominant = vi.fn();
    render(
      <UnifiedPagination
        sections={sections}
        activeIndex={0}
        onDominantSectionChange={onDominant}
      />
    );

    // Two callbacks both with section 0 as dominant
    act(() => {
      observers[0].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.6,
            target: sections[0].sectionRef.current as Element,
          } as ObserverEntry,
        ],
        observers[0] as unknown as IntersectionObserver
      );
    });
    act(() => {
      observers[0].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.7,
            target: sections[0].sectionRef.current as Element,
          } as ObserverEntry,
        ],
        observers[0] as unknown as IntersectionObserver
      );
    });

    // Section 0 emits `0` exactly once — de-dupe on unchanged dominant
    const zeros = onDominant.mock.calls.filter((c) => c[0] === 0);
    expect(zeros.length).toBe(1);
  });
});
