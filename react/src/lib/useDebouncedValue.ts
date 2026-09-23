import { useEffect, useState } from 'react';

/** Debounces a fast-changing value (e.g. a filter text input) by `delayMs` before it
 *  reaches a query param — the same 300 ms debounce features/comments/CommentsPage.tsx
 *  hand-rolls for its search box, factored out so a second filterable page doesn't
 *  duplicate the setTimeout/clearTimeout boilerplate. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
