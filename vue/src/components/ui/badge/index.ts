export { default as Badge } from './Badge.vue';

import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold leading-6',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        success: 'bg-success/15 text-success dark:bg-success/20',
        warning: 'bg-warning/15 text-warning dark:bg-warning/20',
        destructive: 'bg-destructive/10 text-destructive dark:bg-destructive/20',
        neutral: 'bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
