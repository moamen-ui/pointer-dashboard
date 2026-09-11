# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the workspace admin** (confirmed 2026-09-10). A developer or product person who owns a
Pointer tenant ("workspace"), wires the Pointer feedback widget into their own web app, invites
their team, and runs the feedback loop: stakeholders point at elements and comment, the admin's AI
coding agent (Claude Code, Cursor, …) pulls the comments and applies them to the code. They arrive
in the dashboard to get set up, to keep the workspace healthy (users, roles, projects, statuses,
environments), and to watch feedback volume. Design decisions optimize for this person first.

Secondary audiences (present in the code, not the priority):

- **Super admin / platform operator.** Manages the platform itself: tenants (including demo
  tenants and their expiry), plans and entitlements, white-label branding, access/email/demo
  settings. Does not create or use projects.
- **Stakeholder.** A non-admin workspace member (PM, tester, designer, developer) labeled by a role.
  Sees Projects and My Profile, can suggest predefined prompts, and otherwise works in the widget.

## Product Purpose

Pointer is a point-and-comment feedback tool for web apps: a visitor clicks any element in the
running app and leaves a comment; the team's AI agent then applies that feedback to the codebase.
This repository is the **admin dashboard** for Pointer, the console where a workspace is set up and
run. It exists so that a new workspace goes from "signed up" to "widget installed, feedback
flowing, agent applying it" without reading external docs, and so the admin can then manage
people, projects and feedback state with minimal ceremony.

Success for the primary user: the widget is installed in their app, comments start arriving, and
the agent-apply prompt works on the first try. Success for the operator: tenants, plans and
branding are adjustable without code changes.

## Positioning

The feedback goes from the clicked element straight into the developer's AI coding agent through
installed skills (`pointer-init` wires the widget into whatever stack is detected; `pointer-feedback`
pulls the queue and applies it). No ticket triage layer in between.

The dashboard deliberately **never renders comment bodies, author names, or captured element
data**. Comments appear only as aggregate counts and as a downloadable export. Private comments
are counted but hidden from admins. This is a product stance (privacy and safety of captured DOM),
not a missing feature.

The same dashboard ships in **three frameworks at feature and UX parity** (Angular, React, Vue),
each on its own live host. Parity is a product commitment, see Constraints.

## Operating Context

- **Getting started.** New workspace admins are shown a guided install (widget loader, mount,
  skills + credentials, login, leave feedback, apply with AI), also reachable any time from a
  header icon. A Chrome extension path exists as an alternative to the code snippet.
- **Demo sessions.** Visitors can start a time-limited demo tenant from the login page; widget
  credentials are emailed. The demo banner shows expiry and lets them keep the workspace.
- **Team setup.** Admins invite or directly create users, assign roles (custom roles can grant
  admin; roles can be "quick-access invite"), approve or reject sign-up requests.
- **Projects and environments.** A project groups the feedback for one app and has a key used by
  the widget. Environments (default, prod, staging, …) give a project a distinct app URL per
  deployment stage. Projects can capture console/network context for bug reports and hold
  predefined prompts.
- **Feedback state.** Built-in statuses (Open, Ready, Completed, Archived) can be relabeled,
  recolored and reordered per workspace.
- **Platform operations (super admin).** Tenants list with plan, projects and comments counts,
  demo expiry and per-tenant demo overrides; plan CRUD with enforced vs display-only entitlements;
  runtime branding (name, tagline, primary color, four URLs, six icon kinds); settings for
  self-signup, outgoing email (Brevo, daily cap) and demo defaults.
- **Environment.** Browser SPA, light and dark theme, English and Arabic with RTL. Backend and
  typed API clients live in the separate `poitner-api` repo. Production API:
  `api.pointer.moamen.work`; apps at `app-<framework>.pointer.moamen.work` (Angular also at
  `app.pointer.moamen.work`).

## Capabilities and Constraints

Confirmed binding constraints (2026-09-10):

- **Three-framework parity.** Angular, React and Vue must stay at identical features, routes,
  labels and states. No framework-only features. Every change is applied to all three apps.
- **White-label branding.** Operators can rename and re-logo the product at runtime. Nothing may
  hardcode the Pointer name or logo beyond the bundled fallback defaults used when branding is
  unset or fails to load.
- **Arabic and RTL first-class.** Every surface must work equally in Arabic (RTL) and English.
  Both locales ship together for every new string.
