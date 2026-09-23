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
  type LoginResponse,
  type MeResponse,
  type WorkspaceChoice,
} from '@moamen-ui/pointer-react';
import { setAuthHeader, withAuthOverride } from './api';
import {
  getItem,
  removeItem,
  setItem,
  TOKEN_KEY,
  USER_KEY,
} from './storage';

/** Discriminated result of a password login (DB-11b). `pending`/`rejected`/`disabled`/
 * `no-workspace` are unchanged: the API returns those as envelope failures, so they never
 * reach here — `usePostApiAuthLogin`'s mutation throws and the caller's existing catch
 * block shows the message. */
export type LoginOutcome =
  | { status: 'ok'; user: MeResponse }
  | { status: 'choose-workspace'; workspaces: WorkspaceChoice[]; selectionToken: string };

interface AuthValue {
  user: MeResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(() => readUser());
  const [token, setToken] = useState<string | null>(() => getItem(TOKEN_KEY));

  const queryClient = useQueryClient();
  const { mutateAsync: loginAsync } = usePostApiAuthLogin();

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

  const logout = useCallback(() => {
    removeItem(TOKEN_KEY);
    removeItem(USER_KEY);
    setAuthHeader(null);
    setToken(null);
    setUser(null);
    // Drop every cached query so the next user on this tab can't see the previous
    // user's data (SPA logout/login does not reload the page).
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!user && !!token,
      isAdmin: !!user?.isAdmin,
      isSuperAdmin: !!user?.isSuperAdmin,
      login,
      switchWorkspace,
      logout,
    }),
    [user, token, login, switchWorkspace, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
