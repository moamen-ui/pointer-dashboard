import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Soft status pill. Maps onto the theme-aware `.chip-*` classes (the same source
// of truth the hand-rolled status spans in the feature pages use), so a badge and
// a chip of the same meaning always match — parity with angular's BadgeComponent.
const badgeVariants = cva('chip', {
  variants: {
    variant: {
      default: 'chip-primary',
      success: 'chip-active',
      warning: 'chip-warn',
      destructive: 'chip-disabled',
      neutral: 'chip-neutral',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
