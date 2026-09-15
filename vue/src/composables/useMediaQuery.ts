import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * Reactive `window.matchMedia(query).matches`. Used to switch between the
 * desktop table and the mobile card layout (and any other `< md` branch)
 * without duplicating the breakpoint as a magic number everywhere.
 *
 * SSR/test-safe: starts `false` when `window` isn't available and only wires
 * up the listener once mounted.
 */
export function useMediaQuery(query: string) {
  const matches = ref(typeof window !== 'undefined' && window.matchMedia(query).matches);
  let mql: MediaQueryList | null = null;

  function onChange(e: MediaQueryListEvent) {
    matches.value = e.matches;
  }

  onMounted(() => {
    if (typeof window === 'undefined') return;
    mql = window.matchMedia(query);
    matches.value = mql.matches;
    // Safari < 14 only has the deprecated addListener/removeListener pair.
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
    } else {
      (mql as any).addListener(onChange);
    }
  });

  onBeforeUnmount(() => {
    if (!mql) return;
    if (mql.removeEventListener) {
      mql.removeEventListener('change', onChange);
    } else {
      (mql as any).removeListener(onChange);
    }
  });

  return matches;
}

/** The shared mobile breakpoint used across the dashboard's `< md` adaptations. */
export const MOBILE_QUERY = '(max-width: 767px)';
