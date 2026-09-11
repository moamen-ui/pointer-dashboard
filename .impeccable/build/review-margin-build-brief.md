# Build brief: "The Review Margin" — Pointer dashboard redesign (all three apps)

Development-only document. Never copy any of this into source comments, DOM, or shipped files.
Read together with: PRODUCT.md (product truth), .impeccable/surfaces/react-src-features-overview.md
(direction contract), design/foundation.css (tokens; identical copy in each app at src/styles/).

## 0. The idea in one paragraph

Feedback on a live app is code review. The dashboard therefore borrows the grammar of pull-request
review tools: a white canvas, a cool gutter surface for rails and headers, 1px hairlines instead of
shadows, one grotesque (IBM Plex Sans Arabic) for UI text and a mono (IBM Plex Mono) only for keys,
counts and snippets, and a diff vocabulary for state: blue open, amber ready, green completed, gray
archived, red danger. There are no stat tiles, no icon squares, no progress rings, no cards inside
cards, no colored left borders, no gradients, no shadows at rest. Hierarchy comes from type size,
weight and hairlines. The finish bar is Linear / Vercel / Resend: crisp, quiet, precise, never cold.

## 1. Non-negotiables

1. **Parity.** Every class name, spacing value, row height, and label below is the same in React,
   Vue and Angular. Use the Tailwind utilities from foundation.css (`bg-background`, `bg-gutter`,
   `text-foreground`, `text-muted-foreground`, `border-border`, `border-border-muted`, `text-brand`,
   `bg-brand-tint`, `text-state-open`, `bg-state-completed-tint`, `font-mono`, `shadow-menu`,
   `shadow-dialog`). Do not invent new colors; do not use raw Tailwind palette colors
   (`text-blue-600`, `bg-slate-100`, `bg-amber-50` …) anywhere in feature code.
2. **Behavior is preserved.** Every route, data hook, permission gate, i18n key, empty state,
   loading state, error state, toast, dialog, and keyboard behavior that exists today still exists.
   Recomposition, not feature change. The only sanctioned UX changes are the ones in §5.
3. **API only via the generated client.** No raw HTTP. (Repo rule.)
4. **RTL + Arabic.** Use logical properties/utilities only (`ps-`, `pe-`, `ms-`, `me-`, `start-`,
   `end-`, `text-start`, `border-s`, `border-e`). Never `pl-`/`pr-`/`left-`/`right-`/`text-left`.
   Icons that imply direction (chevrons) flip with `rtl:-scale-x-100`.
5. **Accessibility.** WCAG 2.2 AA: contrast, visible focus (foundation.css provides the ring; do not
   remove it), 32px+ targets with 24px minimum spacing, labels on every control, `aria-live` on
   toasts, dialogs trap focus and return it. Color is never the only signal: every state chip has a
   glyph and a label.
6. **Themes.** Light and dark both first-class; only use tokens, never hard-coded hex.
7. **Fonts are free.** IBM Plex Sans Arabic + IBM Plex Mono, already in `public/assets/fonts/`.
8. **No new dependencies** beyond those named for Angular (§7). React keeps shadcn/radix; Vue keeps
   shadcn-vue/reka-ui.

## 2. Page anatomy (shell)

```
┌─ header 48px ─────────────────────────────────────────────────────────────────────────────┐
│ [≡ mobile]  ⌖ Pointer Admin            …            [Install steps ●] [Account ▾]          │  hairline bottom
├────────────┬──────────────────────────────────────────────────────────────────────────────┤
│ rail 240px │ main: padding 24px; content max-width 1120px, start-aligned                   │
│ bg-gutter  │                                                                              │
│ hairline   │  Page title row  (h1 20px/600, actions on the end side)                        │
│ end edge   │  …                                                                           │
│            │                                                                              │
│ ── footer: How to use · Installation steps ● ──                                            │
└────────────┴──────────────────────────────────────────────────────────────────────────────┘
```

