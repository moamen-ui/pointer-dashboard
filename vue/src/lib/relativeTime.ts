// Shared relative-time formatter ("Just now", "5m ago", "3h ago", "2d ago",
// falling back to a locale date beyond a week). Same buckets/keys as the
// notifications bell in Shell.vue (time.justNow / minutesAgo / hoursAgo / daysAgo).
export function formatRelativeTime(
  iso: string | null | undefined,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('time.justNow');
  if (diffMins < 60) return t('time.minutesAgo', { n: diffMins });
  if (diffHours < 24) return t('time.hoursAgo', { n: diffHours });
  if (diffDays < 7) return t('time.daysAgo', { n: diffDays });
  return date.toLocaleDateString();
}
