import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A collapsible settings section: the card header is the click target and the body
 * expands under it. Built on native <details>/<summary> so keyboard support, focus
 * and the open/closed semantics come from the platform — no dependency, and no
 * JS state to keep in sync.
 *
 * Pass `open` + `onOpenChange` to drive the section from the outside — that is how
 * callers build a single-open accordion (comment #76): each section's `open` comes
 * from one shared state value, so opening one collapses the others. Omit both for
 * the original standalone behavior.
 */
export function AccordionSection({
  title,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
  className,
}: {
  /** Header content — a string, or nodes when the header carries a badge. */
  title: ReactNode;
  defaultOpen?: boolean;
  /** Controlled open state; omit for standalone use. */
  open?: boolean;
  /** Fired from the native toggle — only meaningful together with `open`. */
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      open={open ?? defaultOpen}
      onToggle={(e) => onOpenChange?.((e.currentTarget as HTMLDetailsElement).open)}
      className={cn('group rounded-lg border border-border bg-card', className)}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden"
      >
        <span className="flex flex-1 items-center gap-2">{title}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="flex flex-col gap-4 border-t border-border px-6 py-4">{children}</div>
    </details>
  );
}
