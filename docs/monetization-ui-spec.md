# Monetization Dashboard UI — Shared Spec (all 3 frameworks)

Build the same 4 features in Angular, React, and Vue. Each framework lives in its own
subdir (`angular/`, `react/`, `vue/`) with a **parallel** feature structure under
`src/features/{overview,tenants,settings,signup,projects,...}`. **Follow the existing
patterns in your own framework** — routing, i18n, the generated `@moamen-ui/pointer-<fw>`
orval client hooks/composables/services, table/form/modal components, toasts, super-admin
route guards. Do not invent new conventions; copy how `tenants` / `settings` / `roles`
pages are already built.

**Client version:** `@moamen-ui/pointer-<fw>@1.0.16` (react already installed; run
`npm install @moamen-ui/pointer-angular@1.0.16` / `-vue@1.0.16` in your subdir first).

**Definition of done:** `npm run build` passes with zero errors in your subdir; all 4
features implemented; en + ar i18n strings added following the existing i18n files.

---

## API surface (already deployed on prod `api.pointer.moamen.work`)

All responses are the `Result<T>` envelope: `{ isSuccess, message, data, isNotFound,
isConflict, isLimitReached, limit }`. The orval client returns typed hooks.

### 1. Plans admin CRUD — super-admin only (`/api/admin/plans`)
- `GET  /api/admin/plans` → `PlanAdminResponse[]`
- `POST /api/admin/plans` (body `PlanWriteDto`) → `PlanAdminResponse`
- `PATCH /api/admin/plans/{id}` (body `PlanWriteDto`) → `PlanAdminResponse`
- `DELETE /api/admin/plans/{id}` → `Result` (409 Conflict if the plan has active subscriptions — surface the message, block delete)

Client hooks (react names; angular/vue equivalents in the `plans` module):
`useGetApiAdminPlans`, `usePostApiAdminPlans`, `usePatchApiAdminPlansId`, `useDeleteApiAdminPlansId`.

**PlanAdminResponse**: `{ id, name, slug, priceMonthly, currency, interval, sortOrder,
isActive, displayState, featureBullets[], entitlements: PlanEntitlementsDto, activeSubscriptions }`

**PlanWriteDto** (create/update): `{ name, slug, priceMonthly, currency, interval,
sortOrder, isActive, displayState, featureBullets[], entitlements: PlanEntitlementsDto }`

**Enums:**
- `BillingInterval`: `0 = Monthly`, `1 = Yearly`
- `PlanDisplayState`: `0 = Visible`, `1 = ComingSoon`, `2 = Hidden`

**PlanEntitlementsDto** — all fields nullable (`int? | bool?`). A null field means "use the
platform default" — leave the input empty to send null; do NOT coerce empty→0. For int
fields, `-1` means **unlimited**. Group the form into two sections:

*Enforced* (these actually gate usage):
`maxProjects, maxSeats, maxCommentsPerMonth, extensionEnabled (bool), maxExtensionSites,
maxPredefinedActionsPerProject, maxTenantWidePredefinedActions`

*Display-only* (shown to users, not gated yet):
`retentionDays, maxEnvironments, maxActiveInvites, emailsPerMonth,
extensionCommentsPerMonth, maxPendingSuggestions, exportImportEnabled (bool),
promptSuggestionsEnabled (bool), customStatusesEnabled (bool), prioritySupport (bool)`

Labels (use for form field labels / i18n keys):
maxProjects=Projects, maxSeats=Seats, maxCommentsPerMonth=Comments / month,
extensionEnabled=Browser extension, maxExtensionSites=Extension sites,
maxPredefinedActionsPerProject=Predefined actions / project,
maxTenantWidePredefinedActions=Tenant-wide predefined actions,
retentionDays=Retention (days), maxEnvironments=Environments,
maxActiveInvites=Active invites, emailsPerMonth=Emails / month,
extensionCommentsPerMonth=Extension comments / month,
maxPendingSuggestions=Pending suggestions, exportImportEnabled=Export / import,
promptSuggestionsEnabled=Prompt suggestions, customStatusesEnabled=Custom statuses,
prioritySupport=Priority support.

**Plans admin page requirements:**
- New route `/plans` (or wherever admin pages live), guarded **super-admin only** (same
  guard the Tenants page uses — Tenants is already super-admin-gated; mirror it, and add
  the nav item next to Tenants).
- List table: Name, Slug, Price (formatted `priceMonthly` + currency + interval, or
  "Free" when 0), Active (badge), Display state (badge: Visible/Coming soon/Hidden),
  Active subscriptions count, actions (Edit, Delete).
