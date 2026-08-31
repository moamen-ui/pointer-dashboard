import type { ComponentType } from 'react';

/**
 * The shared severity vocabulary used by RowActionsMenu (and future shared
 * components). `neutral` isn't a "severity" so much as a background-only state
 * that the same components need a slot for. Mirrors angular's shared Severity.
 */
export type Severity = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface RowActionItem {
  label: string;
  /** A lucide-react icon component. */
  icon?: ComponentType<{ className?: string }>;
  severity?: Severity;
  disabled?: boolean;
  /** Shown on the item when `disabled` (e.g. "requires the app URL to be set"). */
  tooltip?: string;
  onClick: () => void;
}
