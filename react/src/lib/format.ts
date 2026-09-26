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

// DB-20: money formatting for billing surfaces (quotes, payments, discount codes). Always uses
// the response's OWN currency (never assumes a default) and never does float math on the
// server's numbers — this only formats a value the API already computed.
export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return '—';
  const code = (currency ?? 'USD').trim().toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

// Zero-padded local date (no time) — for period-end / valid-from-until / expiry columns where
// the time-of-day isn't meaningful. Returns '—' for missing/unparseable values.
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

// Local date + time — for payment/redemption timestamps where the time matters.
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

// DB-20: converts a <input type="date"|"datetime-local"> value to an ISO string (UTC) for a
// nullable DateTime request field, or null when the field is empty/unparseable. The browser
// gives local wall-clock time; toISOString() on a valid Date always yields a UTC instant, which
// is what the server's `DateTime.SpecifyKind(..., DateTimeKind.Utc)` conversion expects.
export function localDateTimeToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

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
