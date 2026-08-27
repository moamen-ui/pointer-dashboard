// Install-guide auto-open policy + storage flags (React port of the Angular
// InstallGuideService policy half). The gate itself is a pure function so the
// branching is unit-testable; every storage access is guarded — private mode
// must not break the guide.

/**
 * The Chrome extension zip, served from the landing domain — deliberately NOT
 * derived from the API base (it is a marketing-site artifact, not an API asset).
 */
export const EXTENSION_ZIP_URL = 'https://pointer.moamen.work/pointer-extension.zip';

/** Per-user localStorage/sessionStorage keys for the auto-open policy. */
const SEEN_KEY = (userId: string) => `pointer_install_seen:${userId}`;
const SUPPRESSED_KEY = (userId: string) => `pointer_install_suppressed:${userId}`;
const SESSION_KEY = (userId: string) => `pointer_install_shown_session:${userId}`;

export interface AutoOpenContext {
  isAdmin: boolean;
  userId: string | null;
  /** Comments across every project the user can see. */
  commentsCount: number;
}

/**
 * Auto-open policy: a workspace admin who is either new here or has no feedback
 * yet gets the guide opened for them. An explicit "don't show again" wins over
 * both, and it opens at most once per browser session so a reload doesn't nag.
 */
export function shouldAutoOpen(ctx: AutoOpenContext): boolean {
  if (!ctx.isAdmin || ctx.userId == null) return false;
  if (flag(SUPPRESSED_KEY(ctx.userId))) return false;
  if (flag(SESSION_KEY(ctx.userId), sessionStorage)) return false;
  const firstTime = !flag(SEEN_KEY(ctx.userId));
  return firstTime || ctx.commentsCount === 0;
}

/** Records that the guide has been shown (first-time no longer applies). */
export function markShown(userId: string | null): void {
  if (userId == null) return;
  setFlag(SEEN_KEY(userId));
  setFlag(SESSION_KEY(userId), sessionStorage);
}

/** "Don't show this again" — stops every future auto-open for this user. */
export function suppress(userId: string | null): void {
  if (userId == null) return;
  setFlag(SUPPRESSED_KEY(userId));
}

/** Undoes "don't show again" when the user unticks the box. */
export function unsuppress(userId: string | null): void {
  if (userId == null) return;
  try {
    localStorage.removeItem(SUPPRESSED_KEY(userId));
  } catch {
    // ignore
  }
}

export function isSuppressed(userId: string | null): boolean {
  return userId != null && flag(SUPPRESSED_KEY(userId));
}

function flag(key: string, store: Storage = localStorage): boolean {
  try {
    return store.getItem(key) === '1';
  } catch {
    return false;
  }
}

function setFlag(key: string, store: Storage = localStorage): void {
  try {
    store.setItem(key, '1');
  } catch {
    // Private-mode storage failures must not break the guide.
  }
}

// ── Demo session (sessionStorage['pointer_demo']) ─────────────────────────

/** Demo session written by the demo provisioning flow (sessionStorage). */
export interface DemoSession {
  email?: string | null;
  password?: string | null;
  projectKey?: string | null;
  serverUrl?: string | null;
  expiresAt?: string;
  emailSent?: boolean;
}

const DEMO_SESSION_KEY = 'pointer_demo';

export function readDemoSession(): DemoSession | null {
  try {
    return JSON.parse(sessionStorage.getItem(DEMO_SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}
