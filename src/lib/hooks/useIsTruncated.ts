/**
 * Component: useIsTruncated Hook
 * Documentation: documentation/frontend/components.md
 *
 * Returns whether the referenced element's content overflows horizontally
 * (i.e. is being clipped by `truncate` / `overflow: hidden`). Used by the
 * Interactive Search modal to render an expand-disclosure chevron only when
 * the title is actually being cut off — keeping the row clean when there's
 * nothing to disclose.
 */

import { useLayoutEffect, useState, type RefObject } from 'react';

export function useIsTruncated(ref: RefObject<HTMLElement | null>): boolean {
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return isTruncated;
}
