// Mirrors react/src/lib/error.ts — pulls a human message out of an axios/Error.
// The client's customInstance throws `new Error(message)` for envelope failures,
// and axios errors carry response.data.message for HTTP errors.
export function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;

    const response = e['response'] as { data?: { message?: unknown } } | undefined;
    if (response?.data?.message) return String(response.data.message);

    const inner = e['error'];
    if (inner && typeof inner === 'object') {
      const innerMsg = (inner as Record<string, unknown>)['message'];
      if (innerMsg) return String(innerMsg);
    }

    const msg = e['message'];
    if (msg) return String(msg);
  }
  return 'Request failed';
}
