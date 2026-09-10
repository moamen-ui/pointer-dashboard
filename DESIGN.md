---
name: Pointer Dashboard
description: A feedback console that reads like a pull-request review: white ground, cool gutters, hairlines, and a diff vocabulary for state.
colors:
  brand: "var(--brand)"
  brand-foreground: "var(--brand-foreground)"
  brand-tint: "var(--brand-tint)"
  brand-hover: "var(--brand-hover)"
  canvas: "#ffffff"
  gutter: "#f6f8fa"
  gutter-strong: "#eaeef2"
  overlay: "rgba(31, 35, 40, 0.5)"
  ink: "#1f2328"
  ink-muted: "#59636e"
  ink-faint: "#818b98"
  hairline: "#d0d7de"
  hairline-muted: "#e6eaef"
  state-open: "#0969da"
  state-open-tint: "#ddf4ff"
  state-ready: "#9a6700"
  state-ready-tint: "#fff8c5"
  state-completed: "#1a7f37"
  state-completed-tint: "#dafbe1"
  state-archived: "#59636e"
  state-archived-tint: "#eaeef2"
  state-danger: "#d1242f"
  state-danger-tint: "#ffebe9"
  destructive: "#cf222e"
  destructive-hover: "#a40e26"
  destructive-foreground: "#ffffff"
typography:
  headline:
    fontFamily: "IBMPlexSansArabic, Segoe UI, Tahoma, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.01em"
  title:
    fontFamily: "IBMPlexSansArabic, Segoe UI, Tahoma, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "normal"
  body:
    fontFamily: "IBMPlexSansArabic, Segoe UI, Tahoma, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "normal"
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "IBMPlexSansArabic, Segoe UI, Tahoma, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
    letterSpacing: "normal"
  chip:
    fontFamily: "IBMPlexSansArabic, Segoe UI, Tahoma, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "normal"
  data:
    fontFamily: "IBMPlexMono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "normal"
    fontFeature: "'tnum' 1, 'zero' 1"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
    textColor: "{colors.brand-foreground}"
  button-primary-disabled:
    backgroundColor: "{colors.gutter-strong}"
    textColor: "{colors.ink-muted}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.gutter}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.gutter}"
    textColor: "{colors.ink}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-destructive-hover:
    backgroundColor: "{colors.destructive-hover}"
    textColor: "{colors.destructive-foreground}"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  nav-item-hover:
    backgroundColor: "{colors.gutter-strong}"
    textColor: "{colors.ink}"
  nav-item-active:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand}"
  chip-open:
    backgroundColor: "{colors.state-open-tint}"
    textColor: "{colors.state-open}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  chip-ready:
    backgroundColor: "{colors.state-ready-tint}"
    textColor: "{colors.state-ready}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  chip-completed:
    backgroundColor: "{colors.state-completed-tint}"
    textColor: "{colors.state-completed}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  chip-archived:
    backgroundColor: "{colors.state-archived-tint}"
    textColor: "{colors.state-archived}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  chip-danger:
    backgroundColor: "{colors.state-danger-tint}"
    textColor: "{colors.state-danger}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  chip-brand:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  key-chip:
    backgroundColor: "{colors.gutter}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  table-header:
    backgroundColor: "{colors.gutter}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    padding: "0 12px"
    height: "40px"
  table-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "0 12px"
    height: "44px"
  table-row-hover:
    backgroundColor: "{colors.gutter}"
  menu:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "4px"
    width: "180px"
  dialog:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
    width: "520px"
---

# Design System: Pointer Dashboard

## Overview

**Creative North Star: "The Review Margin"**

Feedback on a live app is code review, so the console borrows the grammar of pull-request review
tools rather than the grammar of analytics dashboards. The page is a white canvas with a cool
gutter surface for the nav rail, table headers and row indices; near-black ink; one-pixel hairlines
doing all of the structural work; and a diff vocabulary for state (blue open, amber ready, green
completed, gray archived, red danger) rendered as glyph + label on tinted hairline chips. The
Overview is a review queue, not a stat wall: a single "diffstat" line of counts replaces stat tiles,
project rows read like files under review, and one action sits in the merge position.

