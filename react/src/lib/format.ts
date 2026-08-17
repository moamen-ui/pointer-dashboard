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
