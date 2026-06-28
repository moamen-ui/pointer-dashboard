# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repository.

## Project

**Pointer Dashboard** — a standalone **Angular 22** admin SPA (Angular Material + Transloco) for
[Pointer](https://github.com/moamen-ui/poitner-api). It talks to the **Pointer API** (separate
repo) over HTTP. Frontend-only — it needs a running API.

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
