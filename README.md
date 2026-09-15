# Pointer Dashboard

Admin dashboard for [Pointer](https://github.com/moamen-ui/poitner-api), a React SPA styled with
**Tailwind CSS v4** that consumes the published typed API client (`@moamen-ui/pointer-react`).

> **The Angular and Vue dashboards were retired on 2026-09-15** (last commit with all three apps:
> `6954ad2`, tag `last-three-apps`). They are preserved on branch `legacy/angular-vue` (tag
> `last-three-apps`, commit `6954ad2`) for reference only — they receive no further changes. Only
> `react/` is maintained; any dashboard change is made here only.

| App | Dir | UI kit | Live |
|---|---|---|---|
| React | [`react/`](react/) | shadcn/ui + Tailwind v4 | `app.pointer.moamen.work` |

## Run the app

The API client is a private GitHub Package, so set a `read:packages` token first:

```bash
cd react
export NODE_AUTH_TOKEN=$(gh auth token)
npm ci
npm run dev     # dev server (vite; default port 5173)
npm run build   # production build
npm run lint    # eslint
```

## More

- **Agent guidance:** [`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md).
- **Shared components:** the app builds its list/table/form/dialog pages on a small `shared/`
  library (`DataTable`, `RowActionsMenu`, `FormField`, `Badge`, confirm dialog) wrapping shadcn/ui —
  see `AGENTS.md`'s "Shared component library" section before hand-rolling a new table or form.
- **Design system:** tokens, brand, and typography live in [`DESIGN.md`](DESIGN.md) and directly in
  `react/src/styles/foundation.css` — there is no separate `design/` folder anymore.
- **API + deploy:** the backend, the API client, and deploy steps live in
  [`poitner-api`](https://github.com/moamen-ui/poitner-api) (see its `DEPLOY.md`).
