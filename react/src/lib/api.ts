// Configures the shared AXIOS_INSTANCE exported by @moamen-ui/pointer-react.
// The package's customInstance() already unwraps the API's Result<T> envelope
// (returns data.data, throws on isSuccess === false), so all generated hooks
// resolve to the inner payload (StatsResponse, LoginResponse, ...).
//
// Here we only set the baseURL from the Vite env and attach two interceptors:
//   request  → Authorization: Bearer <token> from localStorage
//   response → on 401, clear session and redirect to /login
//              on isLimitReached=true (HTTP 400) fire the upgrade-prompt event
//              on 401 while impersonating (DB-13), fire the impersonation-ended event instead
//              on 403 with X-Email-Verification-Required (DB-14), fire the verification event
import { AXIOS_INSTANCE } from '@moamen-ui/pointer-react';
import { getItem, removeItem, IMPERSONATION_KEY, LANG_KEY, TOKEN_KEY, USER_KEY } from './storage';

// ---------------------------------------------------------------------------
// DB-13 impersonation-ended event
// ---------------------------------------------------------------------------
// `ImpersonationScopeFence`/the liveness check fail a request by calling `ctx.Fail(...)`
// inside `OnTokenValidated`, which surfaces as a plain 401 (the reason lives in the
// `WWW-Authenticate` challenge header, not a JSON body `extractMessage` can read) — so
// the generic 401 handler below must not run its usual "clear session, go to /login"
// path while an impersonation record is on file: the operator still has a perfectly
// good session to go back to. `reason: 'readonly'` is the scope fence rejecting a
// write (the session is still live); everything else (ended manually, swept as
// expired, or any other validation failure) is treated as `'ended'`. The Shell owns
// restoring the operator's token and toasting — this module only reports the fact,
// the same shape as `LIMIT_REACHED_EVENT` below.
export type ImpersonationEndedReason = 'readonly' | 'ended';
export const IMPERSONATION_ENDED_EVENT = 'pointer:impersonationEnded';

export function dispatchImpersonationEnded(reason: ImpersonationEndedReason): void {
  window.dispatchEvent(new CustomEvent<ImpersonationEndedReason>(IMPERSONATION_ENDED_EVENT, { detail: reason }));
}

// ---------------------------------------------------------------------------
// DB-14 e-mail verification gate — 403 + X-Email-Verification-Required event
// ---------------------------------------------------------------------------
// `RequireVerifiedEmailFilter` (API) refuses an unverified identity's admin write with a 403
// carrying response header `X-Email-Verification-Required: true` (CORS-exposed) and a body
// message (`MessageKeys.Auth.EmailNotVerified`). Like `LIMIT_REACHED_EVENT` below, this module
// cannot itself render a toast (no ToastProvider here), so it only reports the fact — the Shell
// (mounted for every authenticated route) listens and shows the banner's toast with a "Resend
// link" action, in place of whatever generic message the failing mutation's own onError would
// otherwise show.
export interface VerificationRequiredDetail {
  message: string;
}

export const VERIFICATION_REQUIRED_EVENT = 'pointer:verificationRequired';
const VERIFICATION_FALLBACK_MESSAGE: Record<'en' | 'ar', string> = {
  en: 'Verify your e-mail address to do this — check your inbox or resend the link from your profile.',
  ar: 'تحقق من عنوان بريدك الإلكتروني للقيام بذلك — راجع بريدك الوارد أو أعد إرسال الرابط من صفحة حسابك.',
};

export function dispatchVerificationRequired(message: string | undefined): void {
  const lang = getItem(LANG_KEY) === 'ar' ? 'ar' : 'en';
  window.dispatchEvent(
    new CustomEvent<VerificationRequiredDetail>(VERIFICATION_REQUIRED_EVENT, {
      detail: { message: message || VERIFICATION_FALLBACK_MESSAGE[lang] },
    }),
  );
}

