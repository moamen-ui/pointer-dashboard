// Stash for the active "Try the demo" session. Kept in sessionStorage (not
// localStorage) so it is scoped to the tab and clears when the tab closes — the
// demo credentials/snippet are only relevant for the lifetime of the demo.
export const DEMO_KEY = 'pointer_demo';

export interface DemoSession {
  email: string;
  password: string;
  projectKey: string;
  serverUrl: string;
  expiresAt: string;
}

function safeSession(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

export function getDemoSession(): DemoSession | null {
  try {
    const raw = safeSession()?.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as DemoSession) : null;
  } catch {
    return null;
  }
}

export function setDemoSession(session: DemoSession): void {
  safeSession()?.setItem(DEMO_KEY, JSON.stringify(session));
}

export function clearDemoSession(): void {
  safeSession()?.removeItem(DEMO_KEY);
}
