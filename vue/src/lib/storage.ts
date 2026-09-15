// Centralized localStorage keys + safe accessors. The axios interceptor and the
// auth/preferences layers all read/write through here so the contract is in one place.
// Same keys as the React app.
export const TOKEN_KEY = 'pointer_token';
export const USER_KEY = 'pointer_user';
export const LANG_KEY = 'pointer_lang';
export const THEME_KEY = 'pointer_theme';
/** Last project key selected on the Comments screen (per-browser convenience default). */
export const COMMENTS_LAST_PROJECT_KEY = 'pointer_comments_last_project';

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
