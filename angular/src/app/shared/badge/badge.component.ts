import { Component, computed, input } from '@angular/core';
import { AppIconComponent } from '../ui/app-icon.component';
import type { Severity } from '../severity';

/**
 * State chip (Badge): inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px]
 * font-medium leading-none; severity-based colors using foundation tokens.
 *
 *   <app-badge severity="success">{{ 'common.active' | transloco }}</app-badge>
 */
@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [AppIconComponent],
  template: `
    <span
      class="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] font-medium leading-none"
      [class]="badgeClass()"
    >
      @if (iconName(); as icon) {
        <app-icon [name]="icon" [size]="12" class="flex-shrink-0"></app-icon>
      }
      <ng-content></ng-content>
    </span>
  `,
})
export class BadgeComponent {
  readonly severity = input<Severity>('neutral');

  protected readonly badgeClass = computed(() => {
    switch (this.severity()) {
      case 'success':
        return 'text-state-completed bg-state-completed-tint border-state-completed/30';
      case 'danger':
        return 'text-state-danger bg-state-danger-tint border-state-danger/30';
      case 'warning':
        return 'text-state-ready bg-state-ready-tint border-state-ready/30';
      case 'primary':
        return 'text-brand bg-brand-tint border-brand/30';
      case 'archived':
        return 'text-state-archived bg-state-archived-tint border-state-archived/30';
      default:
        return 'text-state-archived bg-state-archived-tint border-state-archived/30';
    }
  });

  protected readonly iconName = computed(() => {
    switch (this.severity()) {
      case 'success':
        return 'check-circle';
      case 'danger':
        return 'x-circle';
      case 'warning':
        return 'clock';
      case 'archived':
        return 'archive';
      // `primary` and `neutral` are label chips (plan names, roles, kinds): no state glyph,
      // mirroring React's `glyphs.neutral = null`.
      default:
        return undefined;
    }
  });
}
