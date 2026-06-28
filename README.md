# Pointer Dashboard

The admin dashboard for [Pointer](https://github.com/moamen-ui/poitner-api) — an element-level
feedback tool. A standalone **Angular 22** SPA (Overview/stats, Roles, Users, Projects, signup
approvals) built with Angular Material + Transloco, talking to the **Pointer API** over HTTP.

> The backend lives in a **separate repo**: [`poitner-api`](https://github.com/moamen-ui/poitner-api).
> This repo is frontend-only; it needs a running API to talk to.

| Environment | Dashboard | API |
|---|---|---|
| Production | https://app.pointer.moamen.work | https://api.pointer.moamen.work |
| Local dev | http://localhost:4200 | http://localhost:8090 |

## Prerequisites

- **Node ≥ 22.22 + npm** — Angular CLI 22 requires it (`node --version`).
- A running **Pointer API** (see the API repo: `just up` → API on `:8090`).

## Develop

```bash
npm install
npm start            # → http://localhost:4200 (proxies to apiBase, default http://localhost:8090)
```

Sign in with an admin account (the API seeds `admin@pointer.local` / `ChangeMe123!` by default).
Only roles whose `GrantsAdmin` is true can enter.

## Configuration

The API base URL comes from Angular environment files:

| File | Used by | `apiBase` |
|---|---|---|
| `src/environments/environment.ts` | dev (`npm start`) | `http://localhost:8090` |
| `src/environments/environment.prod.ts` | prod build | `https://api.pointer.moamen.work` |

`angular.json`'s `production` configuration swaps `environment.ts` → `environment.prod.ts` via
`fileReplacements`, so **`npm run build` automatically uses the production API host** — no
hand-editing. CORS is already open server-side. To target a different API, edit `apiBase` in the
matching file.

## Build

```bash
npm run build        # production build (default configuration) → dist/admin-web/browser/
```

The output is a static bundle deployable to any static host. In production it's served by Caddy at
`app.pointer.moamen.work` with a SPA fallback to `index.html`.

## Deploy

Production serves this build as static files via Caddy on the VM (alongside the API). Full setup is
in the API repo's [`DEPLOY.md`](https://github.com/moamen-ui/poitner-api/blob/main/DEPLOY.md).

**Shipping a local change** (the VM has this repo checked out as a git clone):

```bash
# from this repo:
git push origin main

# on the VM:
cd ~/pointer-dashboard
git pull --ff-only
docker run --rm -v "$PWD":/app -v /app/node_modules -w /app node:22 \
  bash -lc "npm ci && npx ng build --configuration production"
rm -rf ~/pointer-api/dashboard-dist && cp -r dist/admin-web/browser ~/pointer-api/dashboard-dist
docker compose -f ~/pointer-api/docker-compose.prod.yml restart caddy
```

The `production` build bakes in `apiBase=https://api.pointer.moamen.work` via `fileReplacements`.

## Generated API layer (Orval)

The Angular services + models under `src/app/core/api/generated/` are **auto-generated from the
API's Swagger spec via Orval** — **never edit them by hand**. After the backend changes endpoints
or DTOs, regenerate (with the API running on `:8090`):

```bash
npm run generate-services
```

Full workflow + conventions: [`docs/skills/orval-codegen/SKILL.md`](docs/skills/orval-codegen/SKILL.md).

## Conventions

- All API responses are wrapped in `Result<T>`; the `apiInterceptor` unwraps `.data` and prepends
  `apiBase` to `/api/*` URLs. Generated types are the **inner** type (e.g. `UserResponse`).
- Frontend imports use the **`@moamen-ui/pointer-angular`** package (a tsconfig path maps it to the
  generated client today; swap to the published GitHub Packages version when you install it) — never
  relative paths into `generated/`.
- **Language + theme:** header toggles for AR/EN (Arabic flips to RTL) and light/dark; each user's
  choice is saved server-side (`PATCH /api/me/preferences`) and restored on next login.

See [`CLAUDE.md`](CLAUDE.md) for the agent-facing version of these conventions.
