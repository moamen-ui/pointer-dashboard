// Configures the shared AXIOS_INSTANCE exported by @moamen-ui/pointer-react.
// The package's customInstance() already unwraps the API's Result<T> envelope
// (returns data.data, throws on isSuccess === false), so all generated hooks
// resolve to the inner payload (StatsResponse, LoginResponse, ...).
//
// Here we only set the baseURL from the Vite env and attach two interceptors:
//   request  → Authorization: Bearer <token> from localStorage
//   response → on 401, clear session and redirect to /login
//              on isLimitReached=true (HTTP 400) fire the upgrade-prompt event
import { AXIOS_INSTANCE } from '@moamen-ui/pointer-react';
import { getItem, removeItem, TOKEN_KEY, USER_KEY } from './storage';

// ---------------------------------------------------------------------------
// IsLimitReached upgrade-prompt event
// ---------------------------------------------------------------------------
// When the API returns a 400 with isLimitReached===true (plan enforcement),
// we fire a custom DOM event so the UpgradePrompt component can react without
// prop-drilling.  Enforcement is currently OFF in prod — this is wired but
// dormant until the backend enables it.
export interface LimitReachedDetail {
  lever: string | null;
  current: number;
  limit: number;
  planId: number | undefined;
  message: string;
}

export const LIMIT_REACHED_EVENT = 'pointer:limitReached';

export function dispatchLimitReached(detail: LimitReachedDetail): void {
  window.dispatchEvent(new CustomEvent<LimitReachedDetail>(LIMIT_REACHED_EVENT, { detail }));
}

// Friendly label map from the spec (lever → display label)
const LEVER_LABELS: Record<string, string> = {
  MaxProjects: 'projects',
  MaxSeats: 'seats',
  MaxCommentsPerMonth: 'comments / month',
  ExtensionEnabled: 'browser extension',
  MaxExtensionSites: 'extension sites',
  MaxPredefinedActionsPerProject: 'predefined actions / project',
  MaxTenantWidePredefinedActions: 'tenant-wide predefined actions',
};

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

      // Detect plan-enforcement limit-reached responses (HTTP 400 with isLimitReached).
      // Enforcement is currently OFF in prod — this runs but will never fire until
      // the backend enables it. We fire a custom event rather than crash.
      try {
        const body = error?.response?.data as Record<string, unknown> | undefined;
        if (error?.response?.status === 400 && body?.isLimitReached === true) {
          const limit = body.limit as Record<string, unknown> | undefined;
          const lever = (limit?.lever as string | null) ?? null;
          const friendlyLever = lever ? (LEVER_LABELS[lever] ?? lever) : 'resource';
          dispatchLimitReached({
            lever: friendlyLever,
            current: (limit?.current as number) ?? 0,
            limit: (limit?.limit as number) ?? 0,
            planId: limit?.planId as number | undefined,
            message: (body.message as string) ?? `You have reached the ${friendlyLever} limit.`,
          });
        }
      } catch {
        // Never let the limit-reached detection crash the normal error path.
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
