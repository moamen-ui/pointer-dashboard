import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 * Used to switch between the desktop table/dialog/tour chrome and their mobile
 * equivalents (stacked cards, full-height sheets, no auto-opened tour prompt)
 * at the shared `(max-width: 767px)` breakpoint — the same `md` cutoff the
 * rest of the app's Tailwind `max-md:`/`md:` utilities use, so JS-driven
 * branches and CSS-driven ones never disagree.
 */
export function useMediaQuery(query: string): boolean {
  const getMatch = () =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** The one mobile breakpoint every component switching to a mobile layout shares. */
export const MOBILE_QUERY = '(max-width: 767px)';
