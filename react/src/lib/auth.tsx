// Auth state + login/logout. React port of angular AuthService.
//
// Login uses the generated usePostApiAuthLogin mutation hook (mutateAsync) so
// the one-off call goes through the same idiomatic client layer as the rest of
// the app; auth state itself is kept here in this context.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePostApiAuthLogin,
  postApiAuthSwitchWorkspace,
  postApiAuthMfaVerify,
  postApiAdminImpersonationEnd,
  useGetApiAuthMe,
  type ImpersonationStartResponse,
  type LoginResponse,
  type MeResponse,
  type WorkspaceChoice,
} from '@moamen-ui/pointer-react';
import { setAuthHeader, withAuthOverride } from './api';
import {
  getItem,
  removeItem,
  setItem,
  IMPERSONATION_KEY,
  TOKEN_KEY,
  USER_KEY,
} from './storage';

/** Discriminated result of a password login (DB-11b). `pending`/`rejected`/`disabled`/
 * `no-workspace` are unchanged: the API returns those as envelope failures, so they never
 * reach here — `usePostApiAuthLogin`'s mutation throws and the caller's existing catch
 * block shows the message. */
export type LoginOutcome =
  | { status: 'ok'; user: MeResponse }
  | { status: 'choose-workspace'; workspaces: WorkspaceChoice[]; selectionToken: string }
  /** R5-61: the identity is a super admin with TOTP enabled — password verified, but no
   * session yet. `pendingToken` is the 5-minute `scope: "mfa_pending"` token, fenced
   * server-side to `POST /api/auth/mfa/verify` only; hand it to `completeMfaLogin`. */
  | { status: 'mfa_required'; pendingToken: string };

/** DB-13: everything the Shell's impersonation banner needs, plus the operator's own
 *  token so `endImpersonation` can restore it. Persisted (not just in-memory) so a page
 *  reload mid-session still shows the banner and can still end it. */
export interface ImpersonationRecord {
  operatorToken: string;
  workspaceId: string;
  workspaceName: string | null;
  expiresAt: string;
  sessionId: number;
  /** The reason the operator typed into the "View as…" dialog. Not echoed by
   *  `ImpersonationStartResponse` (only the audited session row keeps it server-side), so the
   *  caller passes it into `beginImpersonation` straight from the form it just submitted — purely
   *  a banner-display convenience, never re-validated from here. */
  reason: string;
}

