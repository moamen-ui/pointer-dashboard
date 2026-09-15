import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type EmptyStateVariant = 'empty' | 'no-results' | 'error';

/**
 * `lottie-react` pulls in lottie-web (~470 kB). Importing it statically put the whole player in
 * the entry chunk and took main from 926 kB to 1,513 kB. `lazy()` splits it into its own chunk,
 * fetched only when an empty state first renders — the same split Angular gets for free from
 * `provideLottieOptions({ player: () => import('lottie-web') })`.
 */
const Lottie = lazy(() => import('lottie-react').then((m) => ({ default: m.Lottie })));

interface EmptyStateProps {
  /** @deprecated ignored — kept for back-compat with older call sites. */
  icon?: LucideIcon;
  /** Which illustration animation to show. Default `'empty'`. */
  variant?: EmptyStateVariant;
  /** A caller-supplied message ALWAYS wins over the variant's default copy. */
  message?: string;
  /** A caller-supplied hint ALWAYS wins over the variant's default copy. */
  hint?: string;
  children?: ReactNode;
}

/**
 * Same reasoning for the payloads (~114 kB across the three): only the variant actually on screen
 * is fetched. Canonical sources are design/illustrations/{empty,no-results,error}.json, copied
 * verbatim into src/assets/lottie/.
 */
const loadAnimation: Record<EmptyStateVariant, () => Promise<{ default: object }>> = {
  empty: () => import('../assets/lottie/empty.json'),
  'no-results': () => import('../assets/lottie/no-results.json'),
  error: () => import('../assets/lottie/error.json'),
};

function usePrefersReducedMotion() {
  const [prefersReducedMotion] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  return prefersReducedMotion;
}

/** Fetches just the active variant's animation; null until its chunk lands. */
function useAnimationData(variant: EmptyStateVariant) {
  const [data, setData] = useState<object | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    void loadAnimation[variant]().then((m) => {
      if (!cancelled) setData(m.default);
    });
    return () => {
      cancelled = true;
    };
  }, [variant]);
  return data;
}

/**
 * Empty state per §3 brief + comment #192: a leading illustration animation that
 * names the current table state, copy beside it, and an optional trailing action.
 * `variant` picks the animation and the fallback copy (`table.emptyDefault` /
 * `table.error` + `table.errorHint`); `'no-results'` has no fallback — the caller always
 * passes the query-aware string. A caller-supplied `message`/`hint` always wins.
 * No icon-in-circle (the `icon` param stays ignored for back-compat).
 */
export function EmptyState({
  icon: _Icon,
  variant = 'empty',
  message,
  hint,
  children,
}: EmptyStateProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const animationData = useAnimationData(variant);

  const resolvedMessage =
    message || (variant === 'empty' ? t('table.emptyDefault') : variant === 'error' ? t('table.error') : '');
  const resolvedHint = hint || (variant === 'error' ? t('table.errorHint') : undefined);

  return (
    /* Comment #193: the illustration leads, big, with the copy stacked underneath it and the
       action last — never side-by-side. The animations are square (256², 320², 75²), so the box
       is square too; the old 120x72 letterboxed them down to an effective 72px. */
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
      {/* Fixed footprint so nothing reflows while the player/payload chunks load. */}
      <div className="w-[160px] h-[160px] flex-none" aria-hidden="true">
        {animationData && (
          <Suspense fallback={null}>
            <Lottie
              src={animationData}
              loop={!prefersReducedMotion}
              autoplay={!prefersReducedMotion}
              className="w-full h-full"
            />
          </Suspense>
        )}
      </div>
      <div className="min-w-0 max-w-sm" role={variant === 'error' ? 'alert' : undefined}>
        {resolvedMessage && <p className="text-[14px] text-muted-foreground">{resolvedMessage}</p>}
        {resolvedHint && <p className="mt-1 text-[13px] text-faint-foreground">{resolvedHint}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}