- **WCAG 2.2 AA** is a required standard, not a nice-to-have.
- **Fonts must be free / open-licensed.** No paid or proprietary typefaces. (User-stated.
  The current typeface, IBM Plex Sans Arabic, is OFL and satisfies this.)

Technical constraints from the codebase:

- All API access goes through the generated `@moamen-ui/pointer-<framework>` clients; no raw
  HTTP from feature code. Responses are the `Result<T>` envelope, unwrapped by each app.
- Styling is Tailwind CSS v4 in every app. UI kits: shadcn/ui (React), shadcn-vue (Vue), and
  spartan-ng (Angular; decided 2026-09-10 to replace Angular Material so all three apps share the
  shadcn component grammar). Tokens live once in `design/foundation.css` and are synced into each
  app with `design/sync-foundation.sh`. Shared per-app components (data table, row actions menu, form field, badge,
  confirm dialog, tabs) are the building blocks for list/form/dialog pages.
- Route guards layer authenticated → admin → super admin; the API enforces authorization.
- Terminology: **workspace** (user-facing) = **tenant** (operator-facing); **stakeholder** =
  non-admin member; **project key** = the identifier the widget uses; **Ready** is the user-facing
  label of the `ReadyToApply` status.

Explicitly undecided or not yet real:

- **Payments.** Plan selection at sign-up is display-only; subscription management waits on
  payment integration. Do not present plans as purchasable.
- **Auth storage.** JWT lives in `localStorage`; moving to an HttpOnly cookie is a possible
  future API-side hardening, not scheduled.

## Brand Commitments

- Name: **Pointer**; the dashboard's default title is "Pointer Admin". Both are runtime-overridable
  by the white-label branding, so they are defaults, not fixtures.
- Voice in existing copy: plain, second-person, instructional, short sentences, explains the
  "why" in hints (e.g. field hints on Settings, empty-state hints on every list). Keep it.
- The AI prompt step in the install guide stays in English regardless of locale because the
  `pointer-feedback` skill triggers on that text.
- Quality bar (confirmed 2026-09-10): the dashboard should sit alongside Linear, Vercel and Resend
  in finish and feel. Confirmed anti-references: a generic template look (indistinguishable from a
  shadcn or Material starter) and a dense, cold, gray-on-gray console.
- Visual world (chosen 2026-09-10 via the direction round): "The Review Margin", the grammar of
  pull-request review tools. Recorded as the standing direction; DESIGN.md documents it.

## Evidence on Hand

Stage: **live but early, no external proof** (confirmed 2026-09-10). Real tenants may exist but
there are no customer names, usage metrics, testimonials, press or case studies that may be cited.
**Never invent any of these.** Plans exist as configuration, not as proven pricing.

Real material available in this repo:

- Full product copy in `react/public/assets/i18n/en.json` and `ar.json` (mirrored in each app).
- Install-guide behaviour spec: `docs/superpowers/specs/2026-08-18-install-guide-design.md`.
- Branding and monetization UI specs: `docs/branding-ui-spec.md`, `docs/monetization-ui-spec.md`.
- Security/correctness review of all three apps: `docs/reviews/fable-dashboard-review.md`.
- Free font files (IBM Plex Sans Arabic, 7 weights) under each app's `public/assets/fonts/`.
- Live deployments of all three apps and the production API (URLs above) for screenshots.

## Product Principles

1. **First run is the product.** A new admin should reach "feedback flowing, agent applying"
   from inside the dashboard; every empty state points to the next real step.
2. **Operate, don't decorate.** This is a working console: scanability, consistent list/form/dialog
   patterns, and keyboard/RTL correctness outrank expression. Personality lives in copy and detail.
3. **Parity is a feature.** Anything a user can do in one framework's app they can do identically in
   the other two. Divergence is a bug unless documented as framework-specific.
4. **Show counts, never content.** Feedback bodies and captured DOM stay out of the admin UI;
   respect private comments.
5. **Truthful and configurable.** Branding, plans and statuses are data the operator owns; the UI
   never hardcodes what they can change, and never claims proof the product doesn't have.

## Accessibility & Inclusion

- WCAG 2.2 AA is required across all three apps.
- Full RTL layout and Arabic typography parity; language switch and direction persist.
- Light and dark themes are both first-class and must meet contrast in each.
- Everything reachable and operable by keyboard; dialogs, menus and tables follow the native
  patterns of each UI kit.