- **Header**: `h-12 border-b border-border bg-background px-4 flex items-center gap-3`. No shadow.
  Brand: 16px pin icon in `text-brand` + product name 14px/600 (or branding logo). End side:
  primary "Installation steps" button (`size=sm`, variant `primary`) when `nothingCollectedYet`
  is true, otherwise a `ghost` icon button with the rocket; then the account menu trigger:
  `ghost` button with 20px user-circle icon, first name 14px/500, role 12px muted beneath, chevron.
  Account menu items: profile, theme toggle, language toggle, separator, sign out (unchanged).
- **Rail**: `w-[240px] shrink-0 border-e border-border bg-gutter flex flex-col py-3`.
  Nav item: `h-8 px-3 mx-2 rounded-md flex items-center gap-2.5 text-[14px] font-medium
  text-muted-foreground hover:bg-gutter-strong hover:text-foreground` ; active:
  `bg-brand-tint text-brand font-semibold` (no bar, no border). Icon 16px (`h-4 w-4`).
  Section spacing: admin group, then Projects, then super-admin group, then My Profile; separate
  groups with `my-2 border-t border-border-muted`. A small caps group label is NOT used.
  Footer (mt-auto, `border-t border-border-muted pt-2`): "How to use" (compass) and
  "Installation steps" (rocket) as nav-style buttons; the brand dot (`h-1.5 w-1.5 rounded-full
  bg-brand`) sits after the label while `nothingCollectedYet`.
- **Mobile (<768px)**: rail becomes an off-canvas drawer under the header with `bg-overlay`
  backdrop (existing behavior), header shows the menu button.
- **Main**: `flex-1 min-w-0 overflow-auto bg-background p-6`; inner `mx-auto w-full max-w-[1120px]`
  (keep start alignment: `ms-0` when the viewport is wider than 1120 + rail; i.e. do not center,
  use `max-w-[1120px]` without `mx-auto`).
- **Page title row**: `flex items-center justify-between gap-4 mb-4`; `h1: text-[20px] leading-7
  font-semibold tracking-[-0.01em]`; optional one-line description under it: 14px muted.

## 3. Component grammar (restyle the existing primitives; same names, same API)

All sizes in px; Tailwind utilities in brackets.

**Button** (`h-8 px-3 rounded-md text-[14px] font-medium inline-flex items-center gap-1.5
transition-colors duration-150`), icon 16px, `size=sm` → `h-7 px-2.5 text-[13px]`, icon-only →
`w-8 px-0`.
- `primary`: `bg-brand text-brand-foreground hover:bg-brand-hover`
- `secondary` (default for most actions): `bg-background text-foreground border border-border
  hover:bg-gutter active:bg-gutter-strong`
- `ghost`: `text-muted-foreground hover:bg-gutter hover:text-foreground`
- `destructive`: `bg-destructive text-destructive-foreground hover:bg-destructive-hover`
- `danger-outline` (for destructive row actions): secondary anatomy with `text-state-danger
  hover:bg-state-danger-tint`
- `link`: `text-brand underline-offset-4 hover:underline h-auto px-0`
- disabled: no opacity; `bg-gutter-strong text-muted-foreground border-border-muted cursor-not-allowed` (decided 2026-09-10: opacity stacks fail contrast scans and read as broken); loading: replace leading icon with a 16px spinner.

**Input / Select / Textarea**: `h-8 w-full rounded-md border border-border bg-background px-3
text-[14px] placeholder:text-faint-foreground` ; focus handled by foundation ring; invalid:
`border-state-danger` + error text 12px `text-state-danger` beneath with a 12px alert-circle glyph.
Select trigger ends with a 16px chevron; menu = Menu style below.

**FormField** (shared wrapper): label 13px/500 `text-foreground mb-1.5`; hint 12px muted `mt-1.5`;
error replaces the hint. Required marker is the word "Required" in 12px muted after the label, not
an asterisk. Vertical gap between fields: 16px (`space-y-4`).

**Checkbox / Switch**: 16px checkbox with `border-border`, checked `bg-brand border-brand` with a
white check; switch 32×18, thumb 14, on = `bg-brand`.

