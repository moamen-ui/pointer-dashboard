// Formats a user's access-request timestamp (createdAt, ISO-8601 UTC) for
// display as dd-MM-yyyy HH:mm — zero-padded date, 24-hour local time.
// Returns '' for missing/unparseable values; callers render their own fallback.
export function formatRequestedAt(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** i18next `t` — kept minimal so callers don't need the full react-i18next type. */
type Translate = (key: string, opts?: Record<string, unknown>) => string;

// Relative "time ago" for comment/reply timestamps, via the existing `time.*` i18n
// namespace (daysAgo/hoursAgo/minutesAgo/justNow) that NotificationsBell duplicated
// inline — this is the one shared implementation.
export function formatRelativeTime(t: Translate, value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return t('time.justNow');
  if (seconds < 3600) return t('time.minutesAgo', { n: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('time.hoursAgo', { n: Math.floor(seconds / 3600) });
  return t('time.daysAgo', { n: Math.floor(seconds / 86400) });
}
