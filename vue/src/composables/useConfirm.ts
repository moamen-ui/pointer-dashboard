// Global confirmation dialog state. A single <ConfirmHost> lives at the app root
// and renders a shadcn-vue Dialog driven by this state. Pages call confirm(...)
// which returns a Promise<boolean> — replacing window.confirm with an accessible,
// themed, RTL-aware dialog (parity with the Angular ConfirmDialogComponent).
import { reactive } from 'vue';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'destructive' renders the confirm button in the destructive variant. */
  confirmVariant?: 'default' | 'destructive';
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((ok: boolean) => void) | null;
}

export const confirmState = reactive<ConfirmState>({
  open: false,
  message: '',
  resolve: null,
});

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    confirmState.title = opts.title;
    confirmState.message = opts.message;
    confirmState.confirmLabel = opts.confirmLabel;
    confirmState.cancelLabel = opts.cancelLabel;
    confirmState.confirmVariant = opts.confirmVariant ?? 'default';
    confirmState.resolve = resolve;
    confirmState.open = true;
  });
}

export function settleConfirm(ok: boolean): void {
  confirmState.open = false;
  confirmState.resolve?.(ok);
  confirmState.resolve = null;
}