// ---------------------------------------------------------------------------
// DB-13 client-side write pre-flight (belt-and-braces on top of the server fence)
// ---------------------------------------------------------------------------
// `ImpersonationScopeFence.Allows` (API/Extensions/ImpersonationScopeFence.cs) is the real
// authority — GET/HEAD/OPTIONS, plus POST .../admin/impersonation/end, exactly. Mirrored here so a
// mutating request never even leaves the browser while impersonating: every "create/edit/delete"
// button in the app is routed through a generated mutation hook (never raw axios), so gating it
// once at the transport layer covers all of them without threading `isImpersonating` through every
// page's action list — DataTable/RowActionsMenu deliberately stay ignorant of auth (their own
// documented contract). The dialog's own onError(extractMessage(e)) renders this exactly like any
// other rejected mutation, so no page needs a special case.
const IMPERSONATION_END_PATH = '/admin/impersonation/end';
const READ_ONLY_MESSAGE: Record<'en' | 'ar', string> = {
  en: 'This is a read-only operator view — the action was not sent.',
  ar: 'هذه معاينة للمشغّل للقراءة فقط — لم يتم إرسال الإجراء.',
};

function isBlockedWhileImpersonating(method: string | undefined, url: string | undefined): boolean {
  const m = (method ?? 'get').toLowerCase();
  if (m === 'get' || m === 'head' || m === 'options') return false;
  return !String(url ?? '').includes(IMPERSONATION_END_PATH);
}

function readOnlyBlockedError(): Error {
  const lang = getItem(LANG_KEY) === 'ar' ? 'ar' : 'en';
  return new Error(READ_ONLY_MESSAGE[lang]);
}

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

// ---------------------------------------------------------------------------
// DB-18 workspace-frozen event — 423 Locked + X-Workspace-Paused
// ---------------------------------------------------------------------------
// `WorkspaceFrozenFilter` (API) refuses a write (or, for a key/CLI session, any non-exempt call)
// on a paused or deletion-scheduled workspace with HTTP 423 and header `X-Workspace-Paused: true`,
// body message one of Workspace.Paused/PausedByOperator/DeletionScheduledReadOnly. Like
// `VERIFICATION_REQUIRED_EVENT` above, this module has no toast/query-client access of its own —
// it only reports the fact; the Shell (mounted for every authenticated route) invalidates `/me`
// (which carries the freeze fields the banner reads) and toasts the server's message.
export interface WorkspaceFrozenDetail {
  message: string;
}

export const WORKSPACE_FROZEN_EVENT = 'pointer:workspaceFrozen';
const WORKSPACE_FROZEN_FALLBACK_MESSAGE: Record<'en' | 'ar', string> = {
  en: 'This workspace is paused or scheduled for deletion and is read-only.',
  ar: 'مساحة العمل هذه موقوفة مؤقتًا أو مجدولة للحذف وهي للقراءة فقط.',
};

