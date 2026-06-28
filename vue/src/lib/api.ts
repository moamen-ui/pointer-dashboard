// Configures the shared AXIOS_INSTANCE exported by @moamen-ui/pointer-vue.
// The package's customInstance() already unwraps the API's Result<T> envelope
// (returns data.data, throws on isSuccess === false), so all generated functions
// resolve to the inner payload (StatsResponse, LoginResponse, ...).
//
// Here we only set the baseURL from the Vite env and attach two interceptors:
//   request  → Authorization: Bearer <token> from localStorage
//   response → on 401, clear session and redirect to /login
import { AXIOS_INSTANCE } from '@moamen-ui/pointer-vue';
import { getItem, removeItem, TOKEN_KEY, USER_KEY } from './storage';

let configured = false;

export function configureApi(): void {
  if (configured) return;
  configured = true;

  AXIOS_INSTANCE.defaults.baseURL = import.meta.env.VITE_API_BASE;

  AXIOS_INSTANCE.interceptors.request.use((config) => {
    const token = getItem(TOKEN_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  AXIOS_INSTANCE.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401) {
        removeItem(TOKEN_KEY);
        removeItem(USER_KEY);
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
      }
      return Promise.reject(error);
    },
  );
}

/** Sets/clears the Authorization default header immediately after login/logout. */
export function setAuthHeader(token: string | null): void {
  if (token) {
    AXIOS_INSTANCE.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete AXIOS_INSTANCE.defaults.headers.common.Authorization;
  }
}
