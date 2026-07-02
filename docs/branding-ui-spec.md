# Branding UI — shared spec (Wave 2: dashboards) — all 3 frameworks

Build the same two things in Angular, React, Vue (each in its own subdir; follow that framework's
existing conventions — study the `tenants`/`settings`/`plans` features + the shell + i18n).

**Client:** `@moamen-ui/pointer-<fw>@1.0.17` (install it). It now exposes the branding API. Backend
contract: `/Users/momen/Desktop/REPOS/pointer-api/docs/planning/branding/SPEC.md`.

## API (already deployed on prod)
- `GET /api/branding` (public) → `{ productName, tagline, primaryColor, urls{app,demo,docs,landing}, assets{logo,iconSquare,favicon,appleTouch,pwa192,pwa512}, version }`. Each `assets.*` is an absolute URL or **null** (null → use the app's bundled default).
- `GET /api/admin/branding` (super-admin) → same shape (for the editor).
- `PUT /api/admin/branding` (super-admin) body `{ productName, tagline, primaryColor, urls{app,demo,docs,landing} }`.
- `POST /api/admin/branding/asset/{kind}` (super-admin, **multipart** field `file`) → uploads an icon, bumps `version`.
- `DELETE /api/admin/branding/asset/{kind}` (super-admin) → reverts that asset to default.

Use the generated client hooks/services for GET/PUT. For the **multipart asset upload/delete**, the
generated client may not model multipart well — if so, do a raw authenticated request via the app's
existing axios/http instance (same token/baseURL the client uses), POSTing `FormData` with `file`.

`{kind}` ∈ `logo | iconSquare | favicon | appleTouch | pwa192 | pwa512`. Expected dimensions to show
next to each uploader:
- `logo` — wordmark, SVG or transparent PNG (~40px tall)
- `iconSquare` — 512×512 PNG
- `favicon` — 32×32 PNG
- `appleTouch` — 180×180 PNG
- `pwa192` — 192×192 PNG · `pwa512` — 512×512 PNG
Accept png/svg/webp/jpeg, ≤ 1 MB.

## Feature 1 — Branding admin page (super-admin only)
- New route `/branding`, guarded **super-admin only** (mirror the Plans/Tenants super-admin guard) +
  a nav item next to Plans/Tenants.
- Form: `productName`, `tagline`, `primaryColor` (color input), and the 4 URLs (`app/demo/docs/landing`)
  → **Save** calls `PUT /api/admin/branding`; toast on success.
- Per-kind **icon upload** widgets: for each of the 6 kinds show a preview (current asset URL, or a
  "using default" hint when null), an upload button (`POST …/asset/{kind}`), and a "Reset to default"
  (`DELETE …/asset/{kind}`). Refetch `GET /api/admin/branding` after each change so previews update.
- After any save/upload, refresh the app's live branding (Feature 2 store) so the header/title/favicon
  update immediately without a reload.

## Feature 2 — Runtime consumption (every user, not just admins)
On app load, fetch `GET /api/branding` once into a small branding store/service, then:
- Set `document.title` to `"<productName> Admin"` (or your app's existing title pattern with the name).
- Swap the favicon: set `<link rel="icon">` href to `assets.favicon` when non-null (else leave bundled).
- Render `productName` (and `assets.logo` when non-null) in the **shell header/sidebar brand** instead
  of the hardcoded "Pointer"/"Pointer Admin".
- (Optional, only if trivial in your theme) set the primary color CSS var from `primaryColor`.
Fallback: if the fetch fails, keep the bundled defaults — never blank the header.

## i18n
en + ar for all new labels (branding page fields, upload hints, buttons), following the existing i18n files.

## Done = `npm run build` passes in your subdir; both features work; en/ar added. Do NOT commit.
