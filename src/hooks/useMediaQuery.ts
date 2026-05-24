'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe media-query hook. Returns false during the first render on the
 * server and the initial client render (before effects run) to avoid hydration
 * mismatch, then syncs to the real match after mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
