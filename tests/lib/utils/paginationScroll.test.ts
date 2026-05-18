/**
 * Component: Pagination Scroll Decision Helper — Tests
 * Documentation: documentation/frontend/components.md
 */

import { describe, it, expect } from 'vitest';
import { decideScrollForPageChange } from '@/lib/utils/paginationScroll';

const base = {
  viewportHeight: 1000,
  headerHeight: 64,
  scrollY: 0,
  maxScrollY: 10000,
};

describe('decideScrollForPageChange', () => {
  it('returns "none" when the section fits comfortably below the header', () => {
    // available = 1000 - 64 = 936, required = 400 + 8 + 24 = 432 → fits
    expect(
      decideScrollForPageChange({ ...base, sectionTop: 200, sectionHeight: 400 })
    ).toEqual({ action: 'none' });
  });

  it('returns "none" at exact fit (boundary inclusive)', () => {
    // required = 904 + 8 + 24 = 936 === available
    expect(
      decideScrollForPageChange({ ...base, sectionTop: 0, sectionHeight: 904 })
    ).toEqual({ action: 'none' });
  });

  it('returns "scroll" when the section is just barely too tall', () => {
    // required = 905 + 8 + 24 = 937 > 936
    const result = decideScrollForPageChange({
      ...base,
      sectionTop: 200,
      sectionHeight: 905,
    });
    expect(result.action).toBe('scroll');
  });

  it('snaps section top to under the header with breathing room', () => {
    // sectionTop 300 viewport-relative + scrollY 500 = 800 absolute; header 64; breathing 8
    // targetY = 800 - 64 - 8 = 728
    const result = decideScrollForPageChange({
      ...base,
      scrollY: 500,
      sectionTop: 300,
      sectionHeight: 2000,
    });
    expect(result).toEqual({ action: 'scroll', targetY: 728 });
  });

  it('clamps targetY to 0 when math goes negative (user already at top, tall header)', () => {
    // section is currently above viewport top → sectionTop negative
    const result = decideScrollForPageChange({
      ...base,
      scrollY: 30,
      sectionTop: -10,
      sectionHeight: 2000,
    });
    // desired = -10 + 30 - 64 - 8 = -52 → clamp to 0
    expect(result).toEqual({ action: 'scroll', targetY: 0 });
  });

  it('clamps targetY to maxScrollY when the section is at the very bottom of the page', () => {
    // Big scrollY pushes desired past maxScrollY
    const result = decideScrollForPageChange({
      ...base,
      scrollY: 9800,
      sectionTop: 500,
      sectionHeight: 2000,
      maxScrollY: 10000,
    });
    // desired = 500 + 9800 - 64 - 8 = 10228 → clamp to 10000
    expect(result).toEqual({ action: 'scroll', targetY: 10000 });
  });

  it('handles maxScrollY === 0 (page doesn\'t scroll) by clamping to 0', () => {
    const result = decideScrollForPageChange({
      ...base,
      scrollY: 0,
      sectionTop: 200,
      sectionHeight: 2000,
      maxScrollY: 0,
    });
    expect(result).toEqual({ action: 'scroll', targetY: 0 });
  });

  it('honors custom breathing-room overrides', () => {
    // bigger bottom requirement → no-longer fits
    // required = 800 + 8 + 200 = 1008 > 936
    const result = decideScrollForPageChange({
      ...base,
      sectionTop: 0,
      sectionHeight: 800,
      breathingRoomBottom: 200,
    });
    expect(result.action).toBe('scroll');
  });

  it('produces a target consistent with snapping section top under the header', () => {
    // Sanity: targetY + headerHeight + breathing should equal (sectionTop + scrollY).
    const sectionTop = 450;
    const scrollY = 250;
    const headerHeight = 64;
    const breathingRoomTop = 8;
    const result = decideScrollForPageChange({
      ...base,
      scrollY,
      headerHeight,
      sectionTop,
      sectionHeight: 2000,
    });
    if (result.action !== 'scroll') throw new Error('expected scroll');
    expect(result.targetY + headerHeight + breathingRoomTop).toBe(sectionTop + scrollY);
  });
});
