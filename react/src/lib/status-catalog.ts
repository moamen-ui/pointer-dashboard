// Status catalog hook — wraps useGetApiStatuses and exposes ordered items
// plus label() / color() helpers.  Falls back to hardcoded values while the
// network request is in flight or if the server returns nothing.
import { useMemo } from 'react';
import { useGetApiStatuses, type StatusItem } from '@moamen-ui/pointer-react';

export const STATUS_FALLBACK: StatusItem[] = [
  { value: 1, name: 'Open', label: 'Open', color: '#2563eb', order: 1 },
  { value: 2, name: 'ReadyToApply', label: 'Ready', color: '#d97706', order: 2 },
  { value: 3, name: 'Applied', label: 'Completed', color: '#16a34a', order: 3 },
  { value: 4, name: 'Archived', label: 'Archived', color: '#6b7280', order: 4 },
];

export interface StatusCatalog {
  /** Statuses sorted by `order`. */
  items: StatusItem[];
  /** Human-readable label for a numeric status value. */
  label: (value: number | undefined) => string;
  /** CSS hex color for a numeric status value. */
  color: (value: number | undefined) => string;
}

export function useStatusCatalog(): StatusCatalog {
  const { data } = useGetApiStatuses();

  return useMemo<StatusCatalog>(() => {
    const raw = data && data.length > 0 ? data : STATUS_FALLBACK;
    const items = [...raw].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const byValue = new Map(items.map((s) => [s.value, s]));

    function label(value: number | undefined): string {
      if (value == null) return '—';
      return byValue.get(value)?.label ?? String(value);
    }

    function color(value: number | undefined): string {
      if (value == null) return '#6b7280';
      return byValue.get(value)?.color ?? '#6b7280';
    }

    return { items, label, color };
  }, [data]);
}
