// UpgradePrompt — listens for the `pointer:limitReached` custom DOM event
// (fired by the axios interceptor in lib/api.ts) and shows a toast-style
// upgrade prompt.
//
// Plan enforcement is currently OFF in prod, so this will be wired but
// dormant until the backend enables it. Mount it once inside <ToastProvider>.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { LIMIT_REACHED_EVENT, type LimitReachedDetail } from '@/lib/api';

export function UpgradePrompt() {
  const { t } = useTranslation();
  const [item, setItem] = useState<LimitReachedDetail | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<LimitReachedDetail>).detail;
      setItem(detail);
    }
    window.addEventListener(LIMIT_REACHED_EVENT, handler);
    return () => window.removeEventListener(LIMIT_REACHED_EVENT, handler);
  }, []);

  if (!item) return null;

  return (
    <div className="pointer-events-auto fixed bottom-4 start-4 z-[200] flex w-[min(380px,92vw)] flex-col gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm shadow-lg dark:bg-amber-950/60">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            {t('limit.title')}
          </p>
          <p className="mt-0.5 text-amber-800 dark:text-amber-300">
            {t('limit.body', {
              lever: item.lever ?? t('limit.resource'),
              current: item.current,
              limit: item.limit,
            })}
          </p>
          <a
            href="/plans"
            className="mt-1 inline-block font-medium text-amber-900 underline hover:text-amber-700 dark:text-amber-200"
          >
            {t('limit.cta')}
          </a>
        </div>
        <button
          type="button"
          className="opacity-70 transition-opacity hover:opacity-100"
          aria-label="Dismiss"
          onClick={() => setItem(null)}
        >
          <X className="h-4 w-4 text-amber-800 dark:text-amber-200" />
        </button>
      </div>
    </div>
  );
}
