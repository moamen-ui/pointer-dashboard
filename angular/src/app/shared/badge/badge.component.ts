import { Component, computed, input } from '@angular/core';
import type { Severity } from '../severity';

/**
 * A colored status pill. Formalizes the old ad hoc `.chip-active`/`.chip-disabled`/
 * `.chip-neutral` classes into one component driven by the shared severity vocabulary,
 * so a status badge and a severity button/menu-item of the same meaning always match.
 *
 *   <app-badge severity="success">{{ 'common.active' | transloco }}</app-badge>
 */
@Component({
  selector: 'app-badge',
  standalone: true,
  template: `<span class="chip" [class]="chipClass()"><ng-content /></span>`,
})
export class BadgeComponent {
  readonly severity = input<Severity>('neutral');

  // Deliberately reuses the existing `.chip-active`/`.chip-disabled` classes (same green/red
  // tokens already used app-wide for boolean active/inactive state) rather than introducing
  // parallel `.chip-success`/`.chip-danger` classes with identical colors — `danger` mapping to
  // the class literally named `chip-disabled` reads oddly, but it's the same visual token, not a
  // second color system.
  protected readonly chipClass = computed(() => {
    switch (this.severity()) {
      case 'success':
        return 'chip-active';
      case 'danger':
        return 'chip-disabled';
      case 'warning':
        return 'chip-warn';
      case 'primary':
        return 'chip-primary';
      default:
        return 'chip-neutral';
    }
  });
}
