/**
 * Component: useIsClamped Hook
 * Documentation: documentation/frontend/components.md
 *
 * Returns whether the referenced element's content overflows vertically
 * (i.e. is being clipped by a `line-clamp-*` utility). Unlike a character-count
 * heuristic, this reacts to the element's actual rendered width, so it stays
 * correct across viewport sizes (narrower screens wrap the same text into
 * more lines, so a "long enough" threshold picked for desktop can under-count
 * on mobile). Used to show a "Read more" toggle only when text is truly cut off.
 */

import { useLayoutEffect, useState, type RefObject } from 'react';

export function useIsClamped(ref: RefObject<HTMLElement | null>, deps: unknown[] = []): boolean {
  const [isClamped, setIsClamped] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      setIsClamped(el.scrollHeight > el.clientHeight + 1);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...deps]);

  return isClamped;
}