**Segmented control** (e.g. Users "Show: Approved / Pending / Rejected"): `inline-flex rounded-md
border border-border bg-gutter p-0.5`, items `h-7 px-3 rounded-[4px] text-[13px] font-medium
text-muted-foreground`, selected `bg-background text-foreground shadow-none border border-border`.

**Menu (dropdown / row actions)**: `min-w-[180px] rounded-md border border-border bg-background
p-1 shadow-menu`; item `h-8 px-2 rounded-[4px] text-[14px] flex items-center gap-2
hover:bg-gutter`; destructive item `text-state-danger hover:bg-state-danger-tint`; separator
`my-1 border-t border-border-muted`. Open animation: `scale-[0.98] opacity-0 → 1` in 120ms
ease-out; no slide.

**Dialog**: `w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background
shadow-dialog`; overlay `bg-overlay`. Header `px-5 pt-5 pb-3`: title 16px/600, optional 14px muted
description. Body `px-5 py-2 space-y-4`. Footer `px-5 pb-5 pt-3 flex justify-end gap-2` with
secondary Cancel then primary action. Open animation 120ms ease-out from `scale-[0.98] opacity-0`.
Dialogs never nest; a dialog holds one task.

**Confirm dialog**: same shell; message 14px; destructive confirm uses `destructive` button.

**Table** (shared DataTable): `rounded-md border border-border overflow-hidden`; header row
`h-10 bg-gutter text-[13px] font-medium text-muted-foreground` with mixed-case labels and a 12px
sort glyph after sortable labels (decided 2026-09-10 from the shipped React/Vue DataTable: no
uppercase headers anywhere); body rows `h-11 border-t border-border-muted
hover:bg-gutter/60`; cells `px-3 text-[14px]`; first cell may be a **gutter** column: `w-10
text-end font-mono text-[12px] text-faint-foreground` showing the row number (1-based, per page).
Numeric columns: `text-end font-mono tabular-nums`. Keys/codes: `font-mono text-[13px] rounded
bg-gutter px-1.5 py-0.5`. Sort indicator: 12px chevron after the header label. Pagination footer:
`h-11 border-t border-border bg-background px-3 flex items-center justify-between text-[13px]
text-muted-foreground` with secondary `size=sm` Previous / Next. Search input above the table
(when `searchable`): 240px wide, `h-8`, magnifier glyph at the start.

**State chip** (Badge): `inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px]
font-medium leading-none`; glyph 12px. Severity map:
- open → `text-state-open bg-state-open-tint border-state-open/30`, glyph: circle
- ready / warning / pending → `text-state-ready bg-state-ready-tint border-state-ready/30`, glyph: clock
- completed / success / active → `text-state-completed bg-state-completed-tint
  border-state-completed/30`, glyph: check-circle
- archived / neutral → `text-state-archived bg-state-archived-tint border-state-archived/30`,
  glyph: archive (or none for plain neutral labels)
- danger / rejected / disabled → `text-state-danger bg-state-danger-tint border-state-danger/30`,
  glyph: x-circle
- primary / info → brand tint + `text-brand`
When the **status catalog** provides a color for a status (Statuses page lets admins recolor),
the chip and the count use that color inline: `style="--chip: <color>"` with
`color: var(--chip); background: color-mix(in srgb, var(--chip) 12%, transparent); border-color:
color-mix(in srgb, var(--chip) 30%, transparent)`. Same anatomy, catalog hue.

**Count cell** (statuses in tables): number in `font-mono tabular-nums text-[14px]`; when > 0 it
takes the state's text color and a 12px glyph before it; when 0 it is `text-faint-foreground`
with no glyph. When a count changes after a refetch, add `ds-flash` with
`--flash-tint: <state tint>` for one animation cycle (signature interaction).

**Diffstat line** (summary of counts, replaces stat tiles): a single wrapping line of
`text-[14px]` items separated by `·` in `text-faint-foreground`: each item is a mono number in its
state color followed by the lowercase label in `text-muted-foreground` (e.g. `6 comments · 2 open ·
1 ready · 3 completed · 0 archived · 3 projects · 4 users`). Private comments: `· 2 private` with a
12px lock glyph and the existing tooltip. Sits directly under the page title row, `mb-6`.