Hierarchy comes from type size, weight and hairlines, never from boxes, shadows or color fills.
Nothing casts a shadow at rest; only floating layers (menus, dialogs, toasts) lift off the page.
The brand color is a runtime variable the operator can override (white-label), and it drives
exactly four things: links, focus rings, the active nav item and the primary filled button. The diff
hues stay fixed regardless of brand, so state always reads the same way in every tenant. The finish
bar is Linear / Vercel / Resend: crisp, quiet, precise, never cold.

The system ships identically in three framework apps (React, Vue, Angular) from one token file
(`design/foundation.css`), one i18n source (`design/i18n/{en,ar}.json`), and mirrored shared
component layers. Confirmed rejections: stat tiles above tables, icon squares, progress rings,
cards inside cards, colored left borders, gradients, uppercase tracked labels, kickers and eyebrows,
Angular Material.

**Key Characteristics:**
- White canvas, `gutter` surface for rails and headers, hairlines everywhere, no shadows at rest
- One grotesque (IBM Plex Sans Arabic) for all UI text; IBM Plex Mono only for keys, counts and snippets
- State is always glyph + hue + label; color is never the only signal
- Brand color is a runtime CSS variable; diff hues are fixed
- 32px controls, 44px rows, 6px radius, 14px base type with tabular numerals everywhere (nominal Tailwind values; see the root-size note under Layout)
- Light and dark are both first-class; dark is a light-table negative, not gray on gray
- Arabic and RTL first-class: logical properties only, directional icons mirror
- Three-framework parity is a rule of the system, not a goal

## Colors

A near-monochrome paper-and-ink palette where the only saturated colors are the five fixed diff hues and the operator's brand.

### Primary
- **Brand** (`var(--brand)`; ships as `#0969da` light / `#4493f8` dark until the tenant overrides it): links, focus rings, caret and selection tint, the active nav item's text, the primary filled button, the brand dot on the install-steps nav item. Overridable at runtime on `:root` together with `--brand-foreground` and `--brand-tint`.
- **Brand Foreground** (`var(--brand-foreground)`; `#ffffff` light, `#0d1117` ink in dark): text on filled brand surfaces. In dark it is ink, not white, because white on `#4493f8` is 3.1:1 and fails AA.
- **Brand Tint** (`var(--brand-tint)`; `#ddf4ff` light): the active nav item's background, brand chips, `::selection`, the default count-flash tint.
- **Brand Hover** (`var(--brand-hover)`; `#0860ca` light): hover on the primary button only.

