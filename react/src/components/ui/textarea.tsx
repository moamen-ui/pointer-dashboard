import * as React from 'react';
import { cn } from '@/lib/utils';

/** Textarea — shares Input's frame exactly (DESIGN.md Inputs/Fields: "textareas share the
 *  frame"): same border, radius, focus ring and disabled treatment, but height comes from
 *  `rows` instead of the fixed 32px control height. */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, rows = 3, ...props }, ref) => {
    return (
      <textarea
        rows={rows}
        className={cn(
          'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-gutter-strong disabled:text-muted-foreground resize-none',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