**Section**: `h2: text-[16px] font-semibold leading-6`; `space-y-3` inside; sections separated by
`mt-8`. Sections are not cards. If a section needs a boundary (a list inside it), the list itself
carries `rounded-md border border-border`.

**List row** (approvals, environments, roles inside sections): `min-h-11 px-3 py-2 flex items-center
gap-4 border-t border-border-muted first:border-t-0`; primary text 14px/500, secondary 13px muted;
actions at the end side.

**Empty state**: never a centered icon in a circle. Inside a table: three **ghost rows**
(`h-11 border-t border-dashed border-border-muted`) with the copy in the first row
(`text-[14px] text-muted-foreground`) and, when there is a next action, a `primary size=sm` button
at the end of that row. Inside a section without a table: one line of muted copy plus the action.
Keep every existing empty/emptyHint string.

**Loading**: skeleton rows (`h-11` with a `bg-gutter` bar `h-3 w-[40%] rounded`) in the table
shape; never a spinner in the middle of the page. Buttons show an inline 16px spinner.

**Toast**: bottom-end, `rounded-md border border-border bg-background shadow-menu px-3 py-2
text-[14px]` with a 16px state glyph at the start (check-circle / alert-circle in state colors).

**Tabs** (install guide, settings): underline tabs: `h-9 flex gap-4 border-b border-border`;
tab `text-[14px] text-muted-foreground pb-2 border-b-2 border-transparent -mb-px`; active
`text-foreground border-brand font-medium`.

**Accordion section** (Settings): `rounded-md border border-border`; header `h-11 px-4 flex
items-center justify-between text-[14px] font-medium` with a 16px chevron; body `px-4 pb-4 pt-1
border-t border-border-muted`.

**Code / snippet block**: `rounded-md border border-border bg-gutter font-mono text-[13px] p-3
overflow-x-auto` with a `ghost size=sm` Copy button at the top end corner.

**Icons**: lucide (React/Vue) and lucide-static SVG or the existing icon set in Angular, 16px in
controls and rows, 20px only for the header account glyph. Stroke 1.75. Never emoji.

**Type scale**: 20/28 600 page title · 16/24 600 section · 14/20 400 body (500 for row primary
text) · 13/18 for secondary rows and segmented controls · 12/16 for header cells, hints, chips.
Letter-spacing: -0.01em on the 20px title only. Body copy measure ≤ 72ch (`max-w-[72ch]` on
paragraphs and hints).

**Spacing rhythm**: 4 / 8 / 12 / 16 / 24 / 32. More space above a section heading (32) than
below it (12).

**Motion**: no entrance animations on page load. Hover/active transitions 150ms. Menus and
dialogs 120ms ease-out scale 0.98→1. `ds-flash` 600ms for changed counts. Respect
prefers-reduced-motion (foundation handles it).

## 4. Overview — first surface (compose exactly this)

Data and hooks unchanged: stats (totals + per-project counts + privateComments), pending users +
roles (approve-as / reject with the existing dialogs), status catalog labels and colors, and the AI
insights block (`aiRules.*`) with its super-admin detailed rules table.

Order top to bottom:
1. Title row: "Overview" (h1) · end side: secondary `size=sm` Refresh button (spinning icon while
   fetching; refreshes stats and insights).
2. Diffstat line (§3) from `totals`: comments · open · ready · completed · archived · projects ·
   users, plus private comments when > 0. Labels come from the status catalog where they do today.
3. **Pending approvals** section — only when there are pending users. `h2` with the count as a
   ready-state chip after the title. A bordered list of rows: display name (14/500) + email (13
   muted) + requested role as a neutral chip + "Requested: <date>" 12px muted; end side: primary
   `size=sm` Approve, secondary `size=sm` Reject. Existing approve (role select) dialog and reject
   confirm remain.
