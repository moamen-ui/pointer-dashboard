// Auth state + login/logout. React port of angular AuthService.
//
// NOTE on the client shape: in @moamen-ui/pointer-react the GET endpoints are
// generated as *mutations* and POST /api/auth/login is generated as a *query*
// hook (usePostApiAuthLogin). Rather than fight those shapes, we call the plain
// async functions the package also exports (postApiAuthLogin) directly and keep
// auth state in this context.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { postApiAuthLogin, type MeResponse } from '@moamen-ui/pointer-react';
import { setAuthHeader } from './api';
import {
  getItem,
  removeItem,
  setItem,
  TOKEN_KEY,
  USER_KEY,
} from './storage';

interface AuthValue {
  user: MeResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** Resolves to the logged-in user; throws on failure. */
  login: (email: string, password: string) => Promise<MeResponse>;
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

  const login = useCallback(async (email: string, password: string) => {
    const res = await postApiAuthLogin({ email, password });
    const t = res.token ?? '';
    setItem(TOKEN_KEY, t);
    setItem(USER_KEY, JSON.stringify(res.user ?? null));
    setAuthHeader(t);
    setToken(t);
    setUser(res.user ?? null);
    return res.user as MeResponse;
  }, []);

  const logout = useCallback(() => {
    removeItem(TOKEN_KEY);
    removeItem(USER_KEY);
    setAuthHeader(null);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!user && !!token,
      isAdmin: !!user?.isAdmin,
      login,
      logout,
    }),
    [user, token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
