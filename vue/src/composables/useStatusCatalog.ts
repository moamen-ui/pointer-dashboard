// Wraps the generated useGetApiStatuses() vue-query composable and exposes
// ordered catalog items plus label(value) / color(value) helpers.
// Falls back to STATUS_FALLBACK on empty or error so the UI never shows blanks.
import { computed } from 'vue';
import { useGetApiStatuses, type StatusItem } from '@moamen-ui/pointer-vue';

// CommentStatus enum values (verbatim from global constraints):
//   Open=1, ReadyToApply=2, Applied=3, Archived=4
export const STATUS_FALLBACK: StatusItem[] = [
  { value: 1, name: 'Open',         label: 'Open',      color: '#2563eb', order: 1 },
  { value: 2, name: 'ReadyToApply', label: 'Ready',     color: '#d97706', order: 2 },
  { value: 3, name: 'Applied',      label: 'Completed', color: '#16a34a', order: 3 },
  { value: 4, name: 'Archived',     label: 'Archived',  color: '#6b7280', order: 4 },
];

export function useStatusCatalog() {
  const { data, isError } = useGetApiStatuses();

  // Use server data when it returns items; fall back otherwise.
  const items = computed<StatusItem[]>(() => {
    const raw = data.value;
    if (!raw || raw.length === 0 || isError.value) return STATUS_FALLBACK;
    return [...raw].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  function label(value: number | undefined): string {
    if (value == null) return '—';
    return items.value.find((s) => s.value === value)?.label ?? String(value);
  }

  function color(value: number | undefined): string {
    if (value == null) return '#6b7280';
    return items.value.find((s) => s.value === value)?.color ?? '#6b7280';
  }

  return { items, label, color };
}