4. **Projects** section (replaces "Projects Breakdown"): `h2` "Projects" using the existing
   `overview.breakdown` string is NOT reused; use `overview.projects` for the heading. Table with
   gutter column, Name (14/500) with the key beneath it as a mono key chip on the same row
   (`name` then `key` chip inline, gap-2), Comments (mono, private lock chip inline when > 0), then
   one Count cell per catalog status (header label in the catalog color), then Status chip
   (active/disabled). Row click → `/projects` (keep the existing hover affordance if any; add a
   16px chevron at the end that flips in RTL). Empty: three ghost rows with `overview.emptyProjects`
   + `overview.emptyProjectsHint` and an "Installation steps" primary `size=sm` button that opens the
   install guide.
5. **AI coding tools & rules** section (only when insights exist): `h2` `aiRules.insightsTitle`
   with the subtitle as 14px muted beneath. Then a diffstat-style line for the four counts (total ·
   workspace · project · personal) — not four boxed tiles. Then two or three bordered lists side by
   side (`grid gap-4 md:grid-cols-2 / md:grid-cols-3`), each a §3 list with a 14/500 header row on
   `bg-gutter`: tenants (super admin), active tools (tool name in mono), developer adoption. The
   super-admin "Inspect details" toggle and its DataTable stay, styled per §3.

Approve dialog and reject confirm dialogs: §3 dialog grammar, unchanged logic.

## 5. Sanctioned UX changes (from the user's brief)

- **Overview**: as §4 (no tiles; queue-first).
- **My Profile**: same grammar as Overview for one person: title row is the display name (h1) with
  email · role as 14px muted under it; diffstat line for projects · comments · replies · open ·
  ready · completed · archived; then "Projects" table (name + key chip, environments, counts per
  status as Count cells); expandable rows keep working. Remove the per-project mini progress bars
  and the stat tiles; a project's status mix is the row's count cells.
- **Add Project dialog**: one task. Fields: Name, Key (auto-filled from the name with the existing
  hint), and the "Capture console/network context" switch. Remove the predefined-prompts editor
  from the create dialog; after creation, the row's actions menu already offers "Predefined
  prompts" — show a toast "Project created. Add predefined prompts from the row menu." (add the
  i18n key `projects.createdHint` in en + ar). Keep all validation. The Edit dialog keeps
  prompts management as today but as a Tabs (Details / Predefined prompts) so the first view is
  the short form.
- **Dialog audits everywhere**: when a dialog holds two tasks (e.g. Add User: invite vs create
  directly), keep both but as a segmented control at the top of the dialog choosing the mode, so
  the visible fields are only the chosen mode's fields.
- **Login / Signup / Forgot / Reset / Join**: one 400px column, start-aligned inside a centered
  `max-w-[400px]`; brand mark + product name at top (16px icon + 20px/600 name), then the form,
  primary "Sign in" full width, then a hairline with "or" and the demo email + secondary "Try the
  demo". No card box around the form on desktop; on the white canvas with the hairline dividers.

## 6. Per-route composition notes (rollout round)

Every list page: title row (h1 + primary "Add …" button at the end), optional 14px description
under the title, optional filter row (segmented control / search) `mb-3`, then the table. Row
actions as a `ghost` icon button (16px ellipsis) at the end of the row opening the Menu.
- **Users**: filter segmented control; union rows (users + pending invites) keep their dual menus;
  status as chips; role as plain text; invite rows show a "Invite" neutral chip.
- **Roles**: table; "Grants admin" and "Quick-access" are 32px toggle buttons (`role="switch"`,
  `aria-checked`) whose glyph shows the state (`text-state-completed` circle-check or
  `text-faint-foreground` dash) and whose click flips it, so the old inline switches' behavior
  survives; read-only (system role / no permission) renders the glyph without a button. Status
  chip; delete dialog unchanged logic.
- **Projects**: table with key chip; comments count mono; "Created by" muted; actions menu.
- **Statuses**: inline-edit rows stay (escape hatch); color input styled as a 24px swatch button
  with the hex in mono beside it; order as mono; Save/Reset secondary `size=sm`.
