# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repository.
**[AGENTS.md](AGENTS.md) is the canonical agent guide** — this mirrors its essentials.

> **The Angular and Vue dashboards were retired on 2026-09-15** (last commit with all three apps:
> `6954ad2`, tag `last-three-apps`). They are preserved on branch `legacy/angular-vue` (tag
> `last-three-apps`, commit `6954ad2`) for reference only. **Only `react/` is maintained; any
> dashboard change is made here only.**

## The React app (READ FIRST)

The Pointer dashboard is a single React app, consuming the generated API client
(`@moamen-ui/pointer-react`) and styled with **Tailwind CSS v4**:

| Framework | Dir | UI kit | API client |
|---|---|---|---|
| React | `react/` | shadcn/ui + Tailwind v4 | `@moamen-ui/pointer-react` |

## Design system (READ BEFORE ANY UI WORK)

The visual world is **"The Review Margin"** and is recorded in [DESIGN.md](DESIGN.md) (+
`.impeccable/design.json`). Tokens are canonical directly in `react/src/styles/foundation.css` —
edit it in place; there is no separate sync step anymore. Use only foundation utilities
(`bg-gutter`, `text-state-open`, `border-border`, …), never raw Tailwind palette colors. UI strings
are canonical in `react/public/assets/i18n/{en,ar}.json`. Arabic/RTL is first-class: use logical
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
pending invites, dual menus) render every column through the table's custom-cell mechanism instead
of the plain display-only path — deliberate, not a shortcut to copy elsewhere. Every other list page
should use plain columns + the `actions` callback.

## Layout

Run commands from inside `react/`:

```bash
cd react
export NODE_AUTH_TOKEN=$(gh auth token)   # GitHub Packages (read:packages) — for the API client
npm ci
npm run dev     # dev server (vite)
npm run build   # tsc -b && vite build
npm run lint    # eslint .
```

There is no `test` script in `react/package.json` today. The committed `react/.npmrc` points the
`@moamen-ui` scope at `npm.pkg.github.com` and reads `${NODE_AUTH_TOKEN}` — set it before any
`npm install`/`npm ci` (locally and in CI/VM builds).

## API client (READ FIRST)

The typed client is a **published package** (`@moamen-ui/pointer-react`), generated from the API's
Swagger spec and built **in the API repo** (via Orval) — not generated here. To change one: update
the API, run the *Publish API clients* workflow in
[`poitner-api`](https://github.com/moamen-ui/poitner-api) (it auto-bumps), then bump
`@moamen-ui/pointer-react` in `react/package.json`.

> **RULE — never call the API with raw `axios`/`fetch`.** Always use the **generated** hooks from
> `@moamen-ui/pointer-react` (TanStack Query). If an endpoint you need is missing from the
> installed client, that means the client is stale or the API tag isn't in `orval.config.ts`
> `filters.tags` — **fix the source**: (1) ensure the controller has `[Tags("X")]` and `X` is in
> the orval `filters.tags`; (2) re-run the *Publish API clients* workflow to bump the version; (3)
> `npm install @moamen-ui/pointer-react@<new>` and use the generated hook. Do **not** work around a
> missing hook with a raw request — that silently diverges from the typed client. The shared
> `AXIOS_INSTANCE` in `src/lib/api.ts` exists only as the generated client's transport
> (baseURL/token/401) — feature code must not call it directly.

## Conventions

1. All API responses are wrapped in `Result<T>`; the app unwraps `.data`, prepends the API origin to
   `/api/*`, adds the bearer token, and redirects to login on 401. Client types are the **inner**
   type (e.g. `UserResponse`, not `Result<UserResponse>`).
2. Import from the package barrel (`@moamen-ui/pointer-react`), not deep paths.
3. **Styling is Tailwind v4** — prefer utility classes over hand-written/inline CSS.
4. Keep the API base in an env file; don't hardcode the API URL in components.

## Deploy

The app is served as static files by Caddy on the VM at `app.pointer.moamen.work`. Deploy
config + build steps live in the API repo's
[`DEPLOY.md`](https://github.com/moamen-ui/poitner-api/blob/main/DEPLOY.md).
