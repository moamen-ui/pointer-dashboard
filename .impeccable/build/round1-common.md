# Round 1 — common instructions for every app agent

You are implementing the redesign of ONE app of the Pointer dashboard monorepo. Two sibling agents
are doing the same for the other two apps at the same time; you never touch files outside your app
folder (and never `design/`, `.impeccable/`, `PRODUCT.md`). Parity between the apps is achieved by
following the same documents to the letter.

Read, in this order, before writing code:
1. `PRODUCT.md` (product truth and constraints)
2. `.impeccable/surfaces/react-src-features-overview.md` (direction contract: THESIS … FINISH)
3. `.impeccable/build/review-margin-build-brief.md` (component grammar, page anatomy, per-page notes,
   framework notes, definition of done) — this is your spec; follow §1–§5, §7, §8
4. `<your app>/src/styles/foundation.css` (tokens + utilities; already copied in; do NOT edit it)
5. `CLAUDE.md` (repo rules: generated API client only, shared components, Tailwind v4)

Round 1 scope (this run): foundation wiring, the restyled primitives (§3), the shell (§2), the
Overview page (§4), the My Profile page (§5), and the auth pages: Login, Signup, Forgot, Reset, Join
(§5). Do not restyle other feature pages yet (they must still build and work; they may look
transitional). Everything in §1 Non-negotiables applies.

i18n: if you add strings, add them to BOTH `public/assets/i18n/en.json` and `ar.json` in your app.
The only planned new key this round is none; `projects.createdHint` belongs to round 2.

Behavior preservation is absolute: same routes, hooks, guards, dialogs, toasts, tour hooks
(`data-tour` attributes), install-guide wiring, demo panel, branding runtime (logo/name/primary
color), theme + language toggles, RTL.

Verification (part of the job, not optional):
- `npm run build` passes with zero errors.
- Run the dev server (command in your app section), log in with the test account
  `dogfood-tester@pointer.local` / `Dogfood123!` (a local workspace-admin account; the API runs at
  http://localhost:8090 in Docker). Never write this password into any file.
- Use the Playwright browser tools (`mcp__plugin_playwright_playwright__*`) to capture, at 1440×900:
  `overview-light.png`, `overview-dark.png` (toggle theme from the account menu), `profile-light.png`,
  `login-light.png`, and at 390×844 `overview-mobile.png`; also `overview-rtl.png` at 1440 after
  switching language to Arabic. Save them under `.impeccable/review/<app>/` (create the folder; this
  is the one path outside your app you may write to). Look at each capture and fix what is wrong
  before reporting; one fix round, then report honestly what remains.
- Check the browser console for errors on the touched routes and fix yours.
- `grep -rn "text-slate-\|bg-slate-\|text-blue-\|bg-blue-\|text-amber-\|bg-amber-\|text-green-\|bg-green-\|text-red-\|bg-red-" src` must return nothing in files you touched.

Report back (concise): files changed (grouped), primitives created/restyled with their variant API,
anything you could not mirror from the brief and why, i18n keys added, build status, screenshot
paths, and open issues.
