# Round 2 — rollout to every remaining route (common instructions)

Same rules as round 1 (`round1-common.md`): read PRODUCT.md, the direction contract, the build brief
(now especially §5 sanctioned UX changes and §6 per-route notes), foundation.css; touch only your app;
preserve behavior; verify with build + screenshots; report honestly.

Scope: every route not covered in round 1 — Users, Roles, Projects (+ distilled Add Project dialog
and Edit dialog with Details / Predefined prompts tabs), Statuses, Environments, Settings, Tenants,
Plans, Branding, the Install guide dialog, Demo panel, Tour welcome/spotlight, and every remaining
dialog (apply the "one task per dialog / segmented mode switch" rule from §5). Remove the last
transitional styles (old `.chip` classes, old aliases, unused primitives). Angular: remove the last
`mat-*` usages, then drop `@angular/material` from package.json, `mat.theme` from styles.scss, the
Material Icons and Roboto `<link>`s from index.html.

New i18n key (identical in all apps):
- `projects.createdHint` — en: "Project created. Add predefined prompts from the row menu." ·
  ar: "تم إنشاء المشروع. أضف الأوامر المعرّفة مسبقًا من قائمة الصف."

Screenshots (1440 light unless noted) to `.impeccable/review/<app>/`: `users.png`, `roles.png`,
`projects.png`, `projects-add-dialog.png`, `statuses.png`, `environments.png`, `settings.png`,
`install-guide.png`, `projects-dark.png`, `users-mobile.png` (390). Super-admin routes (tenants,
plans, branding) cannot be reached with the workspace-admin test account: verify them by build +
code review + a rendered screenshot only if a super-admin session is available; say so in the report.

## Copy parity (i18n)

The three apps' `public/assets/i18n/{en,ar}.json` had drifted (different keys, different wording).
Before round 2 starts, the orchestrator runs `python3 design/merge-i18n.py`, which writes the
canonical union to `design/i18n/{en,ar}.json` and copies it into every app. From then on:
- Never edit an app's i18n file directly; add keys to `design/i18n/{en,ar}.json` (both languages)
  and re-run the script. During round 2 each agent may ADD keys to its own app's copy, but must list
  every added key + value (en and ar) in its report so the orchestrator merges them back.
- Where the union contains two spellings of the same concept (e.g. React's
  `branding.assetHint.logo` vs Vue/Angular's `branding.assetLogoHint`), switch your code to the React
  key and report the retired key; the orchestrator deletes retired keys at the end.
- Visible labels must be identical across apps: same nav labels, headings, button labels, empty
  states, hints. When you see a wording difference in the rendered page versus the React app, it is a
  bug.

## Environment guardrails (all agents)
- Never run `git checkout`, `git restore`, `git stash`, `git reset` or any other git command that
  changes files: it discards other agents' and the orchestrator's work. Read old versions with
  `git show HEAD:<path>` only.
- Angular: `angular.json` "styles" must stay `["src/styles/app.css", "src/styles.scss"]`; `app.css`
  is the Tailwind entry importing `foundation.css`; `styles.scss` holds only the Material theme.
  Never run `npm install` in `angular/` (see round1 notes about the local API client).