### Secondary (diff vocabulary; fixed, not brand-overridable)
- **Open Blue** (#0969da / tint #ddf4ff): open feedback counts, "open" chips, the Comments total in the diffstat. Glyph: circle.
- **Ready Amber** (#9a6700 / tint #fff8c5): ready and pending states, the pending-approvals count chip. Glyph: clock.
- **Completed Green** (#1a7f37 / tint #dafbe1): completed feedback, "Active" status chips, success toasts. Glyph: circle-check.
- **Archived Gray** (#59636e / tint #eaeef2): archived counts, neutral label chips (roles, kinds), disabled states. Glyph: archive (none for plain neutral labels).
- **Danger Red** (#d1242f / tint #ffebe9): rejected, disabled-account and error states, destructive menu items, invalid field borders. Glyph: circle-x.
- When the status catalog gives a status its own color, chips and counts take that hex inline with the same anatomy (12% background mix, 30% border mix); the glyph still follows the built-in tone.

### Neutral
- **Canvas** (#ffffff; dark #0d1117): page, table body, dialogs, menus, secondary buttons.
- **Gutter** (#f6f8fa; dark #161b22): nav rail, table header band, list-header rows, key chips, code blocks, segmented-control tracks, inset panels.
- **Gutter Strong** (#eaeef2; dark #21262d): hover on gutter surfaces (nav items), pressed secondary buttons, disabled button fill.
- **Ink** (#1f2328; dark #e6edf3): all primary text.
- **Muted Ink** (#59636e; dark #9198a1; 5.6:1 on white): table header labels, diffstat labels, descriptions, nav items at rest, disabled button text.
- **Faint Ink** (#6a737d; dark #7d8590): placeholders, zero counts, gutter row indices, the middle dots in the diffstat. Clears 4.5:1 on both the canvas and the gutter, so it is safe for real data; it stays the faintest step in the ramp.
- **Hairline** (#d0d7de; dark #3d444d): every structural border: rail edge, header bottom, table frame, inputs, chips, dialogs.
- **Hairline Muted** (#e6eaef; dark #262c36): row separators inside an already-bordered table or list, nav group separators, menu separators.
- **Overlay** (rgba(31,35,40,0.5); dark rgba(1,4,9,0.7)): the backdrop behind dialogs and the mobile drawer.

### Named Rules
**The Four Jobs Rule.** The brand color does exactly four jobs: links, focus, active nav, primary button. Everything else that is colored is a diff hue or a neutral. If a new surface wants brand color for a fifth reason, it is wrong.

**The Fixed Diff Rule.** The five state hues never change with tenant branding and are never reassigned to non-state meanings. A blue that is not "open", a green that is not "completed", a red that is not "danger" does not exist in this system.

**The Ink-on-Brand Rule.** Text on a filled brand surface in dark mode is ink (`--brand-foreground` = canvas), not white. Contrast is measured, not assumed.

**The Token Hairline Rule.** Every border is `var(--border)` or `var(--border-muted)`; foundation sets `border-color` globally so a bare `border` utility never falls back to `currentColor`. Raw Tailwind palette colors (`text-blue-600`, `bg-slate-100`) are forbidden in feature code.

## Typography

**Display Font:** none. The largest type in the system is the 20px page title.
**Body Font:** IBM Plex Sans Arabic (self-hosted woff2, weights 100–700; fallback Segoe UI, Tahoma, system-ui, sans-serif)
**Label/Mono Font:** IBM Plex Mono (self-hosted woff2, weights 400/500/600; fallback ui-monospace, SFMono-Regular, Menlo, monospace)

**Character:** One grotesque carries every word of UI in both Latin and Arabic, so the two languages set with the same rhythm and weight. The mono is reserved for data that benefits from alignment and fixed width: project keys, counts in gutters and diffstats, tool names, code snippets. Tabular numerals are on globally (`'tnum' 1`); mono additionally slashes zeros (`'zero' 1`). The pairing reads as a code-review tool, not a marketing site.

### Hierarchy
- **Headline** (600, 20px, 28px, -0.01em): the page title (`h1`) and the brand name on auth pages. The only place letter-spacing is tightened.
- **Title** (600, 16px, 24px): section headings (`h2`: Projects, Pending approvals) and dialog titles.
- **Body** (400, 14px, 20px): the base size on `html`. Row primary text is 500. Nav items are 500 at rest, 600 when active. Body copy measure ≤ 72ch.
- **Label** (500, 13px, 18px): table header cells, form field labels, secondary row text, segmented-control items, pagination footer, list-header meta. Always mixed case.
- **Chip** (500, 12px, 16px): state chips, hints, gutter row indices, the account trigger's role line, the "Requested" date, the tour step counter.
- **Data** (400 mono, 14px, 20px, tnum + zero): counts in tables and diffstats, key chips at 13px, code blocks at 13px, mono gutter index at 12px.

### Named Rules
**The Mixed-Case Rule.** No uppercase, no tracked labels, no kickers or eyebrows. Table headers are mixed case 13px/500 muted; a 12px sort glyph follows sortable labels. Emphasis comes from weight (500/600) and ink level, never from case or tracking.

**The Mono-for-Data Rule.** IBM Plex Mono appears only where a value must align or be copied: keys, counts, indices, snippets, tool names. Sans labels never go mono; mono values never carry sans decoration.

**The Two-Weight Rule.** Body text uses 400 and 500; headings use 600. 700 is loaded but unused in UI; 100–300 exist only for the font's completeness.

## Layout

The shell is a 48px header with a hairline bottom over a two-column body: a 240px nav rail on the gutter surface with a hairline end edge, and a main column with 24px padding whose content is capped at 1120px and start-aligned (not centered). Rail items are 32px tall with 16px icons, 8px horizontal margin, and group separators of muted hairline with 8px vertical margin. The rail footer (How to use, Installation steps) is pinned to the bottom above a muted hairline.

Every page follows one composition: title row (`h1` start, actions end, 16px below), optional 14px muted description, the diffstat line where a summary exists (24px below), then sections separated by 32px. A section is a 16px `h2` with 12px to its content; sections are not cards. When a section's content needs a boundary (a list, a table), the list itself carries the hairline frame, not the section.

**Root size.** `design/foundation.css` sets `html { font-size: 14px }`, so every rem-based Tailwind utility
renders at 87.5% of its nominal value in all three apps: `h-8` controls measure 28px, `h-11` rows 38.5px,
`h-10` header bands 35px, `p-6` dialog padding 21px. Pixel values elsewhere in this document are the
nominal Tailwind values (16px root) so they map one-to-one onto the utility classes in the code; the
rendered size is always 0.875 × nominal. Do not "fix" this by changing the root size or by adding
arbitrary `[Npx]` heights: parity depends on every app scaling the same way.

Spacing steps are 4 / 8 / 12 / 16 / 24 / 32. More space sits above a section heading (32) than below it (12). Controls are 32px tall (28px for the small size), table and list rows are 44px (`--row-h`), table header rows 40px, chips 24px, menu items 32px. Cell padding is 12px horizontal.

Responsive: below 768px the rail becomes an off-canvas drawer under the header with the overlay backdrop and a menu button appears in the header; the desktop rail stays in flow in both LTR and RTL. Tables keep every column and scroll horizontally inside their own rounded frame; the page itself never scrolls horizontally. The account trigger hides the name and role below the `sm` breakpoint. Auth pages are one 400px column, start-aligned inside a centered max-width, with no card around the form.

RTL: only logical utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `text-start`, `border-s`, `border-e`); directional icons (chevrons, arrows) mirror with `rtl:-scale-x-100` or `rtl:rotate-180`.

## Elevation & Depth

Flat by default. Nothing at rest casts a shadow: tables, lists, sections, inputs, buttons and the rail are separated by hairlines and by the canvas/gutter tonal step alone. Depth exists only for layers that float above the page, and those carry a soft two-layer offset shadow plus a hairline frame so they read as a sheet laid over the table.

### Shadow Vocabulary
- **Menu** (`box-shadow: 0 8px 24px rgba(31,35,40,0.12), 0 1px 2px rgba(31,35,40,0.08)`; dark `0 8px 24px rgba(1,4,9,0.6), 0 1px 2px rgba(1,4,9,0.5)`): dropdown and row-action menus, select popovers, toasts.
- **Dialog** (`box-shadow: 0 16px 32px rgba(31,35,40,0.18), 0 2px 6px rgba(31,35,40,0.1)`; dark `0 16px 32px rgba(1,4,9,0.7), 0 2px 6px rgba(1,4,9,0.5)`): modal dialogs and the tour spotlight panel, over the overlay backdrop.

### Named Rules
**The Floating-Only Rule.** A shadow means "this layer is not part of the page." If an element scrolls with the content, it has no shadow. Only `--shadow-menu` and `--shadow-dialog` exist; there is no small, medium or large.

**The Negative Rule.** Dark mode is the light table inverted (canvas #0d1117, gutter #161b22, hairline #3d444d), not a gray-on-gray theme. Tints become 12–20% alpha washes of the same hue so chips and flashes stay legible on the dark canvas.

## Shapes

Gently rounded, small-radius geometry throughout: 6px (`--radius`) on buttons, inputs, nav items, menus, tables and key chips; 4px on menu items and segmented-control items; 8px on dialogs; full pill on state chips and the scrollbar thumb. Corners never exceed 8px on a surface that is part of the page. Frames are always a 1px hairline; there are no 2px borders, no colored left borders, no border-only accents. Circular elements are limited to the 12–16px state glyphs, the 6px brand dot, and the pill chips; there are no icon tiles, avatar circles as decoration, or progress rings. The one focus treatment is a 2px brand ring outside the shape with 2px offset (0 offset on inputs), applied by foundation to every interactive element.

## Components

Restrained and precise: controls look like the review tool's own controls, never like marketing buttons. Every state is visible without color alone.

### Buttons
- **Shape:** gently rounded (6px), 32px tall, 12px horizontal padding, 14px/500 label, 16px icon with 6px gap, 150ms color transition. Small: 28px / 10px padding / 13px. Icon-only: 32×32.
- **Primary:** brand fill with brand-foreground text; hover shifts to brand-hover. One per view, in the merge position (end of the title row, or the empty state's first ghost row).
- **Secondary (default for most actions):** canvas fill, ink text, hairline border; hover gutter, active gutter-strong.
- **Ghost:** transparent, muted ink; hover gutter with ink text. Used for icon buttons in the header and for row-action triggers.
- **Destructive:** destructive red fill, white text; hover deepens. Danger-outline (secondary anatomy with danger text and danger tint on hover) for destructive row actions.
- **Link:** brand text, underline on hover, no height or padding.
- **Disabled:** tokenized, no opacity: gutter-strong fill, muted ink text, muted hairline, `cursor-not-allowed`. Loading replaces the leading icon with a 16px spinner and sets `aria-busy`.
- **Focus:** the global 2px brand ring, 2px offset.

### Chips (state chips / Badge)
- **Style:** 24px pill, 8px horizontal padding, 12px/500, 4px gap, tinted background of the state hue with a 30%-alpha hairline of the same hue, text in the full hue. Glyph 12px before the label.
- **State:** open = circle, ready/pending/warning = clock, completed/success/active = circle-check, archived = archive, danger/rejected/disabled = circle-x; brand tint for info/primary. Neutral label chips (roles, kinds, "Invite") use the archived tint with no glyph. A status-catalog color overrides the hue inline; anatomy is unchanged.

### Cards / Containers
- **Corner Style:** 6px on tables and lists (`rounded-md border border-border overflow-hidden`).
- **Background:** canvas; list-header rows and the table header band use gutter.
- **Shadow Strategy:** none at rest (see Elevation).
- **Border:** one hairline frame; rows inside separate with the muted hairline.
- **Internal Padding:** cells are `px-3 py-1.5` (12px horizontal, 6px vertical nominal) in all three apps; the row's 44px is a minimum, so a two-line identity cell grows to ~52px rendered rather than crowding. Sections themselves are never boxed.

### Inputs / Fields
- **Style:** 32px tall, 6px radius, hairline border, canvas background, 12px horizontal padding, 14px text, faint-ink placeholder. Select triggers end with a 16px chevron; textareas share the frame.
- **Focus:** the global 2px brand ring at 0 offset.
- **Error / Disabled:** invalid fields take a danger hairline with 12px danger error text and a 12px alert glyph beneath; the FormField wrapper renders label 13px/500 (12px above), hint 12px muted (6px below), the word "Required" in 12px muted after the label instead of an asterisk. Fields stack with 16px gaps.
- **Segmented control:** inline (never full width) gutter track with 2px padding and a hairline; 28px items at 13px/500 muted; the selected item is canvas with ink text and its own hairline.

### Navigation
- **Rail:** 240px, gutter surface, hairline end edge, 12px vertical padding. Items 32px, 6px radius, 8px side margin, 14px/500 muted ink, 16px icon, 10px gap; hover gutter-strong with ink text; active brand text at 600 on brand tint, no bar and no border. Groups (admin, Projects, super-admin, My Profile) separate with a muted hairline and 8px margins. Footer items (How to use, Installation steps) share the item style; a 6px brand dot at the end marks the install item until the first comment arrives.
- **Header:** 48px, canvas, hairline bottom, 16px side padding. Brand row is a 16px pin in brand color (rotated 45°) plus the product name at 14px/600, or the tenant logo at 24px tall. End side: the primary Installation-steps button (small) while nothing has been collected, otherwise a ghost rocket icon; then the account trigger: 20px user-circle, first name 14px/500 over role 12px muted, 16px chevron.
- **Mobile:** rail becomes a drawer under the header over the overlay; the header gains a ghost menu button.

### Data Table (shared DataTable)
Hairline-framed, 6px radius, header band on gutter at 40px with mixed-case 13px/500 muted labels and a 14px sort glyph (40% opacity when unsorted, full when sorted); body rows 44px separated by muted hairlines, hover gutter; cells 12px horizontal padding, 14px. An optional gutter column (40px wide, end-aligned, 12px mono faint) shows the 1-based row index. Numeric columns are end-aligned mono with tabular figures. Keys render as key chips (13px mono on gutter, 4px radius, 6px/2px padding). A trailing actions column holds a ghost icon button opening the row menu; a trailing chevron marks navigable rows and mirrors in RTL. Pagination footer (44px, hairline top, 13px muted, small secondary Previous/Next) appears only when there is more than one page. Empty: three ghost rows with dashed muted hairlines, the empty copy in the first row and the next action (small primary) at its end.

### Count Cell (signature)
A mono 14px number. When the count is greater than zero it takes its state hue and a 12px state glyph before it; when zero it is faint ink with no glyph. When a count changes after a refetch, the cell flashes its state tint (`.ds-flash`, 600ms ease-out, `--flash-tint`) and settles, the way a changed diff line lights up.

### Diffstat Line (signature)
The summary device that replaces stat tiles on Overview and My Profile: one wrapping 14px line, items separated by faint middle dots with 8px gaps; each item is a mono number in its state hue (neutral counts in ink) followed by a sans label in muted ink, taken from the catalog or i18n as given. Optional 12px glyph before a number (lock for private comments). Sits directly under the title row with 24px below.

### Menus
180px minimum, canvas, hairline frame, 6px radius, 4px padding, menu shadow; items 32px, 4px radius, 14px, 8px gap to a 16px icon, hover gutter; destructive items in danger red with danger tint on hover; separators are muted hairlines with 4px margins. Opens by scaling from 0.98 with fade over 120ms ease-out; no slide.

### Dialogs
Single-decision review panels: one task per dialog, dialogs never nest. Width min(520px, 100vw − 32px), 8px radius, hairline frame, canvas, dialog shadow over the overlay. Header 20px padding (12px below) with a 16px/600 title and optional 14px muted description; body 20px sides with 16px field gaps; footer 20px with secondary Cancel then the primary action, end-aligned, 8px gap. When a dialog genuinely holds two modes (invite vs create), a segmented control at the top picks the mode so only one set of fields is visible. Confirm dialogs use the same shell with a 14px message and the destructive button for destructive confirms. The tour spotlight uses the dialog grammar; its step counter is plain 12px mono muted text in the footer.

### Toasts
Bottom-end, canvas, hairline, 6px radius, menu shadow, 12px/8px padding, 14px text with a 16px state glyph at the start in its hue; `aria-live`.

### Tabs
Underline tabs: 36px row with a hairline bottom and 16px gaps; tab text 14px muted with a transparent 2px bottom border; active tab is ink at 500 with a brand bottom border.

### Code / Snippet Block
6px radius, hairline, gutter surface, 13px mono, 12px padding, horizontal scroll; a small ghost Copy button in the top end corner.

## Do's and Don'ts

### Do:
- **Do** use only foundation tokens and their Tailwind utilities (`bg-gutter`, `text-muted-foreground`, `border-border`, `text-state-open`, `shadow-menu`); never a raw palette class or a hard-coded hex in feature code.
- **Do** land every component addition in all three apps and in the shared layer names: React `components/ui/*` + `components/shared/*`, Vue `components/ui/*` + `components/shared/*`, Angular `shared/ui/app-*` + `shared/data-table/`. A component that exists in one app does not exist in the system.
- **Do** keep controls `h-8` (32px nominal, 28px rendered at the 14px root), rows `h-11` (44px nominal), radius 6px, base type 14px/20px with tabular numerals.
- **Do** render state as glyph + hue + label on chips, and as glyph + hue on counts only when the count is greater than zero (zero is faint, glyphless).
- **Do** let the chip supply its own glyph from its variant, and never pass a second icon into it. A chip whose text is a *label* rather than a state (a plan name, a role, a kind) uses the glyphless `neutral` variant; `archived` is the variant for the actual archived state.
- **Do** give every block-level Angular component `host: { class: 'block' }`, and bind conditional classes on a component element with `[class.x]`, never `[class]` (a custom element is inline by default and drops `space-y-*`; `[class]` loses to the component's host classes). The Angular layer is signal-only (`input()`, `model()`, `output()`, `viewChild()`, `host: {}`) with built-in control flow (`@if` / `@for`); decorator-era APIs and blanket `CommonModule` imports are out.
- **Do** keep identifiers unbreakable: a key chip is `shrink-0 whitespace-nowrap` and the name beside it truncates from a `min-w-0` cell. A mono identifier splitting across two lines reads as a broken value, and a wrapped prose cell doubles the row height. Wide tables scroll in their own container rather than reflowing.
- **Do** hold the dialog geometry at every width: `min(520px, 100vw − 32px)` with its radius intact, never a full-bleed square-cornered sheet on small screens. A wizard's step strip scrolls with nowrap labels rather than wrapping.
- **Do** float every popup panel (select list, menu, tooltip) out of the page flow: React and Vue portal theirs, Angular's go through a CDK connected overlay. A panel rendered as an absolutely-positioned child gets clipped by the first scrolling ancestor and grows that container's scrollbar, which is exactly what happened to selects inside dialogs. Panels match their trigger's width and flip above it when the viewport runs out.
- **Do** hover and highlight menu and option rows on the gutter surface, never on a brand tint; the brand's four jobs stay links, focus, active nav and the primary button. Inside a popup the focus ring hugs the row (`outline-offset: 0`) so it reads as a focused row rather than a box floating in the panel.
- **Do** summarize with a diffstat line (mono numbers in state hues, sans muted labels, faint middle dots) instead of stat tiles.
- **Do** zone a status column with its own state tint behind its hue in the header band, so a review queue reads as Open / Ready / Completed / Archived at a glance. All eight hue-on-tint pairs clear 4.5:1.
- **Do** give a toast the floating-layer grammar (canvas, hairline, menu shadow) with the state hue on its glyph and hairline only. A toast never fills with its state colour, and every toast is tagged with the state it reports.
- **Do** write table headers in mixed case at 13px/500 muted with a sort glyph on sortable columns.
- **Do** tokenize disabled buttons (gutter-strong fill, muted ink, muted hairline) rather than lowering opacity.
- **Do** use logical properties only and mirror directional icons in RTL; verify every surface in Arabic.
- **Do** keep dark `--brand-foreground` as ink; any new filled brand surface must pass 4.5:1 in both themes.
- **Do** keep dialogs to one decision; use a segmented mode switch when two flows share a dialog.
- **Do** add strings to `design/i18n/{en,ar}.json` and tokens to `design/foundation.css`, then sync; never edit a per-app copy.

### Don't:
- **Don't** add stat tiles, icon squares, progress rings, cards inside cards, colored left borders, or gradients.
- **Don't** cast a shadow on anything that scrolls with the page; only menus, dialogs and toasts float.
- **Don't** use uppercase, letter-spaced labels, kickers or eyebrows anywhere, including table headers and tour step counters.
- **Don't** use the brand color for anything beyond links, focus, active nav and the primary button, and never reassign a diff hue to a non-state meaning.
- **Don't** let a tenant's status colour paint text or a glyph. The five diff hues are fixed so state reads the same way in every workspace, and the catalog hexes fail AA as ink (#d97706 is 3.2:1, #16a34a is 3.3:1 on the canvas). The operator's colour appears as the swatch on the Statuses page; the tokens do the rest.
- **Don't** let color be the only signal; every state chip carries a glyph and a label.
- **Don't** center the main column; content is start-aligned within 1120px.
- **Don't** put a centered icon-in-a-circle empty state anywhere; use three dashed ghost rows or one line of muted copy plus the action.
- **Don't** use Angular Material, Material Icons or Roboto in the Angular app; the hand-written `shared/ui` layer is the only UI kit there.
- **Don't** use `pl-`/`pr-`/`left-`/`right-`/`text-left`/`text-right`; RTL is not optional.
- **Don't** add entrance animations; state transitions are 150ms, floating layers 120ms scale from 0.98, count flashes 600ms, and all of it collapses under `prefers-reduced-motion`.
