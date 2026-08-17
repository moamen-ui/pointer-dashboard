// Wraps the generated useGetApiStatuses() vue-query composable and exposes
// ordered catalog items plus label(value) / color(value) / displayLabel(status)
// helpers. Falls back to STATUS_FALLBACK on empty or error so the UI never
// shows blanks.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGetApiStatuses, type StatusItem } from '@moamen-ui/pointer-vue';

// CommentStatus enum values (verbatim from global constraints):
//   Open=1, ReadyToApply=2, Applied=3, Archived=4
export const STATUS_FALLBACK: StatusItem[] = [
  { value: 1, name: 'Open',         label: 'Open',      color: '#2563eb', order: 1 },
  { value: 2, name: 'ReadyToApply', label: 'Ready',     color: '#d97706', order: 2 },
  { value: 3, name: 'Applied',      label: 'Completed', color: '#16a34a', order: 3 },
  { value: 4, name: 'Archived',     label: 'Archived',  color: '#6b7280', order: 4 },
];

/** Built-in English default labels, keyed by status name. */
const BUILTIN_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_FALLBACK.map((s) => [s.name ?? '', s.label ?? '']),
);

export function useStatusCatalog() {
  const { t, te } = useI18n();
  const { data } = useGetApiStatuses();

  // Use server data when it returns items; fall back otherwise.
  const items = computed<StatusItem[]>(() => {
    const raw = data.value;
    if (!raw || raw.length === 0) return STATUS_FALLBACK;
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

  /** Localized label for readers: admin-overridden labels pass through
   *  verbatim, built-ins translate via statuses.builtin.<name>, others fall
   *  back to label/name. Never returns a raw key or undefined. */
  function displayLabel(status: StatusItem): string {
    const name = status.name ?? '';
    const label = status.label || name;
    if (!label) return '—';
    if (BUILTIN_LABELS[name] !== label) return label;
    const key = `statuses.builtin.${name}`;
    return te(key) ? t(key) : label;
  }

  /** displayLabel(status) resolved by numeric status value. */
  function displayLabelFor(value: number | undefined): string {
    const status = items.value.find((s) => s.value === value);
    return status ? displayLabel(status) : '—';
  }

  return { items, label, color, displayLabel, displayLabelFor };
}
