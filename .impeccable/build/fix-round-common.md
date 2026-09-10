# Finish-review fix round — common instructions (one agent per app, in parallel)

Repo: /Users/momen/Desktop/REPOS/pointer-dashboard. Read `.impeccable/build/round2-common.md` (rules + guardrails)
and the build brief `.impeccable/build/review-margin-build-brief.md` (§2 shell, §3 grammar, decisions log).
Touch only your app. Never run git write commands. Never run npm in `angular/`. Angular builds with Node 26
(`export PATH=/opt/homebrew/opt/node@26/bin:$PATH; npx ng build`). Vue: `npm run build`. React: `npm run build`.
No screenshots are required from you; the orchestrator recaptures. Foundation utilities only.

Decisions that apply to every app (record them by implementing, not by asking):
- **Rail in RTL**: the desktop rail stays in flow in both directions; the off-canvas transforms belong to
  `< 768px` only (`max-md:` variants), never to the desktop rail.
- **Count cell (> 0)**: state hue AND a 12px glyph (circle / clock / circle-check / archive) before the mono number.
- **State chip**: always glyph + label (Active = circle-check; Disabled/Rejected = circle-x; Pending = clock;
  Archived = archive), including the Overview and Projects "Active" chips.
- **Diffstat numerals**: mono, in their state hue (open blue, ready amber, completed green, archived gray,
  danger red), neutral counts in ink; labels sans, muted, as the catalog/i18n gives them.
- **Table headers**: mixed case 13px/500 muted everywhere (no `uppercase`); rows 44px (`h-11`); sortable
  headers show the 12px sort glyph; the pagination footer uses the canonical keys `table.rowsOf`
  (`{{shown}} of {{total}} rows`), `table.pageOf`, `table.previousPage`, `table.nextPage` and is HIDDEN when
  there is a single page.
- **Users filter**: an inline segmented control (`inline-flex … bg-gutter p-0.5`, never full width) preceded by
  the label `common.show` ("Show") in 13px muted.
- **Account trigger** (header, ≥ sm): 20px user-circle icon, first name 14px/500, role name 12px muted on a second
  line, 16px chevron.
- **Tour spotlight**: no eyebrow/kicker. The step counter is plain 12px mono muted text (`Step 1 of 5`) placed
  in the footer row next to the controls, never as an uppercase tracked label above the heading.
- **Mobile (390)**: tables keep every column and scroll horizontally inside their own `overflow-x-auto`
  rounded container (never drop columns); the page must not scroll horizontally.
- **Auth pages**: identical order in all three apps — brand row (16px pin `text-brand rotate-45` + "<Product>
  Admin" 20/600, `header.brand` fallback) · form · primary full-width Sign in · centered "Forgot password?"
  link (`text-[13px] text-muted-foreground hover:text-foreground`) · hairline "or" · demo email + secondary "Try
  the demo" · hairline · "Need an account? Request access" line (13px muted + brand link). Signup/Forgot/Reset/Join
  share the same brand row (Join must read "<Product> Admin").
Report: files changed, i18n keys added (en + ar), what you could not do and why.
