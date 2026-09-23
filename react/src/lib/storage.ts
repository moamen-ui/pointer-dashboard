// Centralized localStorage keys + safe accessors. The axios interceptor and the
// auth/preferences layers all read/write through here so the contract is in one place.
export const TOKEN_KEY = 'pointer_token';
export const USER_KEY = 'pointer_user';
export const LANG_KEY = 'pointer_lang';
export const THEME_KEY = 'pointer_theme';
/** DB-13: while a super admin is impersonating a workspace, TOKEN_KEY holds the
 *  impersonation token (so every existing call site — the request interceptor, the
 *  generated hooks — keeps working unchanged) and this key holds the JSON record
 *  needed to restore the operator's own session: `{ operatorToken, workspaceId,
 *  workspaceName, expiresAt, sessionId }`. Its mere presence is also how the app
 *  knows "a session is live" across a page reload. */
export const IMPERSONATION_KEY = 'pointer_impersonation';

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function getItem(key: string): string | null {
  return safeStorage()?.getItem(key) ?? null;
}

export function setItem(key: string, value: string): void {
  safeStorage()?.setItem(key, value);
}

export function removeItem(key: string): void {
  safeStorage()?.removeItem(key);
}
