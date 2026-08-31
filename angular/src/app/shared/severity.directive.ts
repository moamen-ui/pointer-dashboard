import { Directive, HostBinding, input } from '@angular/core';
import type { Severity } from './severity';

/**
 * Applies the shared severity vocabulary to an existing Material element (a button, an
 * icon-button, a menu item, or the icon inside one) without wrapping it in a new component.
 * `primary`/`danger` should still also set Material's own `color="primary"|"warn"` where the
 * host element accepts a `color` input (mat-button, mat-icon-button) — this directive only
 * covers the cases Material's `color` input doesn't reach (mat-menu-item, mat-icon, and
 * `success`/`warning`/`neutral`, which have no Material color role at all).
 *
 *   <button mat-menu-item [appSeverity]="'danger'" (click)="delete(row)">
 *     <mat-icon [appSeverity]="'danger'">delete</mat-icon> {{ 'common.delete' | transloco }}
 *   </button>
 */
@Directive({
  selector: '[appSeverity]',
  standalone: true,
})
export class SeverityDirective {
  readonly appSeverity = input<Severity>('neutral');

  @HostBinding('class')
  get hostClass(): string {
    switch (this.appSeverity()) {
      case 'danger':
        return 'severity-danger';
      case 'success':
        return 'severity-success';
      case 'warning':
        return 'severity-warning';
      case 'primary':
        return 'severity-primary';
      default:
        return '';
    }
  }
}
