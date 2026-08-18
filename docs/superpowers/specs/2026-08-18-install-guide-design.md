# Install guide — reachable from the header, auto-shown to new workspaces

**Status:** approved 2026-08-18

## Problem

The Pointer installation steps (load the widget, mount it, install the agent skills, add
credentials, leave feedback, apply with AI) live inside `DemoPanel` — a banner that renders
only while `sessionStorage['pointer_demo']` exists. Two consequences:

1. A permanent account never sees the steps at all, even though every tenant needs them to
   wire the widget into an app.
2. `dismiss()` **deletes** the demo session, so dismissing the banner destroys the project
   key and widget login with no way to get them back.

## Goal

- Any authenticated user can open the installation steps from the header, at any time.
- A workspace admin gets them opened automatically when they are new to the dashboard.

## Design

### Entry points

**Header icon** — a rocket icon button in the toolbar (before the theme toggle), tooltip
"Installation steps", visible to every authenticated user. It shows a small brand-coloured
dot while the workspace has no comments yet: that is the "hint", and it disappears on its own
once feedback starts arriving.

**Auto-open** — on shell load, for **workspace admins only**:

```
suppressed              → never auto-open        (explicit "Don't show this again")
else firstTime || comments === 0 → open once per browser session
```

- `firstTime` = no "seen" record for this user id in `localStorage`.
- `comments` = `totals.comments` from `GET /api/admin/stats`, fetched only when `isAdmin`.
- "once per browser session" is a `sessionStorage` marker, so a reload does not nag.

Keys (per user id, so a shared browser behaves): `pointer_install_seen:<id>`,
`pointer_install_suppressed:<id>`, `pointer_install_shown_session:<id>`.

### The guide itself

One dialog component per app, fed by three inputs:

| Input | Demo session | Permanent account |
|---|---|---|
| server | session `serverUrl` | `apiBase` from env |
| project key | session `projectKey` | picked from the user's projects |
| credentials | widget email + password from the session | signed-in email + a `<your password>` placeholder |

- Project picker is fed by `GET /api/admin/projects` (plain `[Authorize]`, so stakeholders
  get their own list too). One project → preselected. **No** projects → the snippet renders
  `<your-project-key>` and the dialog links to Projects to create one.
- The six steps, their snippets and copy buttons keep today's content; only the credentials
  step branches. The AI prompt step stays English — the `pointer-feedback` skill triggers on it.

### Demo banner

Keeps the countdown, credentials and "Keep this workspace". Its inline stepper is replaced by
a "View installation steps" button that opens the same dialog, so the steps have one source of
truth. `dismiss()` stops deleting the session and only sets a hide flag — otherwise dismissing
throws away credentials the guide still needs.

## Scope

- Applies to all three apps (`angular/`, `react/`, `vue/`) per the repo's parity rule.
- Reuses the existing `demo.step*` i18n keys; adds `install.*` keys to `en.json` and `ar.json`.
- No API change. No persisted setup progress — the guide is read-only.

## Testing

- Unit: step builder (demo vs permanent credentials; `<your-project-key>` when the user has no
  projects) and the auto-open gate (admin + (firstTime || zero comments) + not suppressed).
- Browser: icon opens the dialog in each app; auto-open fires for an admin with zero comments
  and not for a non-admin; "Don't show this again" survives a reload.