interface AuthValue {
  user: MeResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** DB-13: non-null exactly while `token` is an impersonation token (view-as session). */
  impersonation: ImpersonationRecord | null;
  isImpersonating: boolean;
  /** DB-18 §11 task 4: true while the current session's workspace is paused or has a deletion
   *  scheduled (`me.workspacePausedAt` / `me.workspaceDeletionScheduledFor`). Backed by the same
   *  `/api/auth/me` query the Shell reads (same query key + staleTime, so this adds no extra
   *  request) — pages hide/disable member-adding actions (Invite, Import, New project) with it. */
  isFrozen: boolean;
  /** Resolves once password auth succeeds, either straight to `ok` or to a workspace
   * choice the caller must resolve via `switchWorkspace`. Throws on pending/rejected/
   * disabled/no-workspace (unchanged). */
  login: (email: string, password: string) => Promise<LoginOutcome>;
  /** Opens a session in `workspaceId`. Pass `selectionToken` (the 5-minute token returned
   * with `choose-workspace`) right after a picker login; omit it to switch using the
   * already-stored session token (the Shell's workspace switcher). Stores the new token/
   * user, drops every cached query (a workspace switch is a tenant change), and resolves
   * to the new user. */
  switchWorkspace: (workspaceId: string, selectionToken?: string) => Promise<MeResponse>;
  /** R5-61: completes a login that returned `mfa_required`. `pendingToken` is the scoped
   * token from that outcome (never stored); `code` is a 6-digit TOTP code or one of the
   * caller's recovery codes. Sends the token via `withAuthOverride` — same one-off-bearer
   * shape as the workspace-selection token above — and, on success, stores the resulting
   * full session exactly like a plain "ok" login. */
  completeMfaLogin: (pendingToken: string, code: string) => Promise<MeResponse>;
  /** DB-13: called right after `POST .../impersonate` succeeds. Stashes the operator's
   *  current token under `IMPERSONATION_KEY` and swaps the active token for the
   *  impersonation token — every generated hook, the request interceptor, and the
   *  Shell's own `useAuth().user` (left untouched — it is still the operator's profile)
   *  keep working unchanged. Never overwrites `USER_KEY`. `reason` is the text the caller's
   *  own "View as…" dialog just submitted — display only (§ImpersonationRecord). */
  beginImpersonation: (res: ImpersonationStartResponse, reason: string) => void;
  /** DB-13: ends the session server-side (best-effort — an already-ended/expired session
   *  404s and is treated the same) and restores the operator's own token. Safe to call
   *  whenever `isImpersonating` is true, including from the fence's own 401. */
  endImpersonation: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function readUser(): MeResponse | null {
  try {
    return JSON.parse(getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

function readImpersonation(): ImpersonationRecord | null {
  try {
    return JSON.parse(getItem(IMPERSONATION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(() => readUser());
  const [token, setToken] = useState<string | null>(() => getItem(TOKEN_KEY));
  const [impersonation, setImpersonation] = useState<ImpersonationRecord | null>(() =>
    readImpersonation(),
  );

  const queryClient = useQueryClient();
  const { mutateAsync: loginAsync } = usePostApiAuthLogin();

  // DB-18: same query key/staleTime as the Shell's own `useGetApiAuthMe` call, so this never
  // fires a second request — it just reads whatever is already cached to derive `isFrozen`.
  const { data: liveMe } = useGetApiAuthMe({
    query: { enabled: !!user && !!token, staleTime: 5 * 60_000 },
  });
  const isFrozen = !!(liveMe?.workspacePausedAt || liveMe?.workspaceDeletionScheduledFor);

  /** Stores a full ("ok") session — shared by password login and both switch-workspace
   * paths so the three call sites can't drift on what "signed in" means. */
  const applySession = useCallback(
    (res: LoginResponse) => {
      const t = res.token ?? '';
      const nextUser = (res.user ?? null) as MeResponse | null;
      setItem(TOKEN_KEY, t);
      setItem(USER_KEY, JSON.stringify(nextUser));
      setAuthHeader(t);
      setToken(t);
      setUser(nextUser);
      // A workspace switch is a tenant change — every cached query belongs to the old
      // tenant and must be treated as stale, same as logout's full clear() but without
      // dropping the (still valid) session itself.
      queryClient.invalidateQueries();
      return nextUser as MeResponse;
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      const res = await loginAsync({ data: { email, password } });
      if (res.status === 'choose-workspace') {
        return {
          status: 'choose-workspace',
          workspaces: res.workspaces ?? [],
          selectionToken: res.token ?? '',
        };
      }
      if (res.status === 'mfa_required') {
        return { status: 'mfa_required', pendingToken: res.token ?? '' };
      }
      const nextUser = applySession(res);
      return { status: 'ok', user: nextUser };
    },
    [loginAsync, applySession],
  );

  const switchWorkspace = useCallback(
    async (workspaceId: string, selectionToken?: string): Promise<MeResponse> => {
      const call = () => postApiAuthSwitchWorkspace({ workspaceId });
      const res = selectionToken ? await withAuthOverride(selectionToken, call) : await call();
      return applySession(res);
    },
    [applySession],
  );

  const completeMfaLogin = useCallback(
    async (pendingToken: string, code: string): Promise<MeResponse> => {
      const res = await withAuthOverride(pendingToken, () => postApiAuthMfaVerify({ code }));
      return applySession(res);
    },
    [applySession],
  );

  const logout = useCallback(() => {
    removeItem(TOKEN_KEY);
    removeItem(USER_KEY);
    removeItem(IMPERSONATION_KEY);
    setAuthHeader(null);
    setToken(null);
    setUser(null);
    setImpersonation(null);
    // Drop every cached query so the next user on this tab can't see the previous
    // user's data (SPA logout/login does not reload the page).
    queryClient.clear();
  }, [queryClient]);

  const beginImpersonation = useCallback(
    (res: ImpersonationStartResponse, reason: string) => {
      const operatorToken = token ?? getItem(TOKEN_KEY) ?? '';
      const record: ImpersonationRecord = {
        operatorToken,
        workspaceId: res.workspaceId ?? '',
        workspaceName: res.workspaceName ?? null,
        expiresAt: res.expiresAt ?? '',
        sessionId: res.sessionId ?? 0,
        reason,
      };
      setItem(IMPERSONATION_KEY, JSON.stringify(record));
      const impToken = res.token ?? '';
      setItem(TOKEN_KEY, impToken);
      setAuthHeader(impToken);
      setToken(impToken);
      setImpersonation(record);
      // A view-as session is a tenant change like a workspace switch — every cached
      // query belongs to whatever the operator was looking at before.
      queryClient.clear();
    },
    [token, queryClient],
  );

  const endImpersonation = useCallback(async () => {
    const record = impersonation ?? readImpersonation();
    if (!record) return;
    try {
      await postApiAdminImpersonationEnd({ sessionId: record.sessionId });
    } catch {
      // Best-effort: already ended (manually, by the sweep, or by a fence 401 that
      // got here first) is exactly as fine as ending it now — the restore below is
      // what actually matters to the operator.
    }
    setItem(TOKEN_KEY, record.operatorToken);
    setAuthHeader(record.operatorToken);
    setToken(record.operatorToken);
    removeItem(IMPERSONATION_KEY);
    setImpersonation(null);
    queryClient.clear();
  }, [impersonation, queryClient]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!user && !!token,
      isAdmin: !!user?.isAdmin,
      isSuperAdmin: !!user?.isSuperAdmin,
      impersonation,
      isImpersonating: impersonation !== null,
      isFrozen,
      login,
      switchWorkspace,
      completeMfaLogin,
      beginImpersonation,
      endImpersonation,
      logout,
    }),
    [
      user,
      token,
      impersonation,
      isFrozen,
      login,
      switchWorkspace,
      completeMfaLogin,
      beginImpersonation,
      endImpersonation,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
