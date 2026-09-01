# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repository.
**[AGENTS.md](AGENTS.md) is the canonical agent guide** — this mirrors its essentials.

## Multi-client parity (READ FIRST)

The Pointer dashboard is a **monorepo of per-framework apps** with the **same features and UX**, each
consuming its matching API client (`@moamen-ui/pointer-<framework>`) and styled with **Tailwind CSS v4**:

| Framework | Dir | UI kit | API client |
|---|---|---|---|
| Angular | `angular/` | Angular Material + Tailwind v4 | `@moamen-ui/pointer-angular` |
| React | `react/` | shadcn/ui + Tailwind v4 | `@moamen-ui/pointer-react` |
| Vue 3 | `vue/` | shadcn-vue + Tailwind v4 | `@moamen-ui/pointer-vue` |

> **When you implement ANY task** — feature, bug fix, refactor, UI/style tweak, copy change —
> **apply it to EVERY app that exists** (`angular/`, `react/`, `vue/`) so they stay at parity. Don't
> update one and leave the others behind. If a change is genuinely framework-specific, call it out
> and explain why it can't be mirrored.
>
> **Use subagents:** dispatch **one subagent per app** to implement the change in parallel — the
> per-app work is independent. Give each a self-contained brief (the task + that app's stack), then
> review together and verify parity (behavior, routes, labels, states).

## Shared component library (READ BEFORE BUILDING A NEW TABLE/FORM/DIALOG)

Every app has its own small `shared/` component set wrapping that framework's UI kit — build new
list/form/dialog UI on top of these instead of hand-rolling table/menu/field markup per page:

| Component | Angular | React / Vue |
|---|---|---|
| Data table (sort, paginate, search, custom cells, trailing actions column) | `src/app/shared/data-table/` (`<app-data-table>` + `appDataTableCell` directive) | `src/components/shared/data-table/` (`<DataTable>`, `#cell-<key>` scoped slots in Vue) |
| Row actions menu | `src/app/shared/row-actions-menu/` | `src/components/shared/RowActionsMenu.{tsx,vue}` |
| Form field wrapper (label/hint/error) | `src/app/shared/form-field/` | `src/components/shared/FormField.{tsx,vue}` |
| Severity badge (`primary\|success\|warning\|danger\|neutral`) | `src/app/shared/badge/` | `src/components/ui/badge.{tsx}` / `ui/badge/` |
| Confirm dialog | `src/app/shared/confirm-dialog.component.ts` + `core/confirm.service.ts` | `useConfirm` composable (Vue) / `ConfirmDialog` (React) |

`RowActionItem` (`{ label, icon?, severity?, disabled?, tooltip?, onClick }`) is the shared shape for
every row's action menu — the callback (`items`/`actions`) always stays page-side so
permission/feature-gating logic never leaks into the shared component.

**Escape hatch:** `statuses` (inline-edit-every-row) and `users` (union row type: real users +
pending invites, dual menus) render every column through the table's custom-cell mechanism instead
of the plain display-only path — deliberate, not a shortcut to copy elsewhere. Every other list page
should use plain columns + the `actions` callback.

## Layout

Each app folder is **self-contained** (own `package.json`, `.npmrc`, build) — run commands from inside it:

```bash
cd angular   # or react / vue
export NODE_AUTH_TOKEN=$(gh auth token)   # GitHub Packages (read:packages) — for the API client
npm install
npm start     # dev server
npm run build # production build
```

The committed per-app `.npmrc` points the `@moamen-ui` scope at `npm.pkg.github.com` and reads
`${NODE_AUTH_TOKEN}` — set it before any `npm install`/`npm ci` (locally and in CI/VM builds).

## API client (READ FIRST)

The typed clients are **published packages** (`@moamen-ui/pointer-angular | -react | -vue`), generated
from the API's Swagger and built **in the API repo** — not generated here. To change one: update the
API, run the *Publish API clients* workflow in [`poitner-api`](https://github.com/moamen-ui/poitner-api)
(it auto-bumps), then bump `@moamen-ui/pointer-<framework>` in each app.

> **RULE — never call the API with raw `axios`/`HttpClient`/`fetch`.** Always use the **generated**
> hooks/services from `@moamen-ui/pointer-<framework>` (React/Vue hooks, Angular services/resources).
> If an endpoint you need is missing from the installed client, that means the client is stale or the
> API tag isn't in `orval.config.ts` `filters.tags` — **fix the source**: (1) ensure the controller has
> `[Tags("X")]` and `X` is in the orval `filters.tags`; (2) re-run the *Publish API clients* workflow
> to bump the version; (3) `npm install @moamen-ui/pointer-<fw>@<new>` and use the generated hook.
> Do **not** work around a missing hook with a raw request — that silently diverges from the typed
> client (this is exactly how the branding calls ended up on raw axios). The shared `AXIOS_INSTANCE`
> in `src/lib/api.ts` exists only as the generated client's transport (baseURL/token/401) — feature
> code must not call it directly.

## Conventions

1. All API responses are wrapped in `Result<T>`; each app unwraps `.data`, prepends the API origin to
   `/api/*`, adds the bearer token, and redirects to login on 401. Client types are the **inner** type
   (e.g. `UserResponse`, not `Result<UserResponse>`).
2. Import from the package barrel (e.g. `@moamen-ui/pointer-react`), not deep paths.
3. **Styling is Tailwind v4** in every app — prefer utility classes over hand-written/inline CSS.
4. Keep the API base in an env file per app; don't hardcode the API URL in components.

## Deploy

Each app is served as static files by Caddy on the VM at `app-<framework>.pointer.moamen.work`
(Angular also at `app.pointer.moamen.work`). Deploy config + per-app build steps live in the API
repo's [`DEPLOY.md`](https://github.com/moamen-ui/poitner-api/blob/main/DEPLOY.md).
