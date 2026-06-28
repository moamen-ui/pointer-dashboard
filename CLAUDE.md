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
