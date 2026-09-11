import { Component, Directive, computed, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'danger-outline' | 'link';
export type ButtonSize = 'default' | 'sm' | 'icon';

const BASE =
  'rounded-md text-[14px] font-medium inline-flex items-center gap-1.5 transition-colors duration-150';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-foreground hover:bg-brand-hover',
  secondary: 'bg-background text-foreground border border-border hover:bg-gutter active:bg-gutter-strong',
  ghost: 'text-muted-foreground hover:bg-gutter hover:text-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover',
  'danger-outline': 'bg-background text-state-danger border border-border hover:bg-state-danger-tint',
  link: 'text-brand underline-offset-4 hover:underline h-auto px-0',
};

const SIZES: Record<ButtonSize, string> = {
  default: 'h-8 px-3',
  sm: 'h-7 px-2.5 text-[13px]',
  icon: 'w-8 px-0 h-8',
};

/**
 * Button: 32px (28px small), 6px radius, 14px/500 label with a 6px gap to a 16px icon.
 *
 * Disabled is tokenized (gutter-strong fill, muted ink, muted hairline) rather than dimmed with
 * opacity, and focus comes from the foundation's global `:focus-visible` outline.
 */
@Directive({
  selector: '[appButton]',
  standalone: true,
  host: {
    '[class]': 'buttonClasses()',
    '(click)': 'onClick($event)',
  },
})
export class AppButtonDirective {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('default');
  readonly disabled = input(false);
  readonly loading = input(false);

  protected readonly buttonClasses = computed(() => {
    const inert = this.disabled() || this.loading();
    return [
      BASE,
      VARIANTS[this.variant()],
      SIZES[this.size()],
      inert
        ? 'pointer-events-none cursor-not-allowed bg-gutter-strong text-muted-foreground border-border-muted'
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  });

  protected onClick(event: MouseEvent): void {
    if (this.disabled() || this.loading()) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
}

/** Component wrapper for callers that would rather not put the directive on a bare `<button>`. */
@Component({
  selector: 'app-button',
  standalone: true,
  imports: [AppButtonDirective],
  template: `
    <button
      appButton
      [variant]="variant()"
      [size]="size()"
      [disabled]="disabled() || loading()"
      class="relative"
      [type]="type()"
      [attr.aria-busy]="loading()"
    >
      <ng-content></ng-content>
    </button>
  `,
})
export class AppButtonComponent {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('default');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
}
