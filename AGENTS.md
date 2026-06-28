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
