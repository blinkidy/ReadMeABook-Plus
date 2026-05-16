/**
 * Component: useIsTruncated Hook Tests
 * Documentation: documentation/frontend/components.md
 */

// @vitest-environment jsdom

import React, { useRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useIsTruncated } from '@/lib/hooks/useIsTruncated';

function Probe({ scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const attach = (el: HTMLSpanElement | null) => {
    ref.current = el;
    if (el) {
      Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
      Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
    }
  };
  const truncated = useIsTruncated(ref);
  return (
    <span ref={attach} data-testid="probe" data-truncated={truncated ? 'yes' : 'no'}>
      probe
    </span>
  );
}

describe('useIsTruncated', () => {
  it('returns false when scrollWidth fits inside clientWidth', () => {
    const { getByTestId } = render(<Probe scrollWidth={80} clientWidth={120} />);
    expect(getByTestId('probe').getAttribute('data-truncated')).toBe('no');
  });

  it('returns false when scrollWidth equals clientWidth', () => {
    const { getByTestId } = render(<Probe scrollWidth={100} clientWidth={100} />);
    expect(getByTestId('probe').getAttribute('data-truncated')).toBe('no');
  });

  it('returns true when scrollWidth exceeds clientWidth', () => {
    const { getByTestId } = render(<Probe scrollWidth={400} clientWidth={120} />);
    expect(getByTestId('probe').getAttribute('data-truncated')).toBe('yes');
  });
});
