# Finish-review packet — Pointer dashboard redesign ("The Review Margin")

## Original request (user, 2026-09-10)
"/impeccable document — i want to make the three apps look the same at least 90%, and all of them were AI
drafting to prove the functionality so they are free and should be improved UI/UX. Ask me any questions and
offer existing/new design systems to implement into these apps and follow in future work."

## Confirmed answers
- Primary user: workspace admin. Stage: live but early, no external proof (never invent proof).
- Binding constraints: three-framework parity; white-label branding; Arabic + RTL first-class; WCAG 2.2 AA;
  free fonts only.
- Angular kit: replace Angular Material with the shadcn grammar (spartan-ng brain + hand-written layer).
- Quality bar: Linear / Vercel / Resend. Wrong: generic template look; too dense or cold. User-flagged UX:
  Overview and My Profile needed work; dialogs such as Add Project carried too many decisions.
- Direction round: user chose "The Review Margin" (IMPECCABLE'S PICK) over the assigned Blue-Pencil Galley.
- Sequencing: run everything end to end. Build path: code-led (no image generation this session).

## Artifacts
- Product truth: PRODUCT.md. Direction contract: .impeccable/surfaces/react-src-features-overview.md.
- Build brief (component grammar, decisions log): .impeccable/build/review-margin-build-brief.md.
- Canonical tokens: design/foundation.css (synced copies in <app>/src/styles/foundation.css).
- Canonical strings: design/i18n/{en,ar}.json (synced to <app>/public/assets/i18n/).
- Apps: react/ (Vite, http://localhost:5199), vue/ (Vite, http://localhost:5198), angular/ (http://localhost:4200).
- Craft floor: .claude/skills/impeccable/reference/craft-floor.md

## Evidence
- Screenshots: .impeccable/review/react/, .impeccable/review/vue/, .impeccable/review/angular/
  (overview-light/dark/rtl/mobile, profile-light, login-light, users, roles, projects, statuses,
  environments, settings, install-guide, …). Incumbent (pre-redesign) captures: .impeccable/review/incumbent/.
- Detector: `impeccable detect` on the three login URLs at 1440×900 → 0 findings after the dark-mode
  brand-foreground and disabled-button fixes. Source-file scans return nothing (framework components).
- Builds: react `npm run build` ✓, vue `npm run build` ✓, angular `ng build` (Node 26) ✓ at the time of packet.

## Known limitations to weigh
- Super-admin routes (Tenants, Plans, Branding) were verified by build + code review only; the local test
  account is a workspace admin.
- Vue reka-ui Tabs click bug (pre-existing, CLAUDE.md): tab-like steppers in Vue use local button rows.
- Angular: `@angular/material` removed from package.json by hand; `npm install` + re-copying the local
  API client is a user step.

## Console observations at capture time (2026-09-10, final round)
- React Users and Projects: a React "unique key prop" warning on a list (introduced during the redesign;
  not yet located).
- Angular Users: a 403 on `/api/admin/tenants` (a non-super-admin fetch; pre-existing behavior).
  Angular Projects: 404s on `/api/ai-rules/project/` (empty key) and `/api/admin/projects/0/app-urls`
  (resources firing before a project is selected).
- Vue: no errors on the captured routes.

## Final capture set (1440×900 unless noted)
- react/: overview-light, overview-dark, overview-rtl, overview-mobile (390), profile-light, login-light,
  signup-light, join-light, users, projects, settings.
- vue/: overview-light, overview-dark, overview-rtl, overview-mobile (390), profile-light, login-light,
  signup-light, join-light, users, projects, settings, install-guide.
- angular/: overview-light, overview-dark, overview-rtl, overview-mobile (390), profile-light, login-light,
  users, roles, projects, statuses, environments, settings, install-guide, tour-welcome. (No step-3 capture: the stepper only advances after step 1 completes, in every app.)

## Recapture round (2026-09-10, after the reviewer's recapture disposition)
- Re-taken: vue/login-light (signed out; brand now "<Product> Admin" like React/Angular), vue/install-guide
  (1440 light, tour dismissed), angular/tour-welcome (auto-open welcome dialog, no dev overlay),
  angular/roles, angular/statuses, angular/environments (tour dismissed), angular/install-guide (strings
  resolved: the Angular guide had used non-existent `install.wizard.*` keys; mapped to canonical keys).
- Deleted: angular/login.png, vue/install-guide-full.png, angular/install-guide-step3.png.
- Code changes in this round: Angular tour ends on Escape; Vue auth pages use "<Product> Admin".
- Builds after the round: react ✓, vue ✓, angular (Node 26) ✓.

## Second fix batch (2026-09-10, after the verdict pass)
- Fix 3 (Angular): Overview Open/Ready/Completed/Archived cells now render through `<app-count-cell>`
  (glyph + hue when > 0), matching React/Vue `CountCell`. React Overview diffstat hues corrected
  (comments/tenantRules = open, userRules = ready).
- Fix 5: React `TableCell` padding tightened to `px-3 py-1.5` (Overview rows ≈39px, Projects rows ≈43px;
  Angular Overview ≈38px). Angular Overview table is NOT sortable (React/Vue's is), so it carries no sort
  glyphs on purpose — a behavior gap, not a decoration gap. Left as a known follow-up.
- Fix 8: React login "Need an account? Request access" line is unconditional (no dangling hairline when
  sign-up is disabled); the `useGetApiAuthSignupEnabled` gate was removed from LoginPage.
- Regression: hard-coded "Step X of Y" replaced by canonical `tour.stepOf` in all three spotlights.
- Re-taken on the current build: react/overview-light, overview-rtl, tour-step, projects, login-light;
  angular/overview-light. Builds after the batch: react ✓, vue ✓, angular (Node 26) ✓.

## Third (closing) batch (2026-09-10, after the second verdict: "fix" with #5a partial + one parity regression)
- #5a: React and Vue row-actions kebab trigger set to 32px (`h-8 w-8`, same as Angular's `size="icon"`);
  React Projects rows measure 39–40px (Angular 39px). Recaptured react/projects.png.
- Regression 1 (diffstat hue parity): Vue `Diffstat.vue` rewritten to the React/Angular rule (hue names the
  state regardless of magnitude; unstated items in ink; "private" label now i18n'd); Vue Overview Comments
  and the rules line (Workspace Rules = open, Developer Rules = ready) now carry the same tones as React/Angular.
  Vue Overview header spacing aligned (`space-y-8` + `mb-4` title row). Recaptured vue/overview-light.png.
- React "unique key" warning located and fixed: loading ghost rows in `DataTable.tsx` keyed by `col.id`,
  which is undefined for accessorKey-only columns; now falls back to accessorKey/index. Verified: React Projects loads with zero console errors.
- Not fixed (behavior gap, reported to the user): Angular Overview table is not sortable; React/Vue's is.
- Builds after the batch: react ✓, vue ✓ (Angular untouched in this batch).

## Documenter drift batch (2026-09-10, after DESIGN.md was written)
The documenter listed shadcn leftovers in the React/Vue primitives that contradicted the recorded system. Fixed in one pass:
- Button default size `h-9` → `h-8` (matches Angular's default), `sm` → `h-7 px-2.5 text-[13px]` (matches Angular), icon `h-8 w-8`; Vue button variant shadows removed.
- Input / Select trigger `h-9` → `h-8`, `shadow-sm` removed, `disabled:opacity-50` → tokenized (`bg-gutter-strong text-muted-foreground`); password toggle 32px.
- Select/Dropdown content `shadow-md/lg` → `shadow-menu`; Dialog overlay `bg-black/50` → `bg-overlay`, content `shadow-lg` → `shadow-dialog`; React toast → `shadow-menu`, 6px radius.
- React Card `rounded-xl shadow-sm` → `rounded-md` (no shadow at rest). Vue checkbox/switch shadows removed; Vue accordion 6px radius.
- Root-size finding: `design/foundation.css` sets `html { font-size: 14px }`, so rem utilities render at 0.875× in all three apps (`h-8` = 28px, `h-11` rows = 38.5px). Recorded in DESIGN.md (Layout → "Root size") and the sidecar (`root-font-size`). Parity is intact because every app shares the file.
- Builds: react ✓, vue ✓. Confirmation capture: react/login-light.png (inputs and buttons 28px rendered, same as Angular).
- Still open (behavior gap, not styling): Angular Overview table is not sortable; React/Vue's is. Tabs (`h-9` segmented list) left as-is in React/Vue.

## Gap-closing round (2026-09-10, super-admin verification with a reset local password)

Local super admin: `admin@pointer.local` (role Admin, `is_super_admin: true`). Its password hash in the
local Postgres container was replaced with the dogfood account's bcrypt hash, so both local accounts now
share one password. Local database only; nothing in the repo changed and no password is stored here.

### Angular Overview sorting (the gap the second verdict reclassified)
- The hand-rolled Overview projects table is now sortable on Name, Comments, private comments, each status
  column and Status, with the same three-step cycle as React/Vue (asc → desc → cleared), `aria-sort` on the
  header cell, and the same glyph grammar.
- The shared `app-data-table` sort affordance was also wrong: it used a chevron plus a transparent
  placeholder. Both now use `arrow-up` / `arrow-down` / `arrow-up-down` at 40% opacity when unsorted, as
  DESIGN.md records and React/Vue render. Added those three lucide paths to `app-icon`.
- Verified in the browser: ascending, descending and cleared all reorder the rows, and the unsorted glyph
  carries `opacity-40`. `[class]` on a component element loses to the component's host classes, so the
  opacity is bound with `[class.opacity-40]`.

### Functional bugs found while verifying the super-admin routes
1. **Approval status never matched.** The API returns PascalCase (`"Approved"`); all three apps compared
   against `'approved'`, so every tenant showed the fallback chip and the Approve row action never appeared.
   Now compared case-insensitively in all three, and the label is translated (`common.approved` /
   `common.pending` / `common.rejected`, added to canonical i18n) instead of printing raw API text.
2. **Branding was double-unwrapping `Result<T>`.** The generated clients' mutator returns `data.data` and
   throws on failure, and Angular's interceptor unwraps once — but the generated *types* still declare the
   envelope. React's Branding page threw and rendered "Failed to load branding."; Angular's rendered an
   empty form; the public branding stores in Vue (`composables/useBranding.ts`) and Angular
   (`core/branding/branding.service.ts`) silently fell back to defaults, so white-label branding never
   applied. All five sites now accept either shape, matching the defensive pattern the list pages use.
   Mutation paths (save / upload / reset) had the same check and would have reported failure on success.
3. **React "unique key" warning** (carried over): ghost rows keyed by `col.id`, undefined for
   accessorKey-only columns. Fixed; React Projects now loads with an empty console.

### Parity fixes on the super-admin routes
- Doubled badge glyphs: `app-badge` and React's `Badge` already render a severity glyph, and the Tenants
  (and React Plans) pages passed their own inside the chip. Removed; Angular's `neutral` severity is now
  glyphless like React's (a plan name is a label chip, not a state) and a real `archived` severity was added.
- Angular Tenants, Branding and Settings had their own `p-6` wrapper on top of the shell's, so those pages
  sat 24px further in than every other page. Removed.
- Angular's shared table footer showed pagination on a single page, printed an untranslated "of", and had
  no page readout. It now hides below two pages and uses `table.rowsOf` / `table.pageOf` /
  `table.previousPage` / `table.nextPage` like React/Vue, with RTL-mirrored arrows.
- Vue Tenants had a different column set (separate Display Name and Email, sortable headers). It now
  matches React/Angular: one identity cell (email over display name), no sortable tenant columns, mono counts.
- Vue Branding was a single-column form with a floating Save and wide preview strips. Rebuilt to the shared
  structure: one bordered card, two-column field grid, Save in the card footer, 40px asset previews.
- Vue's asset labels used a duplicate flat key set with different wording ("Icon (square)", "32×32 PNG").
  Pointed at the canonical nested keys and deleted the 12 duplicates from the canonical files and all three
  app copies; `merge-i18n.py --check` now reports 771 keys, no drift, nothing missing in any app.
- Table cells had no vertical padding in Vue or Angular, so two-line rows crowded. Both now use React's
  recorded `px-3 py-1.5`; tenant rows measure 51–52px in all three apps.
- Angular's rules diffstat was hand-rolled and used `text-brand` for a state count, which breaks the
  brand's Four Jobs rule (brand is white-label). Both Angular diffstat lines now render through
  `app-diffstat` with the same tones as React/Vue.
- Custom-element hosts (`app-form-field`, `app-diffstat`, `app-data-table`, `app-accordion-section`,
  `app-tabs`) default to `display: inline`, which silently dropped `space-y-*` margins — visible as
  cramped Branding field rows. Blockified those hosts.
- React/Vue Tabs still carried the stock shadcn pill look; both now render the underline grammar DESIGN.md
  records and Angular already shipped, and the wrappers no longer force an equal-width grid.
- Angular Plans: gutter row numbers, primary Add Plan and Save, plain mono slug (not a key chip). Plan name
  is row-primary weight in all three.
- Angular Overview private-comments cell now shows the faint em-dash placeholder React/Vue show.

### Verification
- Builds: react ✓, vue ✓ (`vue-tsc` clean), angular ✓ (Node 26).
- `impeccable detect` on angular/tenants, angular/plans, angular/branding, react/branding, vue/tenants,
  vue/branding at 1440×900: 0 findings.
- Captures added: `{react,vue,angular}/tenants.png`, `{react,vue,angular}/plans.png` (react/vue),
  `{react,vue,angular}/branding.png`, `react/branding-rtl.png`.
- Arabic/RTL spot-checked on React Branding: nav and labels mirror, Save moves to the logical end.

### Still open (reported, not changed)
- Raw HTTP in feature code, pre-existing and outside this redesign: `angular` projects export
  (`HttpClient`), `angular` auth `me` (`HttpClient`), and the install-guide widget-status probe via `fetch`
  in all three apps. The project rule is generated clients only; the widget-status endpoint may not be in
  the client's orval tags, so fixing it belongs with an API-client change.
- `emptyIcon` is still accepted by the React/Vue DataTable props but never rendered (the redesign replaced
  icon empty states with ghost rows). Dead prop, harmless.

## Follow-up round (2026-09-10, after the user asked why Add Project was missing)
- **Not a defect.** All three apps deliberately hide Add Project for a super admin and show
  `projects.superAdminNote` instead, because the backend's `ProjectService.CreateAsync` forbids a super
  admin owning a project. The button was missing only because the browser was still signed in as
  `admin@pointer.local` from the super-admin verification. Confirmed present again for the workspace-admin
  account in all three apps; all three tabs are now back on the dogfood account.
- **Projects sorting parity.** Angular sorted Key, Name, Created by and Comments while React and Vue
  disabled sorting on every Projects column. React and Vue now sort the same four (Status stays unsorted),
  verified in the browser.
- **Actions column label.** React labels the trailing actions column on six list pages; Vue labelled none.
  Added `actions-header` to Vue Plans, Roles, Statuses, Tenants, Users and Projects. Environments is
  deliberately left unlabeled in all three, because Angular's hand-rolled Environments table has no
  actions header cell.
- **Accessibility gap found alongside it:** React's Environments row-action trigger had no
  `actionsAriaLabel`, while Vue and Angular both set one. Added.
- Builds after the round: react ✓, vue ✓ (`vue-tsc` clean), angular ✓ (unchanged in this round).
- Unexplained, not reproducible: the Vue tab navigated itself from `/projects` to `/roles` once during this
  session. A second attempt stayed put, tour flags were all set, and no dialog was open. Noted rather than
  chased; worth watching if it recurs.

## Remaining-surface round (2026-09-10): install guide gating, Users/Statuses/Environments/Settings, dark theme

### Install guide: never auto-opens for a super admin (user request)
- `shouldAutoOpen` in all three apps takes an `isSuperAdmin` flag and returns false for it. A super admin
  manages the platform and owns no project, so the guide is pointless to force on them; the "Installation
  steps" entry in the nav still opens it on demand. Angular's spec gained a case for it (48 tests pass).
- Verified in all three: signed in as `admin@pointer.local` with the install flags cleared, no dialog
  appears and no flag is written; clicking the nav entry opens the wizard.

### Install guide parity fixes found while verifying
- **Vue step 1 was stuck on the create form.** Its watcher set `isCreatingInline` from the first,
  still-loading (empty) project list and never cleared it, so the picker never appeared even with six
  projects. Now cleared when projects arrive, with a flag so an explicit "Create new project" click is
  never clobbered.
- Angular step 1 had no "Create new project" path; added, reusing its own create form, with a Back link
  and the same select-plus-button row React uses.
- Angular showed "Don't show this again" in a shared footer on every step; React and Vue only show it on
  the last step. Gated Angular to the last step so all three agree. (Observation for later: step 1 is
  arguably the better home for it, since that is where the guide lands when it opens itself.)
- React's picker card was `rounded-xl`; the system radius is 6px. Fixed.

### Users / Statuses / Environments / Settings
- Angular Statuses had no gutter row numbers and no Actions header; both added, matching React and Vue.
- **Angular Environments was a hand-rolled table** with a centered icon-in-the-middle empty state, which
  DESIGN.md bans. Migrated to `app-data-table`, which brings the gutter, the sortable Name column, the
  actions column and the three-dashed-ghost-row empty state for free, and deletes the hand-rolled markup.
- React's and Vue's Environments scope chip was hand-rolled instead of using the shared `Badge`. Both now
  use it (`neutral` for global, `default` for own).
- **The gutter column had no width in React or Vue**, so auto table layout gave it ~270px of slack on
  two-column tables (visible on Environments). Both now constrain it to `w-10` on the header and cell.
- Settings: Angular stacked its sections with `gap-8` (double the others) and Vue with none; both now use
  React's `gap-4`. React's AI section title carried a brand icon the other two lacked; removed.
- Angular Environments' missing row kebab is correct, not a defect: all three gate row actions on the
  API's `canManage`, which is false for the four global environments.

### Dark theme (re-checked after the token changes)
- Overview captured in dark for all three apps: inverted table ground, gutter rails, hairlines, diff hues
  and tinted chips all read correctly and match across apps.
- `impeccable detect` on seven pages (three dark Overviews plus Angular Environments, Angular Statuses,
  React Settings, Vue Settings): 0 findings.

### Verification
- Builds: react ✓, vue ✓ (`vue-tsc` clean), angular ✓; Angular unit tests 48/48.
- Also cleared two Angular build warnings: an unused `RouterLink` import in Users and the
  `DataTableCellDirective` listed in `AppDataTableComponent.imports` while only queried via
  `contentChildren`.

## Popup dropdown round (2026-09-11): "the ddl in the popups didn't show correct and made its wrapper scroll"

Reproduced in Angular: the install guide's project select rendered its list as an absolutely-positioned
child, so the dialog's scrolling body (`max-h-[calc(88vh-140px)] overflow-y-auto`) clipped the options and
grew the dialog's scrollbar. The same applied to every `app-select` in a dialog (Add User's role, the
change-plan dialog, and so on).

- **Angular `app-select` now renders through a CDK connected overlay** (`cdkConnectedOverlay`), so the
  panel floats above the dialog, matches the trigger's width, and flips above the trigger near the
  viewport edge. Verified: the install guide and Add User dialogs both show every option, and the dialog
  body no longer scrolls (`scrollHeight === clientHeight`). CDK Overlay was already in the app because the
  dialog service uses `@angular/cdk/dialog`, so no new dependency or stylesheet was needed.
- React and Vue already portal their select panels, so neither clipped. But two styling defects showed up
  in the same pass:
  - **Menu and option rows hovered on a brand tint** (`bg-accent` = `--brand-tint`), which read as a solid
    blue block in dark mode and breaks the brand's Four Jobs rule. React and Vue now hover on the gutter
    surface like Angular, across select items, dropdown-menu items, submenu triggers, and the ghost and
    outline buttons.
  - **The global focus ring sat 2px clear of the row**, so a highlighted option looked like a detached box
    inside the panel. Added a canonical rule so rows inside a listbox or menu keep the ring but hug the
    row (`outline-offset: 0`), preserving the keyboard focus indicator.
- **Vue's invite dialog was the last native `<select>` in the monorepo**; replaced with the shared Select
  so all three render the same control. No native selects remain anywhere.
- DESIGN.md gained two rules: popup panels must float out of the page flow (portal or CDK overlay, matched
  width, flip near the edge), and menu rows hover on the gutter with a hugging focus ring.

### Verification
- Builds: react ✓, vue ✓ (`vue-tsc` clean), angular ✓; Angular unit tests 48/48.
- Captured in all three: the role select open inside the Add User dialog, plus the Angular install guide
  select before and after.

## Angular install chore, project dialog, and Angular syntax modernization (2026-09-11)

### `npm install` in angular/ (done, with a caveat)
- Backed up the local API client, ran `npm install` with `NODE_AUTH_TOKEN=$(gh auth token)`, and
  `@angular/material` is now gone from both `node_modules` and `package-lock.json`.
- The install pulled the published `@moamen-ui/pointer-angular@1.0.31`, which **does not build**: it is
  missing the AI-rules endpoints (`getApiAdminAiRulesInsightsResource`, `AiRulesService`,
  `getApiAiRulesProjectKeyResource`, `AiInsightsResponse`, `AiRuleResponse`, …). The local `1.0.0` build
  in `node_modules` is newer in content despite the lower version. Restored it; Angular builds again.
- **This stays a manual step until a new client is published** from the API repo (run the *Publish API
  clients* workflow, then bump the dependency). Any `npm install` in `angular/` will re-break the build
  until then, and the fix is to re-copy the local client's folder.

### Project dialog (user request)
- **Removed the standalone App URL field** from the project dialog in all three apps. The default
  environment is no longer excluded from the Other-environments table, so its URL is editable there as one
  row among the rest — one place for per-environment URLs instead of the same value in two places. The
  dialog also no longer sends `appUrl` on save, so editing the default row is not overwritten by a stale
  value (every field of `UpdateProjectRequest` is optional, so omitting it leaves the stored value alone).
- **"Add environment" no longer disappears.** It was rendered only while unconfigured environments
  remained, so once every environment had a URL the control vanished with no explanation. It now stays in
  place, disabled, with a line saying every environment already has a URL and where to add more
  (`projects.allEnvironmentsConfigured`, added to canonical i18n in both languages).
- Angular's AI Roles & Rules card had a button whose label wrapped into a tall narrow column; it now stays
  on one line.

### Angular syntax modernization (user request)
Every decorator-era API and old control-flow directive is gone from `angular/src`:
- `@Input`/`@Output`/`EventEmitter` → `input()`, `input.required()`, `model()` (the checkbox and switch are
  ControlValueAccessors whose `writeValue` must write, so they use `model()`), `output()`.
- `@ViewChild`/`@ContentChild` → `viewChild()`, `contentChild()`; `@HostListener`/`@HostBinding` →
  `host: {}` metadata; constructor injection → `inject()`.
- `*ngIf`/`*ngFor` → `@if`/`@for` (shell, checkbox, count cell, toast).
- `CommonModule` dropped from all 28 components that imported it; the four that genuinely needed something
  now import just `DatePipe` or `NgTemplateOutlet`. Zero `CommonModule` references remain.
- Touched files: app-button.directive, app-input.directive, app-select, app-menu, row-actions-menu,
  app-checkbox, app-switch, app-count-cell, app-diffstat, app-dialog, app-accordion-section, app-icon,
  app-toast.service, data-table-cell.directive, tour-spotlight, plus the 22 components that only carried a
  redundant `CommonModule`.
- Two behavioural fixes fell out of it: both menus (`app-menu` and the row-actions kebab) had dead
  `(clickOutside)`/`(keydown.escape)` bindings with no directive behind them, and both rendered their panel
  as an absolutely-positioned child. Both now use a CDK connected overlay like the select, so a menu on the
  last row of a scrolling table is no longer clipped, and Escape actually closes them. The input directive
  and button directive also lost their `disabled:opacity-50` in favour of the tokenized disabled state.
- The standard is now pinned in CLAUDE.md, AGENTS.md and DESIGN.md so it does not drift back.

### Verification
- Builds: react ✓, vue ✓ (`vue-tsc` clean), angular ✓ with zero NG warnings beyond the pre-existing
  bundle-budget note; Angular unit tests 48/48.
- Browser: Angular row menu floats over the table, Angular/React/Vue project dialogs show no App URL field
  and a `default` row in the environments table, Add environment present.

## Mobile pass (2026-09-11, 390×844, one batched round plus one confirmation)

Only Overview had ever been captured at 390, and that predated the padding, gutter, tabs, dialog and
overlay work. This round covered Overview, Projects, the project dialog, Users, the nav drawer and the
install-guide wizard (steps 1, 3 and 4) in all three apps. No page scrolled horizontally in any app: wide
tables scroll inside their own container, as the system records.

Six defects found, all fixed in one batch:

1. **Identifier chips broke mid-token.** In React and Vue the project-key chip wrapped (`pointer-` /
   `dashboard`) and the name stacked, pushing Overview rows from 39px to 55–80px. Angular was already
   right, so React and Vue now mirror it: `min-w-0` on the cell, `truncate` on the name, `shrink-0
   whitespace-nowrap` on the chip. Overview rows measure 39px in all three again.
2. **A project name wrapped to three lines** on the Projects page in all three apps. Names no longer wrap;
   the table scrolls instead, so nothing is hidden and rows hold 46–52px.
3. **Dialogs went full-bleed below 640px** in React and Vue, square-cornered and touching both screen
   edges, because stock shadcn switches its radius on at `sm:` and uses `w-full`. DESIGN.md records
   `min(520px, 100vw − 32px)` with a radius at every width, which Angular's dialog service already did and
   the add-project dialog was overriding by hand. The shared dialog now carries the gutter and the radius,
   so every dialog in React and Vue inherits it (measured 362px wide with an 8px radius at 390).
4. **Code snippets ran underneath the copy button.** All four snippet blocks in each app now reserve end
   padding for it.
5. **The wizard step strip wrapped its labels** once the dialog gained its side gutter, turning four steps
   into eight lines. React and Vue now match Angular: nowrap labels in a strip that scrolls.
6. **Step 4's celebration card and footer were squeezed.** The card crammed its paragraph beside a
   half-width button; it now stacks below `sm:` with a non-shrinking icon. The footer let the checkbox,
   Back and the primary button collide; it now wraps. Angular's card also lost its shrinking icon.

Regression introduced and fixed inside the round: the dialog gutter (fix 3) is what made the step strip
wrap (fix 5). Caught in the confirmation round, not left for the user.

### Verification
- Builds: react ✓, vue ✓ (`vue-tsc` clean), angular ✓; Angular unit tests 48/48 (unchanged by this round).
- Captures at 390 saved as `{react,vue,angular}/overview-mobile.png`, `projects-mobile.png`, plus
  `react/project-edit-mobile.png`, `react/users-mobile.png`, `react/nav-drawer-mobile.png`,
  `react/install-guide-mobile.png`, `react/install-step3-mobile.png`, `react/install-snippet-mobile.png`.
- The nav collapses to a drawer with a scrim in all three, and every nav item plus both footer actions stay
  reachable.

## Colorize pass (2026-09-11)

Audited the palette against DESIGN.md, then measured every rendered foreground/background pair in the
browser rather than judging by eye. A probe over Overview and Profile returned 15 contrast failures.

### What was wrong
- **Two palettes for one vocabulary.** A tenant's status catalog carries its own hex, and the apps let it
  paint status labels, column headers, counts and the diffstat. Those hexes fail AA as ink (#d97706 is
  3.2:1 and #16a34a is 3.3:1 on the canvas; #2563eb is 3.7:1 and #6b7280 is 3.9:1 on the dark canvas),
  and they contradict DESIGN.md's own Fixed Diff rule, which keeps the five hues fixed so state reads the
  same way in every workspace. The system's tokens all pass (4.87:1 to 6.11:1 light).
- **Faint ink failed on both surfaces it is used on**: #818b98 is 3.45:1 on the canvas and 3.24:1 on the
  gutter, yet it paints placeholders, zero counts and row indices. The craft floor requires 4.5:1 for
  placeholder text.
- **Toasts did not speak the state vocabulary.** React had two tones, where an error filled the surface
  solid destructive and every success was a plain neutral box. Vue had no tones at all, so its 33 error
  toasts looked identical to a save confirmation. Angular hued only the glyph.

### What changed
- The fixed diff tokens now paint every status label, header, count and diffstat number in all three apps.
  The tenant's hex stays where it is the subject: the swatch on the Statuses page.
- `--faint-foreground` is #6a737d light (4.8:1 canvas, 4.5:1 gutter) and #7d8590 dark (5.1:1, 4.6:1). It
  is still the faintest step; muted stays 6.1:1 and 6.5:1 above it.
- Toasts share one anatomy in all three apps: the floating-layer grammar (canvas, hairline, menu shadow)
  with the state hue on the glyph and the hairline, never a fill. Vue's `toast()` gained a tone argument
  and all 55 of its call sites are now tagged by intent (33 danger, 20 success, 2 warning, 1 info).
- **Visible colour added, inside the world's own vocabulary:** each status column's header now carries its
  state tint behind its hue, so the review queue reads as four colour zones instead of one gray strip.
  All eight hue-on-tint pairs clear 4.5:1 (light 4.52 to 5.24, dark 4.55 to 5.66). React and Vue got a
  `meta.headerClass` hook on the shared table so a column can own its band.
- The Statuses page renders each status name as its own state chip, so the page that lists the states
  speaks the same vocabulary as every table that shows them.

### Verification
- The same contrast probe now returns 0 failures on Overview and Profile (was 15).
- `impeccable detect`: 0 findings across Overview, Profile and Statuses in all three apps.
- Builds: react ✓, vue ✓ (`vue-tsc` clean), angular ✓. Light and dark both captured and composed.
