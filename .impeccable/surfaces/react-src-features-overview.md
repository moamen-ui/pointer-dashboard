---
version: 1
slug: "react-src-features-overview"
primary_target: "react/src/features/overview"
related_targets: ["vue/src/features/overview","angular/src/app/features/overview","react/src/features/shell","vue/src/features/shell","angular/src/app/features/shell"]
---

# Surface brief: Overview (first surface of the replacement world)

## Scope and mode
Mode: Operate. Surface: the `/overview` route in all three apps (react, vue, angular), framed by the
shared shell (nav rail + header) because the first viewport includes them. The same world then
rolls out to every other route; those routes inherit this brief's world and component grammar and
carry only their own composition notes.

## Audience, job, constraints
Workspace admin checking the state of feedback and doing the one next thing (install the widget,
approve a sign-up, review a project). Secondary: super admin (same shell, platform routes),
stakeholder (Projects + My Profile only). Constraints from PRODUCT.md: three-framework parity,
white-label branding (operator primary color and name), Arabic RTL first-class, WCAG 2.2 AA, free
fonts only, light and dark both first-class. Comment bodies are never rendered; counts only.

## Confirmed answers (2026-09-10)
- Angular: replace Angular Material with spartan-ng so all three apps share the shadcn grammar.
- Quality bar: Linear / Vercel / Resend finish. Wrong: generic template look; too dense or cold.
- User-flagged UX: Overview and My Profile need UX improvement; dialogs such as Add Project carry
  too many decisions (predefined prompts inside the create dialog). Distill in rollout.
- Sequencing: run everything end to end (foundation, shell, Overview, Profile, then every route).
- Build path: code-led (no image generation in this session).

## Direction contract

THESIS: Feedback on a live app is code review, so the Overview is a review queue, not a stat wall.
A gutter of counts, project rows as files under review, statuses in diff hues, one action in the
merge position. It refuses the row-of-equal-stat-tiles-above-a-table arrangement the incumbent ships.

OWN-WORLD: White ground with a cool gutter surface for rail and row gutters; near-black ink; 1px
hairlines everywhere, no shadows at rest (menus and dialogs get an offset, blurred shadow). One
grotesque (IBM Plex Sans Arabic) for all UI text; a mono (IBM Plex Mono) only for keys, counts in
gutters, and snippets. State is a diff vocabulary: green completed, amber ready/pending, blue open,
red rejected/danger, gray archived, each as glyph + label on a tinted chip with a hairline. The brand
color (operator-overridable) drives links, focus, active nav and the primary filled button. Radius
6px. Buttons 32px tall. Rows 44px. Remove every icon tile, progress ring and card-in-card.

STORY: The admin sees what is waiting on them (approvals, projects with open feedback), how much
feedback is flowing, and one next action. They believe this console reads like the review tools they
already trust. They install, approve, or open a project.

FIRST VIEWPORT (1440x900, LTR; mirrored in RTL): Nav rail 240px on the gutter surface with a hairline
end edge: brand mark + name (32px row), then 32px nav items with 16px icons; active item is brand
text on a brand tint, no bar. Header 48px with hairline bottom: page title left, install button +
theme/language/account right. Main column max 1120px, 24px padding. Title row: "Overview" 20/600.
Directly under it, the diffstat line: "6 comments · 2 open · 1 ready · 3 completed · 0 archived" set
inline with tabular mono numerals in their diff hues, then "· 3 projects · 4 users" in ink. No tiles.
If pending approvals exist: a "Pending approvals" block styled as review requests, one 44px row per
request (name, email, requested role chip, approve-as select, Approve / Reject), hairline-separated.
Then the queue: "Projects" table, hairline rows, gutter column with muted mono row index, name + mono
key, four tabular numeric columns Open / Ready / Completed / Archived (colored glyph + number only
when > 0, muted "0" otherwise), trailing chevron to the project. Empty queue: three ghost rows of
dashed hairlines with the copy "No projects yet" and the install button inside the first ghost row.
Signature interaction: when data refreshes and a count changes, that cell flashes its diff-hue tint
and fades over 600ms ease-out, the way a changed diff line lights up. Motion grammar: no entrance
animation; state changes 150ms; menus and dialogs scale from 0.98 over 120ms.

FORM: The Review Margin (pull-request review gutters and threads). Position 1 on my ordered grounded
list; chosen as IMPECCABLE'S PICK over the assigned Blue-Pencil Galley. Seed key cca8c400, kind pick.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved
- IBM Plex Mono woff2 must be added to each app's public/assets/fonts (OFL, free).
- Brand color mapping when the operator sets a primary color: it replaces the blue accent; diff hues
  stay fixed.
