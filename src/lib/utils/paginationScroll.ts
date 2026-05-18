/**
 * Component: Pagination Scroll Decision Helper
 * Documentation: documentation/frontend/components.md
 *
 * Pure helper that decides whether a section page-change should scroll the
 * window and, if so, to what absolute Y. Extracted so `page.tsx` can stay
 * lean and the fit-math can be unit-tested without a real browser layout.
 */

export interface ScrollDecisionInput {
  /** Section's `getBoundingClientRect().top` (viewport-relative). */
  sectionTop: number;
  /** Section's `getBoundingClientRect().height`. */
  sectionHeight: number;
  /** `window.innerHeight`. */
  viewportHeight: number;
  /** Measured sticky app-header height. */
  headerHeight: number;
  /** `window.scrollY`. */
  scrollY: number;
  /** `document.documentElement.scrollHeight - window.innerHeight`. Used as the upper clamp. */
  maxScrollY: number;
  /** Padding between the header and the section top after a scroll. Default 8. */
  breathingRoomTop?: number;
  /** Required slack below the section to count as "fits". Default 24. */
  breathingRoomBottom?: number;
}

export type ScrollDecision =
  | { action: 'none' }
  | { action: 'scroll'; targetY: number };

/**
 * Decide whether a section page-change should scroll the window.
 *
 * Rule (locked by product brief):
 * - If the section comfortably fits below the sticky header right now → no scroll.
 * - Otherwise → snap the section's top to just below the header, with breathing room.
 * - Always clamp the target into `[0, maxScrollY]` so paging structurally cannot
 *   scroll the section out of the viewport.
 */
export function decideScrollForPageChange(input: ScrollDecisionInput): ScrollDecision {
  const {
    sectionTop,
    sectionHeight,
    viewportHeight,
    headerHeight,
    scrollY,
    maxScrollY,
    breathingRoomTop = 8,
    breathingRoomBottom = 24,
  } = input;

  const availableHeight = viewportHeight - headerHeight;
  const requiredHeight = sectionHeight + breathingRoomTop + breathingRoomBottom;

  if (requiredHeight <= availableHeight) {
    return { action: 'none' };
  }

  const desired = sectionTop + scrollY - headerHeight - breathingRoomTop;
  const upper = Math.max(0, maxScrollY);
  const targetY = Math.min(Math.max(0, desired), upper);

  return { action: 'scroll', targetY };
}