export function dispatchWorkspaceFrozen(message: string | undefined): void {
  const lang = getItem(LANG_KEY) === 'ar' ? 'ar' : 'en';
  window.dispatchEvent(
    new CustomEvent<WorkspaceFrozenDetail>(WORKSPACE_FROZEN_EVENT, {
      detail: { message: message || WORKSPACE_FROZEN_FALLBACK_MESSAGE[lang] },
    }),
  );
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

// ---------------------------------------------------------------------------
// One-off Authorization override (DB-11b)
// ---------------------------------------------------------------------------
// The generated `postApiAuthSwitchWorkspace` (like every Orval-generated call) takes no
// per-request config — the mutator builds a fixed `{ url, method, headers, data, signal }`
// object internally, so there is no way to hand it a custom header at the call site. The
// login-time workspace picker needs exactly that: the response's 5-minute *selection*
// token, never the stored session token (there may be none yet), and it must never be
// written to localStorage. `withAuthOverride` lets a caller supply that token for the
// duration of one async call; the request interceptor below prefers it over localStorage
// while it is set. It is intentionally module-level (not per-request) — only ever used to
// wrap a single immediate `await`, never left set across a render/await boundary.
let authOverride: string | null = null;

export async function withAuthOverride<T>(token: string, fn: () => Promise<T>): Promise<T> {
  const previous = authOverride;
  authOverride = token;
  try {
    return await fn();
  } finally {
    authOverride = previous;
  }
}

export function configureApi(): void {
  if (configured) return;
  configured = true;

  AXIOS_INSTANCE.defaults.baseURL = import.meta.env.VITE_API_BASE;

  AXIOS_INSTANCE.interceptors.request.use((config) => {
    const token = authOverride ?? getItem(TOKEN_KEY);
    // Only attach the bearer to same-API requests: relative URLs (resolved against the API
    // baseURL) or absolute URLs on the API origin. This also strips any header applied via
    // defaults.common so the JWT is never sent to a foreign origin.
    const url = config.url ?? '';
    const base = (AXIOS_INSTANCE.defaults.baseURL as string | undefined) ?? '';
    const isAbsolute = /^https?:\/\//i.test(url);
    const sameApi = !isAbsolute || (base !== '' && url.startsWith(base));
    config.headers = config.headers ?? {};
    if (token && sameApi) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }
    // Add client identifier header for all API requests
    config.headers['X-Pointer-Client'] = 'dashboard';

    if (
      token &&
      sameApi &&
      getItem(IMPERSONATION_KEY) &&
      isBlockedWhileImpersonating(config.method, config.url)
    ) {
      return Promise.reject(readOnlyBlockedError());
    }

    return config;
  });

  AXIOS_INSTANCE.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401) {
        // The end-session call itself failing (already ended/expired) is exactly what
        // `endImpersonation`'s own try/catch expects and silently absorbs — never turn
        // that into a second dispatch, or a 401 on .../end would re-trigger the very
        // handler that is already restoring the operator's token.
        const isEndCall = String(error?.config?.url ?? '').includes('/admin/impersonation/end');
        if (getItem(IMPERSONATION_KEY) && !isEndCall) {
          // Impersonating: never nuke the session or bounce to /login — the operator's
          // own token is sitting right there in IMPERSONATION_KEY. Just report which
          // kind of 401 this was; the Shell (which holds the auth context) restores it.
          const challenge = String(error?.response?.headers?.['www-authenticate'] ?? '');
          dispatchImpersonationEnded(/read-only/i.test(challenge) ? 'readonly' : 'ended');
        } else if (!getItem(IMPERSONATION_KEY)) {
          removeItem(TOKEN_KEY);
          removeItem(USER_KEY);
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.assign('/login');
          }
        }
      }

      // DB-14: an admin write refused because the caller's e-mail is unverified. The header is
      // set on every such 403 (never on a plain 401/403 from anything else), so it alone is the
      // trigger — no need to also inspect the request URL/namespace client-side.
      try {
        const flag = error?.response?.headers?.['x-email-verification-required'];
        if (error?.response?.status === 403 && String(flag ?? '').toLowerCase() === 'true') {
          const body = error?.response?.data as Record<string, unknown> | undefined;
          dispatchVerificationRequired(body?.message as string | undefined);
        }
      } catch {
        // Never let this detection crash the normal error path.
      }

      // DB-18: 423 Locked from WorkspaceFrozenFilter — the workspace is paused or has a deletion
      // scheduled. The header is set on every such 423 (verify with X-Workspace-Paused rather than
      // status alone, since 423 is otherwise unused in this API), so it alone is the trigger.
      try {
        const frozenFlag = error?.response?.headers?.['x-workspace-paused'];
        if (error?.response?.status === 423 && String(frozenFlag ?? '').toLowerCase() === 'true') {
          const body = error?.response?.data as Record<string, unknown> | undefined;
          dispatchWorkspaceFrozen(body?.message as string | undefined);
        }
      } catch {
        // Never let this detection crash the normal error path.
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
