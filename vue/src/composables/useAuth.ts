// Auth state + login/logout. Vue port of react/src/lib/auth.tsx.
//
// NOTE on the client shape: in @moamen-ui/pointer-vue the GET endpoints are
// generated as *mutations* and POST /api/auth/login is generated as a *query*
// hook (usePostApiAuthLogin). Rather than fight those shapes, we call the plain
// async functions the package also exports (postApiAuthLogin) directly and keep
// auth state in this module-level reactive singleton (shared across the app).
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
