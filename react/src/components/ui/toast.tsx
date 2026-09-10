// Minimal toast system — the React equivalent of Angular's MatSnackBar.
// A context exposes `toast(message)`; the <Toaster /> (mounted once in App)
// renders transient messages bottom-end and auto-dismisses them.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CircleAlert, CircleCheck, CircleHelp, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** `error` is kept as an alias of `danger` so existing call sites keep working. */
export type ToastTone = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'error';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastValue {
  toast: (message: string, tone?: ToastTone) => void;
}

// A toast is a floating layer, so it keeps the canvas-and-menu-shadow grammar; the state hue
// lands on the glyph and the hairline rather than filling the surface. Rarity gives it force.
const TONES: Record<Exclude<ToastTone, 'error'>, { border: string; icon: string; Glyph: React.ComponentType<{ className?: string }> | null }> = {
  default: { border: 'border-border', icon: '', Glyph: null },
  info: { border: 'border-state-open/40', icon: 'text-state-open', Glyph: CircleHelp },
  success: { border: 'border-state-completed/40', icon: 'text-state-completed', Glyph: CircleCheck },
  warning: { border: 'border-state-ready/40', icon: 'text-state-ready', Glyph: Clock },
  danger: { border: 'border-state-danger/40', icon: 'text-state-danger', Glyph: CircleAlert },
};

const ToastContext = createContext<ToastValue | null>(null);

const DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'default') => {
      const id = nextId.current++;
      setItems((cur) => [...cur, { id, message, tone }]);
      window.setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss],
  );

  const value = useMemo<ToastValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 end-4 z-[100] flex w-[min(360px,92vw)] flex-col gap-2">
        {items.map((t) => {
          const tone = TONES[t.tone === 'error' ? 'danger' : t.tone];
          const Glyph = tone.Glyph;
          return (
            <div
              key={t.id}
              role="status"
              aria-live="polite"
              className={cn(
                'pointer-events-auto flex items-start gap-2 rounded-md border bg-card px-4 py-3 text-[14px] text-card-foreground shadow-menu',
                tone.border,
              )}
            >
              {Glyph && <Glyph className={cn('mt-0.5 h-4 w-4 shrink-0', tone.icon)} />}
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
