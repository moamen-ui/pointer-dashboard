# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repository.

## Project

**Pointer Dashboard** — a standalone **Angular 22** admin SPA (Angular Material + Transloco) for
[Pointer](https://github.com/moamen-ui/poitner-api). It talks to the **Pointer API** (separate
repo) over HTTP. Frontend-only — it needs a running API.

- Dev: `npm install && npm start` → http://localhost:4200 (API expected on `:8090`).
- Prod build: `npm run build` → static bundle in `dist/admin-web/browser/`.

## Critical Skill (READ FIRST)

- **[Orval Code Generation](docs/skills/orval-codegen/SKILL.md)** — the API services/models under
  `src/app/core/api/generated/` are **auto-generated from the API's Swagger spec via Orval**. If the
  backend changes endpoints or DTOs, regenerate: `npm run generate-services` (API up on `:8090`).
  **Never hand-edit `src/app/core/api/generated/`.**

## Key conventions

1. All API responses are wrapped in `Result<T>`; the `apiInterceptor`
   (`src/app/core/auth/auth.interceptor.ts`) unwraps `.data`, prepends `apiBase` to `/api/*` URLs,
   adds the bearer token, and redirects to `/login` on 401. Generated types are the **inner** type
   (e.g. `UserResponse`, not `Result<UserResponse>`).
2. Frontend imports use the **`@moamen-ui/pointer-angular`** package (tsconfig path → the generated
   client) — never relative paths into `generated/`.
3. Don't commit `openapi.json` edits by hand — it's the downloaded Swagger spec.

## Environment / API base

`apiBase` comes from `src/environments/environment.ts` (dev → `http://localhost:8090`). The
`production` build configuration in `angular.json` swaps it for `environment.prod.ts`
(→ `https://api.pointer.moamen.work`) via `fileReplacements`, so prod builds need no hand-editing.

## Deploy

In production this is served as static files by Caddy at `app.pointer.moamen.work` (SPA fallback to
`index.html`). The deploy config (compose + Caddyfile) lives in the API repo's `DEPLOY.md`.
