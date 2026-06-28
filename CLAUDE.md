# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repository.
**[AGENTS.md](AGENTS.md) is the canonical agent guide** — this mirrors its essentials.

## Multi-client parity (READ FIRST)

The Pointer dashboard is delivered in **multiple frontend frameworks** that share the **same features
and UX**, each consuming its matching API client (`@moamen-ui/pointer-angular` / `-react` / `-vue`):

| Framework | Status | Location |
|---|---|---|
| Angular | ✅ present | repo root (`src/`, `angular.json`) |
| React | planned | — |
| Vue | planned | — |

> **When you implement ANY task** — a feature, bug fix, refactor, UI/style tweak, or copy change —
> **apply it to EVERY framework client that currently exists in this repo**, so they stay at parity.
> Don't update one and leave the others behind. Today that's **Angular only**; once React/Vue are
> added, replicate the same change in each. If a change is genuinely framework-specific (e.g. uses an
> Angular-only API), call that out explicitly and explain why it can't be mirrored.
>
> **Use subagents:** when more than one client exists, **dispatch one subagent per client** (Angular,
> React, Vue) to implement the change in parallel — the per-client work is independent. Give each a
> self-contained brief (the task + that client's conventions), then review the results together and
> verify the clients ended up consistent (behavior, routes, labels, states).

## Project

**Pointer Dashboard** — admin SPA(s) for [Pointer](https://github.com/moamen-ui/poitner-api),
currently **Angular 22** (Angular Material + Transloco). Talks to the **Pointer API** (separate repo)
over HTTP. Frontend-only — it needs a running API.

- Dev: `npm install && npm start` → http://localhost:4200 (API expected on `:8090`).
- Prod build: `npm run build` → static bundle in `dist/admin-web/browser/`.

## API client (READ FIRST)

The typed API client is the **published [`@moamen-ui/pointer-angular`](https://github.com/moamen-ui/poitner-api/pkgs/npm/pointer-angular)**
package (GitHub Packages), generated from the API's Swagger and built with ng-packagr **in the API
repo** — not generated here. To change it: update the API, then run the *Publish API clients*
workflow in [`poitner-api`](https://github.com/moamen-ui/poitner-api) and bump the version here.

- **Auth:** install needs a GitHub Packages token. `.npmrc` (committed) points the `@moamen-ui` scope
  at `npm.pkg.github.com` and reads the token from `${NODE_AUTH_TOKEN}` — set that env var locally
  (`export NODE_AUTH_TOKEN=$(gh auth token)`) and in CI/VM builds before `npm ci`.

## Key conventions

1. All API responses are wrapped in `Result<T>`; the `apiInterceptor`
   (`src/app/core/auth/auth.interceptor.ts`) unwraps `.data`, prepends `apiBase` to `/api/*` URLs,
   adds the bearer token, and redirects to `/login` on 401. Client types are the **inner** type
   (e.g. `UserResponse`, not `Result<UserResponse>`).
2. Import from the package barrel: `import { UsersService } from '@moamen-ui/pointer-angular'`.

## Environment / API base

`apiBase` comes from `src/environments/environment.ts` (dev → `http://localhost:8090`). The
`production` build configuration in `angular.json` swaps it for `environment.prod.ts`
(→ `https://api.pointer.moamen.work`) via `fileReplacements`, so prod builds need no hand-editing.

## Deploy

In production this is served as static files by Caddy at `app.pointer.moamen.work` (SPA fallback to
`index.html`). The deploy config (compose + Caddyfile) lives in the API repo's `DEPLOY.md`.
