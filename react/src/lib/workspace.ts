// Shared helper for rendering a WorkspaceChoice's name (DB-11b). The API sends the literal
// placeholder string (`Workspace.PlaceholderName` = "Workspace" in the API repo) when a
// workspace has not been named yet, rather than a separate boolean flag on WorkspaceChoice
// (unlike WorkspaceResponse's `isPlaceholderName`) — so every screen that renders a
// WorkspaceChoice (the login picker, the Shell's workspace switcher) matches it here once.
const PLACEHOLDER_WORKSPACE_NAME = 'Workspace';

export function isPlaceholderWorkspaceName(name: string | null | undefined): boolean {
  return !name || name === PLACEHOLDER_WORKSPACE_NAME;
}
