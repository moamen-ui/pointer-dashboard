import type { ReactNode } from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  message: string;
  hint?: string;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  message,
  hint,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint">
        <Icon className="h-7 w-7 text-brand" />
      </div>
      <p className="m-0 text-[0.95rem] font-semibold text-ink">{message}</p>
      {hint && (
        <p className="m-0 max-w-sm text-[0.82rem] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
