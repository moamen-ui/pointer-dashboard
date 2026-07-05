# Pointer Dashboard — Review & Fixes (angular / react / vue)

**Reviewer:** Fable 5 · **Date:** 2026-07-05 · **Scope:** the three parity SPAs. Adversarial review
(one agent per app) + fixes applied at parity. All three build clean after the fixes.

## Headline

The **highest-risk surface is clean**: there are **no HTML-injection sinks** (`innerHTML`, `v-html`,
`[innerHTML]`, `dangerouslySetInnerHTML`, `bypassSecurityTrust*`) in any app, and — critically — the
admin console **never renders feedback comment bodies, author names, or the `element` capture fields**
(`snapshot` = raw third-party DOM HTML, `computedStyles`, `appliedCssRules`, …). Comment data appears
only as **aggregate integer counts** and as a downloaded export Blob (never parsed into the DOM). So the
stored-XSS-via-captured-HTML risk that would matter most for this product **does not exist** in the
current code. `Result<T>` unwrap/transport, route guards, and secrets/config are all clean in all three.

## Findings & fixes

### Medium — client query cache not cleared on logout (react, vue) — FIXED
A previous admin's TanStack/Vue Query cache (`getApiAdminUsers`, `getApiAdminTenants`, …) survived a
logout→login on the same tab (SPA nav, no reload), so the next admin could briefly see the prior user's
data. **Fix:** `queryClient.clear()` on logout — react `src/lib/auth.tsx` (via `useQueryClient()`), vue
`src/composables/useAuth.ts` (via a shared `src/lib/queryClient.ts`, also imported by `main.ts`). Angular
has no global query cache (httpResource re-fetches per route), so N/A there — framework difference.

### Medium — bearer token attached to non-API requests (all three) — FIXED
- **Angular (real leak):** `auth.interceptor.ts` attached `Authorization` **outside** the `isApiRequest`
  guard, so the same-origin i18n JSON fetch got the JWT and any future absolute-URL request would send it
  cross-origin. **Fix:** the token is now set only inside the `if (isApiRequest)` branch.
- **React / Vue (defense-in-depth):** the request interceptor attached the bearer to every
  `AXIOS_INSTANCE` request (contained today only because `baseURL` is the API and all calls are
  relative). **Fix:** attach only when the URL is relative or on the API origin, and `delete` the header
  otherwise (also neutralizes `defaults.common`), so the JWT can never reach a foreign origin.

### Low — JWT in `localStorage` (all three) — NOT changed (documented)
Standard SPA pattern; XSS-exfiltratable in principle but contained given no HTML-injection sink exists and
the API is bearer-based (no cookies). Moving to an HttpOnly cookie is an API-side change — out of scope
here; noted as future hardening.

### Low — misc correctness — FIXED
- **React:** `LoginPage` called `navigate()` during render → replaced with `<Navigate>` (avoids React's
  "update while rendering" warning / double-fire); demo-failure cleanup used `setItem(TOKEN_KEY, '')` →
  now `removeItem(TOKEN_KEY)`.
- **Angular:** `AuthService.login` used `res.token!` → now throws if the token is missing, so a
  null/absent token can't be persisted as the string `"undefined"` (which would read back truthy and
  fake an authenticated state).

## Verified clean (per app)
- **XSS / untrusted content:** no sinks; no comment/element detail view; all dynamic text is escaped
  interpolation/JSX.
- **Result<T> transport:** correct `.data` unwrap, API-origin prepend on `/api/*`, 401 clear+redirect
  (guarded against redirect loops), plan-limit envelope handling.
- **Route guards:** authenticated/admin/super-admin guards present and layered (cosmetic — API enforces).
- **Secrets/config:** only public `VITE_API_BASE` / `environment.apiBase` URLs; no committed secrets; no
  token logging.

## Build status
`react`, `vue`: `npm run build` ✓. `angular`: `ng build` ✓ (requires Node ≥ 22.22 — use node@26).
Changes are uncommitted; deploying the three static bundles to Caddy is a separate step.
