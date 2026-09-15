import { Component, inject, input } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LottieComponent, type AnimationOptions } from 'ngx-lottie';

/** Lottie JSON per variant, served from `src/assets/lottie/` (see `angular.json` assets). */
const LOTTIE_PATHS: Record<'empty' | 'no-results' | 'error', string> = {
  empty: '/assets/lottie/empty.json',
  'no-results': '/assets/lottie/no-results.json',
  error: '/assets/lottie/error.json',
};

/**
 * Empty state for tables and sections — a "Review Margin" Lottie animation (never a centered
 * icon circle) plus copy, with an optional trailing action.
 *
 * Three variants, one shared component (comment #192): `empty` (nothing in the dataset yet),
 * `no-results` (a search/filter matched nothing) and `error` (the list failed to load). Each
 * variant renders its own looping animation from `src/assets/lottie/`.
 *
 * A caller-supplied `message`/`hint` always wins; otherwise `empty`/`error` fall back to the
 * shared `table.*` copy (`no-results` has no fallback — the caller always passes the
 * query-aware string, e.g. `table.noResultsFor`).
 *
 *   <app-empty-state variant="empty" [message]="'roles.empty' | transloco" [hint]="'roles.emptyHint' | transloco">
 *     <button appButton variant="primary" size="sm" (click)="openAdd()">Add role</button>
 *   </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  // A custom element defaults to display:inline, which drops the vertical margins a parent's
  // `space-y-*` would otherwise put on it — blockify the host.
  host: { class: 'block' },
  standalone: true,
  imports: [LottieComponent],
  template: `
    <!-- Comment #193: the illustration leads, big, with the copy stacked underneath it and the
         action last — never side-by-side. The animations are square (256², 320², 75²), so the box
         is square too; the old 120x72 letterboxed them down to an effective 72px. -->
    <div
      class="flex flex-col items-center justify-center gap-4 text-center"
      [class.py-10]="inTable()"
      [class.px-4]="inTable()"
      [class.py-14]="!inTable()"
      [class.px-6]="!inTable()"
    >
      <ng-lottie
        class="block flex-none"
        aria-hidden="true"
        width="160px"
        height="160px"
        [options]="lottieOptions()"
      />

      <div class="min-w-0 max-w-sm" [attr.role]="variant() === 'error' ? 'alert' : null">
        <p class="text-[14px] text-muted-foreground">{{ resolvedMessage() }}</p>
        @if (resolvedHint()) {
          <p class="text-[13px] text-faint-foreground mt-1">{{ resolvedHint() }}</p>
        }
      </div>

      <div class="shrink-0 empty:hidden">
        <ng-content />
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  private readonly transloco = inject(TranslocoService);

  readonly variant = input<'empty' | 'no-results' | 'error'>('empty');
  readonly message = input('');
  readonly hint = input('');
  /** Table context: tighter padding to sit well inside a `<td>`/mobile row instead of a section. */
  readonly inTable = input(false);

  resolvedMessage(): string {
    if (this.message()) return this.message();
    if (this.variant() === 'error') return this.transloco.translate('table.error');
    if (this.variant() === 'empty') return this.transloco.translate('table.emptyDefault');
    return '';
  }

  resolvedHint(): string {
    if (this.hint()) return this.hint();
    if (this.variant() === 'error') return this.transloco.translate('table.errorHint');
    return '';
  }

  // Lottie ignores the CSS-level `prefers-reduced-motion` rule that covered the old SVGs, so a
  // reduced-motion preference is honored here in code: the animation still loads (first frame
  // renders) but does not autoplay/loop.
  private readonly prefersReducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  lottieOptions(): AnimationOptions {
    return {
      path: LOTTIE_PATHS[this.variant()],
      loop: !this.prefersReducedMotion,
      autoplay: !this.prefersReducedMotion,
    };
  }
}
