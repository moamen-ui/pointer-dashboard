export { default as Badge } from './Badge.vue';

import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] font-medium leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-brand-tint text-brand border-brand/30',
        open: 'bg-state-open-tint text-state-open border-state-open/30',
        ready: 'bg-state-ready-tint text-state-ready border-state-ready/30',
        pending: 'bg-state-ready-tint text-state-ready border-state-ready/30',
        warning: 'bg-state-ready-tint text-state-ready border-state-ready/30',
        completed: 'bg-state-completed-tint text-state-completed border-state-completed/30',
        success: 'bg-state-completed-tint text-state-completed border-state-completed/30',
        active: 'bg-state-completed-tint text-state-completed border-state-completed/30',
        archived: 'bg-state-archived-tint text-state-archived border-state-archived/30',
        neutral: 'bg-state-archived-tint text-state-archived border-state-archived/30',
        disabled: 'bg-state-danger-tint text-state-danger border-state-danger/30',
        rejected: 'bg-state-danger-tint text-state-danger border-state-danger/30',
        danger: 'bg-state-danger-tint text-state-danger border-state-danger/30',
        destructive: 'bg-state-danger-tint text-state-danger border-state-danger/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
