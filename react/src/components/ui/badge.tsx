import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Archive, Circle, CircleCheck, CircleX, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// State chip (§3): h-6 rounded-full hairline chip, 12px/500, glyph + label. Color is never the only signal.
const badgeVariants = cva(
  'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] font-medium leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'text-brand bg-brand-tint border-brand/30',
        open: 'text-state-open bg-state-open-tint border-state-open/30',
        success: 'text-state-completed bg-state-completed-tint border-state-completed/30',
        warning: 'text-state-ready bg-state-ready-tint border-state-ready/30',
        destructive: 'text-state-danger bg-state-danger-tint border-state-danger/30',
        archived: 'text-state-archived bg-state-archived-tint border-state-archived/30',
        neutral: 'text-state-archived bg-state-archived-tint border-state-archived/30',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

const glyphs: Record<NonNullable<BadgeProps['variant']>, React.ComponentType<{ className?: string }> | null> = {
  default: null,
  open: Circle,
  success: CircleCheck,
  warning: Clock,
  destructive: CircleX,
  archived: Archive,
  neutral: null, // plain labels (roles, kinds) carry no state glyph
};

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    /** Hide the state glyph (only for chips that are labels, not states). */
    hideGlyph?: boolean;
  };

function Badge({ className, variant, hideGlyph, children, ...props }: BadgeProps) {
  const Glyph = glyphs[variant ?? 'default'];
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {Glyph && !hideGlyph && <Glyph className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
