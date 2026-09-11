import { Component, computed, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { AppButtonDirective } from './ui/app-button.directive';
import { AppIconComponent } from './ui/app-icon.component';

/**
 * Show/hide toggle for password inputs (§3 ghost icon button, 16px lucide eye / eye-off).
 * Bind the input's `[type]` to `toggle.type()`:
 *
 *   <div class="relative">
 *     <input appInput [type]="pw.type()" class="pe-9" />
 *     <app-password-toggle #pw class="absolute end-1 top-1" />
 *   </div>
 */
@Component({
  selector: 'app-password-toggle',
  standalone: true,
  imports: [TranslocoModule, AppButtonDirective, AppIconComponent],
  template: `
    <button
      appButton
      variant="ghost"
      size="icon"
      type="button"
      class="h-6 w-6"
      (click)="toggle()"
      [attr.aria-label]="(hidden() ? 'common.showPassword' : 'common.hidePassword') | transloco"
      [attr.aria-pressed]="!hidden()"
    >
      <app-icon [name]="hidden() ? 'eye' : 'eye-off'" [size]="16"></app-icon>
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
