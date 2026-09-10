import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  message: string;
  hint?: string;
  children?: ReactNode;
}

/**
 * Empty state per §3 brief: one line of muted copy + optional action form.
 * No icon circle (icon param ignored for backward compatibility).
 * Used inside tables (ghost rows) or standalone sections.
 */
export function EmptyState({
  icon: _Icon,
  message,
  hint,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex items-center gap-4 text-[14px] text-muted-foreground">
      <span>{message}</span>
      {hint && <span className="text-[13px]">{hint}</span>}
      {children && <div className="ms-auto">{children}</div>}
    </div>
  );
}
