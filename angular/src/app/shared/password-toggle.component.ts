import { Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Show/hide toggle for password inputs. Place it inside a mat-form-field as a
 * suffix and bind the input's [type] to the exposed `type()` signal — one
 * instance per field so each toggles independently:
 *
 *   <mat-form-field appearance="outline">
 *     <mat-label>...</mat-label>
 *     <input matInput [type]="pw.type()" formControlName="password" />
 *     <app-password-toggle matSuffix #pw />
 *   </mat-form-field>
 */
@Component({
  selector: 'app-password-toggle',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, TranslocoModule],
  template: `
    <button
      mat-icon-button
      type="button"
      (click)="toggle()"
      [attr.aria-label]="(hidden() ? 'common.showPassword' : 'common.hidePassword') | transloco"
      [attr.aria-pressed]="!hidden()">
      <mat-icon>{{ hidden() ? 'visibility' : 'visibility_off' }}</mat-icon>
    </button>
  `,
})
export class PasswordToggleComponent {
  /** Whether the password is currently masked. */
  readonly hidden = signal(true);
  /** Input type to bind: 'password' while masked, 'text' while revealed. */
  readonly type = computed(() => (this.hidden() ? 'password' : 'text'));

  toggle(): void {
    this.hidden.update((v) => !v);
  }
}
