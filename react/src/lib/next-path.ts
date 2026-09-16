// Shared helper for the `?next=` redirect query param used by the login flow
// (AuthenticatedRoute → /login?next=… → LoginPage navigates there post-login).
// Only same-origin relative paths are ever honoured: anything else (a full
// URL, or "//host/..." which browsers treat as protocol-relative) is dropped
// so a crafted `next` value can never bounce a user off-site after login.
export function getSafeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}
