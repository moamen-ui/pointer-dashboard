# AGENTS.md

> Essential context for AI agents (Claude Code, Cursor, Windsurf, opencode, …) working in this repo.

> **The Angular and Vue dashboards were retired on 2026-09-15** (last commit with all three apps:
> `6954ad2`, tag `last-three-apps`). They are preserved on branch `legacy/angular-vue` (tag
> `last-three-apps`, commit `6954ad2`) for reference only — they receive no further changes. **Only
> `react/` is maintained; any dashboard change is made here only.** Do not port work to, or expect
> parity with, the retired apps.

## The React app

The Pointer dashboard is a single React app, styled with **Tailwind CSS v4** and consuming the
generated API client:

| Framework | Dir | UI kit | API client |
|---|---|---|---|
| React | `react/` | shadcn/ui + Tailwind v4 | `@moamen-ui/pointer-react` |

## Design system (READ BEFORE ANY UI WORK)

The visual world is **"The Review Margin"** and is recorded in [DESIGN.md](DESIGN.md) (+
`.impeccable/design.json`). Tokens are canonical directly in `react/src/styles/foundation.css` —
edit it in place; there is no separate sync step. Use only foundation utilities (`bg-gutter`,
`text-state-open`, `border-border`, …), never raw Tailwind palette colors. UI strings are
canonical in `react/public/assets/i18n/{en,ar}.json`. Arabic/RTL is first-class: use logical
utilities (`ps-*`, `text-start`, `me-*`), never `left/right`.

## Shared component library (READ BEFORE BUILDING A NEW TABLE/FORM/DIALOG)

The app has its own small `shared/` component set wrapping shadcn/ui — build new list/form/dialog
UI on top of these instead of hand-rolling table/menu/field markup per page:

| Component | Location |
|---|---|
| Data table (sort, paginate, search, custom cells, trailing actions column) | `src/components/shared/data-table/` (`<DataTable>`) |
| Row actions menu | `src/components/shared/RowActionsMenu.tsx` |
| Form field wrapper (label/hint/error) | `src/components/shared/FormField.tsx` |
| State badge (glyph + label; `open\|ready\|success\|warning\|destructive\|archived\|neutral`) | `src/components/ui/badge.tsx` |
| Confirm dialog | `ConfirmDialog` |
| Tabs | `src/components/shared/Tabs.tsx` (`AppTabs`, thin wrapper — use the real `<TabsContent>` from `ui/tabs` as children) |

`RowActionItem` (`{ label, icon?, severity?, disabled?, tooltip?, onClick }`) is the shared shape for
every row's action menu — the callback (`items`/`actions`) always stays page-side so
permission/feature-gating logic never leaks into the shared component.

**Escape hatch:** `statuses` (inline-edit-every-row) and `users` (union row type: real users +
pending invites, dual menus) render every column through the table's custom-cell mechanism (a
column `cell` render fn) instead of the plain display-only path — deliberate, not a shortcut to
copy elsewhere. Every other list page should use plain columns + the `actions` callback.

## Layout & commands

```bash
cd react
export NODE_AUTH_TOKEN=$(gh auth token)   # read:packages — for the @moamen-ui API client
npm ci
npm run dev     # dev server (vite)
npm run build   # tsc -b && vite build
npm run lint    # eslint .
```

There is no `test` script in `react/package.json` today.

## API client

The typed client is a **published package** (`@moamen-ui/pointer-react`), generated + built in the
[`poitner-api`](https://github.com/moamen-ui/poitner-api) repo via Orval from that API's Swagger
spec — not generated here. To change one: update the API, run that repo's *Publish API clients*
workflow (auto-bumps), then bump the dependency in `react/package.json`. Auth: the committed
`react/.npmrc` reads `${NODE_AUTH_TOKEN}`.

**RULE — never call the API with raw `axios`/`fetch`.** Always use the generated
hooks/services from `@moamen-ui/pointer-react`. If a needed endpoint is missing from the installed
client: ensure the controller has `[Tags("X")]` and `X` is in the API's `orval.config.ts`
`filters.tags`, re-run *Publish API clients*, bump, and use the generated hook — do **not** fall
back to a raw request. `src/lib/api.ts`'s `AXIOS_INSTANCE` is only the generated client's
transport; feature code must not call it directly.

## Conventions

1. All API responses are wrapped in `Result<T>`; the app unwraps `.data`, prepends the API origin
   to `/api/*`, adds the bearer token, redirects to login on 401. Client types are the **inner**
   type.
2. Import from the package barrel (`@moamen-ui/pointer-react`), not deep paths.
3. **Styling is Tailwind v4** — prefer utility classes over hand-written/inline CSS.
4. Keep the API base in an env file; don't hardcode it in components.

## Deploy

The app → static files served by Caddy at `app.pointer.moamen.work`. Steps live in the API
repo's [`DEPLOY.md`](https://github.com/moamen-ui/poitner-api/blob/main/DEPLOY.md).
