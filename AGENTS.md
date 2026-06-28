# AGENTS.md

> Essential context for AI agents (Claude Code, Cursor, Windsurf, opencode, …) working in this repo.

## Multi-client parity (READ FIRST)

The Pointer dashboard is delivered in **multiple frontend frameworks** that share the **same features
and UX**, each consuming its matching API client (`@moamen-ui/pointer-angular` / `-react` / `-vue`):

| Framework | Status | Location |
|---|---|---|
| Angular | ✅ present | repo root (`src/`, `angular.json`) |
| React | planned | — |
| Vue | planned | — |

**Rule:** when you implement **any** task — feature, bug fix, refactor, UI/style change, copy change —
**apply it to every framework client that currently exists in this repo**, keeping them at feature
parity. Never change one client and leave the others behind. Today only **Angular** exists; once
React/Vue are added, mirror the same change in each. If something is genuinely framework-specific,
state that explicitly and explain why it can't be mirrored.

When adding a brand-new feature, do it in each existing client and keep behavior, routes, labels, and
states consistent across them.

## Project

Admin SPA(s) for [Pointer](https://github.com/moamen-ui/poitner-api) — currently **Angular 22**
(Angular Material + Transloco). Frontend-only; talks to the **Pointer API** (separate repo) over HTTP.

- Dev: `npm install && npm start` → http://localhost:4200 (API on `:8090`).
- Prod build: `npm run build` → `dist/admin-web/browser/`.

## API client

The typed client is the published **`@moamen-ui/pointer-angular`** package (GitHub Packages),
generated + built in the [`poitner-api`](https://github.com/moamen-ui/poitner-api) repo — **not**
generated here. Each framework uses its own package (`@moamen-ui/pointer-<framework>`).

- **Auth:** installing needs a `read:packages` token. The committed `.npmrc` points the `@moamen-ui`
  scope at `npm.pkg.github.com` and reads `${NODE_AUTH_TOKEN}` — set it before `npm install`/`npm ci`
  (`export NODE_AUTH_TOKEN=$(gh auth token)` locally; `GH_PKG_TOKEN` on the VM/CI).
- To pick up API changes: republish the client (the *Publish API clients* workflow in `poitner-api`,
  bump version) and bump `@moamen-ui/pointer-<framework>` here.

## Key conventions

1. All API responses are wrapped in `Result<T>`; an HTTP interceptor unwraps `.data`, prepends the
   API origin to `/api/*`, adds the bearer token, and redirects to `/login` on 401. Client types are
   the **inner** type (e.g. `UserResponse`, not `Result<UserResponse>`).
2. Import from the package barrel (e.g. `@moamen-ui/pointer-angular`), not deep paths.
3. Keep the API base in an environment file (Angular: `environment.ts` / `environment.prod.ts` via
   `fileReplacements`). Don't hardcode the API URL in components.

## Deploy

Each client is served as static files by Caddy on the VM at `app-<framework>.pointer.moamen.work`
(Angular → `app-angular.pointer.moamen.work`; `app.pointer.moamen.work` kept for back-compat). Deploy
config + steps live in the API repo's [`DEPLOY.md`](https://github.com/moamen-ui/poitner-api/blob/main/DEPLOY.md).
