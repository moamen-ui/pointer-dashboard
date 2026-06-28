// Minimal global toast/snackbar (parity with Angular's MatSnackBar usage).
// A single <ToastHost> renders the queue at the app root.
import { reactive } from 'vue';

export interface Toast {
  id: number;
  message: string;
}

export const toastState = reactive<{ items: Toast[] }>({ items: [] });

let nextId = 1;

export function toast(message: string, duration = 4000): void {
  const id = nextId++;
  toastState.items.push({ id, message });
  setTimeout(() => {
    const idx = toastState.items.findIndex((t) => t.id === id);
    if (idx !== -1) toastState.items.splice(idx, 1);
  }, duration);
}
