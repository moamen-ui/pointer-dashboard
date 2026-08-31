import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { RowActionItem, Severity } from './types';

/**
 * The single severity → class mapping for menu items. Before this component,
 * every feature page hand-duplicated `className="text-destructive focus:text-destructive"`
 * on its delete items; now severity styling lives in exactly one place. The class is
 * applied to both the item and its icon (the icon inherits the item's currentColor,
 * but the explicit class keeps that true even if the base styles change).
 */
const severityClass: Record<Severity, string> = {
  danger: 'text-destructive focus:text-destructive',
  success: 'text-success focus:text-success',
  warning: 'text-warning focus:text-warning',
  // Primary and neutral keep the default menu-item text color.
  primary: '',
  neutral: '',
};

/**
 * The kebab trigger + item list every table's "Actions" column renders. Pass the
 * row's *already permission/feature-gated* item list — this component only owns
 * menu chrome/styling, never business rules about which items exist. Renders
 * nothing when the caller gates everything out (items.length === 0).
 */
export function RowActionsMenu({
  items,
  ariaLabel = 'Actions',
}: {
  items: RowActionItem[];
  ariaLabel?: string;
}) {
  if (items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={ariaLabel}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => {
          const severity = item.severity ?? 'neutral';
          const cls = severityClass[severity];
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.label}
              disabled={item.disabled}
              title={item.disabled ? item.tooltip : undefined}
              className={cn(cls)}
              onSelect={() => item.onClick()}
            >
              {Icon && <Icon className={cn('h-4 w-4', cls)} />}
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