- Delete: confirm; on 409 (`isConflict`) show the returned message ("in use") and keep the
  plan. Do NOT hard-delete client-side.
- Create/Edit modal/form: name, slug, priceMonthly (number), currency (text, default USD),
  interval (Monthly/Yearly select), sortOrder (number), isActive (toggle), displayState
  (Visible/ComingSoon/Hidden select), featureBullets (repeatable text list — one bullet
  per line or add/remove rows), and the entitlements form (two grouped sections above;
  int inputs allow empty=null and -1=unlimited with a hint; bool as tri-state or a
  checkbox that can be left "default/unset" — a simple checkbox defaulting to unchecked is
  acceptable but prefer allowing "unset"). Keep it usable; this is an operator tool.

### 2. Tenants page — plan column + change-plan action (super-admin, existing page)
`TenantResponse` now includes `planName: string|null` and `subscriptionStatus: string|null`.
- Add a **Plan** column showing `planName` (fallback "Free") + a small subscriptionStatus badge.
- Add a **Change plan** action: a dropdown/select of all plans (`GET /api/admin/plans`) →
  `PATCH /api/admin/tenants/{id}/plan` with body `{ planId }`
  (hook `usePatchApiAdminTenantsIdPlan`). Refetch tenants after success; toast.

### 3. IsLimitReached → upgrade prompt (global)
The `Result` envelope carries `isLimitReached: bool` and
`limit: { lever, current, limit, planId }` on any create/mutation blocked by plan
enforcement (HTTP 400). Enforcement is currently OFF in prod, but wire this now.
- In the shared API error handling layer (the orval mutator / axios-fetch interceptor /
  query-client `onError`, wherever your framework centralizes response errors), detect a
  response body with `isLimitReached === true`.
- Show an **upgrade prompt** (modal or prominent toast): explain the limit was reached for
  `lever` (map lever→friendly label, same labels as entitlements, e.g. `MaxProjects`→
  "projects"), show `current`/`limit`, and a CTA. For a workspace admin the CTA links to
  the plan/upgrade view; keep it simple — a toast with the message + "Upgrade" link is
  acceptable if a modal is heavy in your framework. Don't crash on the normal error path.

### 4. Signup — optional plan selector (`signup` feature)
The workspace signup calls `POST /api/auth/register-admin` with optional `planId`
(`RegisterAdminRequest.planId: int?`). Stakeholders never see this.
- Fetch selectable plans from the **public** endpoint `GET /api/plans`
  (`PlanPublicResponse[]`: `{ slug, name, priceMonthly, currency, interval,
  featureBullets[], displayState, sortOrder }`) — hook in the `plans` module
  (e.g. `useGetApiPlans`). This endpoint is anonymous.
- Render selectable plan cards/radios ordered by sortOrder. **Visible** (displayState 0)
  are selectable; **ComingSoon** (1) shown greyed & disabled. (Hidden already excluded.)
- Default selection = Free / none (Free means send no planId or the free plan's — the
  backend only creates a subscription for a paid, non-free plan; Free/none = today's flow).
- **Honor `?plan=<slug>` query param** if present (the landing links here with it):
  preselect that plan if it's Visible.
- Submit selected plan's `id`? — the public DTO has **no id**. So: if a non-free plan is
  selected, you must resolve its id. The register-admin endpoint takes `planId` (int).
  Since the public endpoint gives only slug, and admin plans list requires super-admin,
  **pass the slug through**: send `planId` only when you can resolve it. SIMPLEST correct
  approach given the API: the signup page selects by slug for display, but the backend
  matches by id. Since anonymous signup can't list ids, keep the selector **display-only
  marketing** unless the API exposes an id. → **Decision: the public `/api/plans` will be
  treated as marketing display; on signup, send `planId` = null for Free, and for a paid
  plan, the selector is informational (backend defaults to Free until payment exists).**
  Implement the selector UI (cards, preselect from `?plan=`), and submit `planId: null`
  for now (no paid plan is purchasable pre-payment-integration). Add a code comment saying
  this is intentional until payment integration + an id-bearing public endpoint exist.

---

## i18n
Add en + ar keys for every new label following your framework's existing i18n file layout
(react `src/i18n`, angular transloco JSON, vue `src/i18n`). Namespace them (e.g. `plans.*`,
`pricing.*`, `signup.plan.*`, `limit.*`). Arabic translations required (the app is bilingual).

## Out of scope
No payment/checkout. No new backend. Enforcement stays OFF (server-controlled) — feature 3
is wired but dormant.
