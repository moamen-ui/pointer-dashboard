import { cva, type VariantProps } from 'class-variance-authority';

export { default as Button } from './Button.vue';

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-gutter-strong disabled:text-muted-foreground disabled:border-border-muted [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        success:
          'bg-success text-success-foreground hover:bg-success/90',
        warning:
          'bg-warning text-warning-foreground hover:bg-warning/90',
        outline:
          'border border-input bg-background hover:bg-gutter hover:text-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-gutter hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // max-md: bumps every button's touch target below the mobile
        // breakpoint (desktop height is untouched — DESIGN.md's 32px control
        // grammar stays exactly as documented at md and up).
        default: 'h-8 px-3 max-md:h-10',
        sm: 'h-7 rounded-md px-2.5 text-[13px] max-md:h-10',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-8 w-8 max-md:h-11 max-md:w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
