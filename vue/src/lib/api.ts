// Configures the shared AXIOS_INSTANCE exported by @moamen-ui/pointer-vue.
// The package's customInstance() already unwraps the API's Result<T> envelope
// (returns data.data, throws on isSuccess === false), so all generated functions
// resolve to the inner payload (StatsResponse, LoginResponse, ...).
//
// Here we only set the baseURL from the Vite env and attach two interceptors:
//   request  → Authorization: Bearer <token> from localStorage
//   response → on 401, clear session and redirect to /login
//              on isLimitReached === true (HTTP 400), show an upgrade prompt toast
import { AXIOS_INSTANCE } from '@moamen-ui/pointer-vue';
import { getItem, removeItem, TOKEN_KEY, USER_KEY } from './storage';
import { toast } from '@/composables/useToast';

// Maps the `lever` field (e.g. "MaxProjects") to a friendly label.
// These keys match the entitlement labels in the spec and the plans.ent.* i18n keys.
const LEVER_LABELS: Record<string, string> = {
  MaxProjects: 'projects',
  MaxSeats: 'seats',
  MaxCommentsPerMonth: 'comments per month',
  MaxExtensionSites: 'extension sites',
  MaxPredefinedActionsPerProject: 'predefined actions per project',
  MaxTenantWidePredefinedActions: 'tenant-wide predefined actions',
};

function friendlyLever(lever: string | null | undefined): string {
  if (!lever) return 'usage';
  return LEVER_LABELS[lever] ?? lever.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
}

interface PlanLimit {
  lever?: string | null;
  current?: number;
  limit?: number;
}

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
        return Promise.reject(error);
      }

      // Upgrade prompt: detect isLimitReached on any 400 response.
      // Enforcement is currently OFF in prod but this interceptor is wired for when it activates.
      // See monetization-ui-spec.md §3 "IsLimitReached → upgrade prompt".
      const responseData = error?.response?.data as
        | { isLimitReached?: boolean; limit?: PlanLimit; message?: string }
        | undefined;
      if (responseData?.isLimitReached === true) {
        const lim = responseData.limit;
        const lever = friendlyLever(lim?.lever);
        const current = lim?.current;
        const limit = lim?.limit;
        let msg = `Limit reached for ${lever}`;
        if (current != null && limit != null) {
          msg += ` (${current}/${limit})`;
        }
        msg += '. Upgrade your plan to continue.';
        // Show the upgrade prompt as a persistent toast (10 s).
        // TODO: replace with a modal or navigation to /plans when payment integration exists.
        toast(msg, 10000);
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
