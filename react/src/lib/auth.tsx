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
import { usePostApiAuthLogin, type MeResponse } from '@moamen-ui/pointer-react';
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

  const { mutateAsync: loginAsync } = usePostApiAuthLogin();

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await loginAsync({ data: { email, password } });
      const t = res.token ?? '';
      setItem(TOKEN_KEY, t);
      setItem(USER_KEY, JSON.stringify(res.user ?? null));
      setAuthHeader(t);
      setToken(t);
      setUser(res.user ?? null);
      return res.user as MeResponse;
    },
    [loginAsync],
  );

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
