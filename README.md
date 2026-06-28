# Pointer Dashboard

Admin dashboard for [Pointer](https://github.com/moamen-ui/poitner-api), shipped in **multiple
frontend frameworks** that share the same features/UX. Monorepo, one app per framework, all styled
with **Tailwind CSS v4** and consuming the published typed API clients (`@moamen-ui/pointer-<fw>`).

| App | Dir | UI kit | Live |
|---|---|---|---|
| Angular | [`angular/`](angular/) | Angular Material + Tailwind v4 | `app-angular.pointer.moamen.work` |
| React | [`react/`](react/) | shadcn/ui + Tailwind v4 | `app-react.pointer.moamen.work` |
| Vue 3 | [`vue/`](vue/) | shadcn-vue + Tailwind v4 | `app-vue.pointer.moamen.work` |

## Run an app

Each folder is a self-contained app. The API clients are private GitHub Packages, so set a
`read:packages` token first:

```bash
cd angular   # or react / vue
export NODE_AUTH_TOKEN=$(gh auth token)
npm install
npm start      # dev server
npm run build  # production build
```

## More

- **Agent guidance:** [`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md) — note the **multi-client
  parity** rule: a change to one app should be mirrored to the others.
- **API + deploy:** the backend, the API clients, and deploy steps live in
  [`poitner-api`](https://github.com/moamen-ui/poitner-api) (see its `DEPLOY.md`).
