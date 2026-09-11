// Minimal global toast/snackbar (parity with React's ToastProvider and Angular's AppToastService).
// A single <ToastHost> renders the queue at the app root.
import { reactive } from 'vue';

/** `error` is accepted as an alias of `danger` so either name reads naturally at a call site. */
export type ToastTone = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

export const toastState = reactive<{ items: Toast[] }>({ items: [] });

let nextId = 1;

export function toast(message: string, tone: ToastTone = 'default', duration = 4000): void {
  const id = nextId++;
  toastState.items.push({ id, message, tone });
  setTimeout(() => {
    const idx = toastState.items.findIndex((t) => t.id === id);
    if (idx !== -1) toastState.items.splice(idx, 1);
  }, duration);
}

export function dismissToast(id: number): void {
  const idx = toastState.items.findIndex((t) => t.id === id);
  if (idx !== -1) toastState.items.splice(idx, 1);
}
