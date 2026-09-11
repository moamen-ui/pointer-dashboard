# Angular round 3 — common instructions (one agent per file group, all in parallel)

Repo: /Users/momen/Desktop/REPOS/pointer-dashboard, app `angular/` (Angular 22 standalone + signals, CDK,
Tailwind v4, Transloco; generated API services from `@moamen-ui/pointer-angular` only). Goal of this round:
every remaining Angular Material usage in your file group is replaced by the shared UI layer, with the
§3 grammar, at parity with the React page of the same name.

Read first: `.impeccable/build/round2-common.md` (all sections, incl. guardrails), the build brief
`.impeccable/build/review-margin-build-brief.md` (§3 grammar — table header mixed-case 13px/500; §5; §6; §7),
`angular/src/styles/foundation.css`.

Reuse exactly (do not edit these; report gaps): `src/app/shared/ui/*` — `appButton` directive
(`variant`: primary|secondary|ghost|destructive|danger-outline|link, `size`: default|sm|icon), `appInput`
directive, `app-select`, `app-checkbox`, `app-switch`, `app-menu`, `app-tabs`, `app-form-field`,
`app-empty-state`, `app-row-actions-menu`, `app-count-cell`, `app-diffstat`, `app-icon` (lucide names),
`app-toast` service (`show(message, 'success'|'danger'|'warning'|'info')`), `app-auth-layout`,
`app-accordion-section`, and **`AppDialogService`** (`src/app/shared/ui/app-dialog.service.ts`):
`openRef(componentOrTemplateRef, { data?, width?, disableClose? })` returns a CDK `DialogRef` (call
`ref.close(result)`), `open(...)` returns the `closed` observable. Inline template dialogs keep working:
replace `this.dialog.open(this.tpl(), { width: '440px' })` (MatDialog) with
`this.appDialog.openRef(this.tpl())` and keep `this.dialogRef.close()`. Inside a template dialog use the §3
anatomy: header `px-5 pt-5 pb-3` (title 16px/600), body `px-5 py-2 space-y-4` (app-form-field stacks),
footer `px-5 pb-5 pt-3 flex justify-end gap-2` (secondary Cancel, then primary/destructive action).
`ConfirmService.confirm({...})` is unchanged. Tables: `<app-data-table>` (`src/app/shared/data-table/`)
with `gutter`, ghost-row empty state, pagination; or the hand-composed table grammar used in
`src/app/features/overview/overview.component.ts`. Migrated examples to copy from:
`features/settings/settings.component.ts`, `features/users/users.component.ts`,
`features/projects/projects.component.ts`, `features/signup/signup.component.ts`, `features/login/login.component.ts`.
React reference for structure (read-only): `react/src/features/<same page>/…`, `react/src/components/InstallGuide.tsx`,
`react/src/components/DemoPanel.tsx`, `react/src/components/TourSpotlight.tsx`.

HARD rules:
- Touch only your file group (listed in your prompt) plus `public/assets/i18n/{en,ar}.json` for new keys
  (report every key with both values). No files outside `angular/` except the screenshot folder.
- Never run git commands that change files (`git show HEAD:<path>` to read old code is fine).
- NEVER run `npm install`/`npm ci`/`npm update`/`npm uninstall`. Build with Node 26:
  `export PATH=/opt/homebrew/opt/node@26/bin:$PATH; cd angular && npx ng build 2>&1 | grep -E "✘|ERROR" -A4`.
  Other agents build concurrently; if you see errors in files that are not yours, ignore them and re-run later.
- `angular.json` "styles" stays `["src/styles/app.css", "src/styles.scss"]`. `@apply` does not work in
  component `styles:`; use utilities in templates or plain CSS with `var(--token)`.
- Foundation utilities only (no raw Tailwind palette colors, no `.chip*` classes), logical RTL utilities,
  WCAG AA, light + dark via tokens. When you finish, `grep -n "mat-\|Mat[A-Z]\|@angular/material\|text-slate-\|bg-blue-\|text-amber-\|bg-green-\|text-red-\|chip-" <your files>` must be empty.
- Dev server already running at http://localhost:4200 (live reload); never start another. The Playwright
  browser is shared: `browser_tabs` → `new` your own tab and re-select it before each action. Test account
  `dogfood-tester@pointer.local` / `Dogfood123!` (workspace admin; never write the password to a file; Escape
  dismisses auto-opened dialogs). Super-admin routes cannot be opened with it: verify those by build + careful
  code review and say so.
- Report: files changed, i18n keys added, shared-layer gaps, captures taken (paths) and what they show, the
  grep result above, anything not done and why. Do not stop with items "remaining"; the round ends when your
  group is Material-free and builds.
