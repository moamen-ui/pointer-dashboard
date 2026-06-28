// Auth state + login/logout. Vue port of react/src/lib/auth.tsx.
//
// The package exposes a usePostApiAuthLogin() mutation hook, but it can only be
// instantiated inside a component's setup() (it relies on Vue Query's injected
// QueryClient + lifecycle). Auth here is a module-level reactive singleton shared
// across the whole app and `login` is plain async, so we call the package's plain
// postApiAuthLogin function directly rather than bind a hook to one component.
import { computed, ref } from 'vue';
import { postApiAuthLogin, type MeResponse } from '@moamen-ui/pointer-vue';
import { setAuthHeader } from '@/lib/api';
import { getItem, removeItem, setItem, TOKEN_KEY, USER_KEY } from '@/lib/storage';

function readUser(): MeResponse | null {
  try {
    return JSON.parse(getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

const user = ref<MeResponse | null>(readUser());
const token = ref<string | null>(getItem(TOKEN_KEY));

const isAuthenticated = computed(() => !!user.value && !!token.value);
const isAdmin = computed(() => !!user.value?.isAdmin);

/** Resolves to the logged-in user; throws on failure. */
async function login(email: string, password: string): Promise<MeResponse> {
  const res = await postApiAuthLogin({ email, password });
  const t = res.token ?? '';
  setItem(TOKEN_KEY, t);
  setItem(USER_KEY, JSON.stringify(res.user ?? null));
  setAuthHeader(t);
  token.value = t;
  user.value = res.user ?? null;
  return res.user as MeResponse;
}

function logout(): void {
  removeItem(TOKEN_KEY);
  removeItem(USER_KEY);
  setAuthHeader(null);
  token.value = null;
  user.value = null;
}

export function useAuth() {
  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    login,
    logout,
  };
}