- **Environments**: table; scope as neutral/brand chip; delete confirm.
- **Settings**: accordion sections (§3); each section body uses FormField stack; Save primary at
  the section footer end side.
- **Tenants / Plans / Branding** (super admin): same list grammar; Branding asset uploaders as a
  2-column grid of bordered rows: preview 40px box on `bg-gutter`, kind + expected size 13px
  muted, Upload secondary `size=sm`, Reset ghost `size=sm`.
- **Install guide dialog**: 4-step stepper as underline tabs across the top; content per §3 code
  blocks; "Don't show again" as a checkbox at the footer start; "Got it" primary.
- **Demo panel** (banner under header): `bg-gutter border-b border-border` row, 13px, expiry in
  mono, secondary `size=sm` actions.
- **Tour spotlight / welcome**: dialog grammar.

## 7. Framework notes

**React**: restyle `src/components/ui/*` (button, input, select, dialog, dropdown-menu, badge,
table, tabs, toast, label, card → keep `Card` exported but implement it as the §3 bordered box
without padding defaults; remove its use where a section is meant), `components/shared/*`,
`EmptyState`, `ConfirmDialog`. Import `./styles/foundation.css` at the top of `src/index.css`
right after `@import 'tailwindcss'` and delete the old token blocks and `@theme inline` there
(foundation owns them). Keep `tailwindcss-animate` only if still used.

**Vue**: same for `src/components/ui/*`, `components/shared/*`; import `./styles/foundation.css`
in `src/index.css` after `@import 'tailwindcss'` and remove the old token blocks/`@theme`.

**Angular**: replace Angular Material with the shadcn grammar.
- Install `@spartan-ng/brain` (headless directives/services on CDK; peer deps satisfied by Angular
  22 + tailwind 4; add `tw-animate-css` and `clsx`, `tailwind-merge`). Do NOT add nx or the
  spartan CLI; write the styled ("helm") components by hand under `src/app/shared/ui/` as
  standalone components/directives: `hlm-button` (directive `appButton` with `variant`/`size`
  inputs), `app-input` directive, `app-select` (brain select), `app-checkbox`, `app-switch`,
  `app-dialog` (brain dialog service replacing MatDialog; keep the `ConfirmService` API),
  `app-menu` (brain menu replacing MatMenu), `app-tabs`, `app-toast` service replacing
  MatSnackBar, `app-badge` (exists), `app-table` styling inside the shared data-table (replace
  MatTable/MatSort/MatPaginator with the shared table's own sort + pagination, mirroring the
  React/Vue DataTable API), `app-form-field` (exists; restyle). Icons: keep the existing icon
  approach if it is Material Icons font → replace with inline lucide SVGs (add `lucide-static`
  or hand-inline the ~30 icons used) so glyph weight matches the other apps.
- Migrate features in this order: shell, overview, profile, auth pages (round 1); the remaining
  features in round 2. Remove `@angular/material` and `mat.theme` from `styles.scss` only when no
  `mat-` selector remains; until then keep Material's CSS loaded but visually unused on migrated
  pages. `styles.scss` imports `./styles/foundation.css` right after `@import 'tailwindcss'`; the
  old `@theme` and `:root` palette blocks are removed (aliases like `bg-app`, `text-ink`,
  `bg-panel` are replaced in templates by the foundation utilities).
- `ng build` must pass (`node@26` path per repo memory if the default Node is too old).

## 8. Definition of done per round

- `npm run build` passes in the app; no TypeScript errors; no console errors on the touched routes.
- Touched routes render correctly in light and dark, LTR and RTL (switch language), at 1440 and
  390 wide; screenshots of Overview and Profile at 1440 (light + dark) and 390 saved to
  `.impeccable/review/<app>/` as `overview-light.png`, `overview-dark.png`, `overview-mobile.png`,
  `profile-light.png`, `login-light.png` (use the running dev server; log in with the test
  account the orchestrator provides).
- No raw palette classes (`grep -rn "text-slate-\|bg-blue-\|bg-amber-\|text-green-" src` returns
  nothing in touched files).
- Report: files changed, anything you could not mirror and why, and any string keys added (en + ar).
