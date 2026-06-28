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
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastItem {
  id: number;
  message: string;
  tone: 'default' | 'error';
}

interface ToastValue {
  toast: (message: string, tone?: ToastItem['tone']) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastItem['tone'] = 'default') => {
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
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg',
              t.tone === 'error'
                ? 'border-destructive/40 bg-destructive text-destructive-foreground'
                : 'border-border bg-card text-card-foreground',
            )}
          >
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="opacity-70 transition-opacity hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
