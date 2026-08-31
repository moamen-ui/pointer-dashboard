/**
 * The shared severity vocabulary used by app-badge, [appSeverity] and
 * app-row-actions-menu. `neutral` isn't a "severity" so much as a background-only
 * state (private/disabled) that the same components need a slot for.
 */
export type Severity = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
