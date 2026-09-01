# AGENTS.md

> Essential context for AI agents (Claude Code, Cursor, Windsurf, opencode, …) working in this repo.

## Multi-client parity (READ FIRST)

The Pointer dashboard is a **monorepo of per-framework apps** with the **same features and UX**, each
consuming its matching API client and styled with **Tailwind CSS v4**:

| Framework | Dir | UI kit | API client |
|---|---|---|---|
| Angular | `angular/` | Angular Material + Tailwind v4 | `@moamen-ui/pointer-angular` |
| React | `react/` | shadcn/ui + Tailwind v4 | `@moamen-ui/pointer-react` |
| Vue 3 | `vue/` | shadcn-vue + Tailwind v4 | `@moamen-ui/pointer-vue` |

**Rule:** when you implement **any** task — feature, bug fix, refactor, UI/style change, copy change —
**apply it to every app that exists** (`angular/`, `react/`, `vue/`), keeping them at feature parity.
Never change one app and leave the others behind. If something is genuinely framework-specific, state
that explicitly and explain why it can't be mirrored.

**Use subagents for cross-app work:** dispatch **one subagent per app** to implement the change in
parallel — the work is independent. Give each a self-contained brief (the task + that app's stack),
then review all results and confirm parity (behavior, routes, labels, states) before finishing.

## Shared component library (READ BEFORE BUILDING A NEW TABLE/FORM/DIALOG)

Every app has its own small `shared/` component set wrapping that framework's UI kit — build new
list/form/dialog UI on top of these instead of hand-rolling table/menu/field markup per page:

| Component | Angular | React / Vue |
|---|---|---|
| Data table (sort, paginate, search, custom cells, trailing actions column) | `src/app/shared/data-table/` (`<app-data-table>` + `appDataTableCell` directive) | `src/components/shared/data-table/` (`<DataTable>` / `<DataTable>`, `#cell-<key>` scoped slots in Vue) |
| Row actions menu | `src/app/shared/row-actions-menu/` | `src/components/shared/RowActionsMenu.{tsx,vue}` |
| Form field wrapper (label/hint/error) | `src/app/shared/form-field/` | `src/components/shared/FormField.{tsx,vue}` |
| Severity badge (`primary\|success\|warning\|danger\|neutral`) | `src/app/shared/badge/` | `src/components/ui/badge.{tsx}` / `ui/badge/` |
| Confirm dialog | `src/app/shared/confirm-dialog.component.ts` + `core/confirm.service.ts` | `useConfirm` composable (Vue) / `ConfirmDialog` (React) |

`RowActionItem` (`{ label, icon?, severity?, disabled?, tooltip?, onClick }`) is the shared shape for
every row's action menu — the callback (`items`/`actions`) always stays page-side so
permission/feature-gating logic never leaks into the shared component.

**Escape hatch:** `statuses` (inline-edit-every-row) and `users` (union row type: real users +
pending invites, dual menus) render every column through the table's custom-cell mechanism
(`appDataTableCell` in Angular, a column `cell` render fn in React, a `#cell-<key>` slot in Vue)
instead of the plain display-only path — deliberate, not a shortcut to copy elsewhere. Every other
list page should use plain columns + the `actions` callback.

## Layout & commands

Each app folder is self-contained (own `package.json`, `.npmrc`, build). Run from inside it:

```bash
cd angular   # or react / vue
export NODE_AUTH_TOKEN=$(gh auth token)   # read:packages — for the @moamen-ui API client
npm install
npm start      # dev server
npm run build  # production build
```

## API client

The typed clients are **published packages** (`@moamen-ui/pointer-<framework>`), generated + built in
the [`poitner-api`](https://github.com/moamen-ui/poitner-api) repo — not generated here. To change one:
update the API, run that repo's *Publish API clients* workflow (auto-bumps), then bump the dependency
in each app. Auth: the committed per-app `.npmrc` reads `${NODE_AUTH_TOKEN}`.

**RULE — never call the API with raw `axios`/`HttpClient`/`fetch`.** Always use the generated
hooks/services from `@moamen-ui/pointer-<framework>`. If a needed endpoint is missing from the
installed client: ensure the controller has `[Tags("X")]` and `X` is in the API's `orval.config.ts`
`filters.tags`, re-run *Publish API clients*, bump, and use the generated hook — do **not** fall back
to a raw request. `src/lib/api.ts`'s `AXIOS_INSTANCE` is only the generated client's transport; feature
code must not call it directly.

## Conventions

1. All API responses are wrapped in `Result<T>`; each app unwraps `.data`, prepends the API origin to
   `/api/*`, adds the bearer token, redirects to login on 401. Client types are the **inner** type.
2. Import from the package barrel (e.g. `@moamen-ui/pointer-vue`), not deep paths.
3. **Styling is Tailwind v4** everywhere — prefer utility classes over hand-written/inline CSS.
4. Keep the API base in a per-app env file; don't hardcode it in components.

## Deploy

Each app → static files served by Caddy at `app-<framework>.pointer.moamen.work` (Angular also at
`app.pointer.moamen.work`). Steps live in the API repo's
[`DEPLOY.md`](https://github.com/moamen-ui/poitner-api/blob/main/DEPLOY.md).
