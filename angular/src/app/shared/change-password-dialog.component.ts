import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MeService } from '@moamen-ui/pointer-angular';
import { AuthService } from '../core/auth/auth.service';
import { extractMessage } from '../core/api/extract-message';
import { AppButtonDirective } from './ui/app-button.directive';
import { AppInputDirective } from './ui/app-input.directive';
import { AppFormFieldComponent } from './ui/app-form-field.component';
import { AppIconComponent } from './ui/app-icon.component';
import { AppToastService } from './ui/app-toast.service';

/**
 * Self-service change-password, opened from the profile menu. Success rotates the server-side
 * SecurityStamp (invalidates every session, including this one — same as password reset), so we
 * clear the local session and send the user back to /login rather than pretending to stay signed in.
 */
@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    AppButtonDirective,
    AppInputDirective,
    AppFormFieldComponent,
    AppIconComponent,
  ],
  template: `
    <div class="px-5 pt-5 pb-3 border-b border-border">
      <h2 class="m-0 text-base font-semibold text-foreground">
        {{ 'changePassword.title' | transloco }}
      </h2>
    </div>

    <div class="px-5 py-4 space-y-4">
      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
        <app-form-field label="{{ 'changePassword.current' | transloco }}">
          <div class="relative">
            <input
              appInput
              [type]="currentPasswordVisible() ? 'text' : 'password'"
              formControlName="currentPassword"
              placeholder=""
            />
            <button
              type="button"
              appButton
              variant="ghost"
              size="icon"
              class="absolute end-0 top-1/2 -translate-y-1/2"
              (click)="currentPasswordVisible.update(v => !v)"
            >
              <app-icon
                [name]="currentPasswordVisible() ? 'eye-off' : 'eye'"
                [size]="16"
              ></app-icon>
            </button>
          </div>
        </app-form-field>

        <app-form-field label="{{ 'changePassword.new' | transloco }}">
          <div class="relative">
            <input
              appInput
              [type]="newPasswordVisible() ? 'text' : 'password'"
              formControlName="newPassword"
              placeholder=""
            />
            <button
              type="button"
              appButton
              variant="ghost"
              size="icon"
              class="absolute end-0 top-1/2 -translate-y-1/2"
              (click)="newPasswordVisible.update(v => !v)"
            >
              <app-icon
                [name]="newPasswordVisible() ? 'eye-off' : 'eye'"
                [size]="16"
              ></app-icon>
            </button>
          </div>
        </app-form-field>

        <app-form-field label="{{ 'changePassword.confirm' | transloco }}">
          <div class="relative">
            <input
              appInput
              [type]="confirmPasswordVisible() ? 'text' : 'password'"
              formControlName="confirmPassword"
              placeholder=""
            />
            <button
              type="button"
              appButton
              variant="ghost"
              size="icon"
              class="absolute end-0 top-1/2 -translate-y-1/2"
              (click)="confirmPasswordVisible.update(v => !v)"
            >
              <app-icon
                [name]="confirmPasswordVisible() ? 'eye-off' : 'eye'"
                [size]="16"
              ></app-icon>
            </button>
          </div>
        </app-form-field>
      </form>
    </div>

    <div class="px-5 pb-5 pt-3 flex justify-end gap-2 border-t border-border">
      <button appButton variant="secondary" size="sm" type="button" (click)="close()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        appButton
        variant="primary"
        size="sm"
        type="button"
        (click)="submit()"
        [disabled]="form.invalid || busy()"
      >
        {{ 'changePassword.submit' | transloco }}
      </button>
    </div>
  `,
})
export class ChangePasswordDialogComponent {
  private fb = inject(FormBuilder);
  private meService = inject(MeService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(AppToastService);
  private transloco = inject(TranslocoService);

  busy = signal(false);
  currentPasswordVisible = signal(false);
  newPasswordVisible = signal(false);
  confirmPasswordVisible = signal(false);

  form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return;
    const { currentPassword, newPassword, confirmPassword } = this.form.getRawValue();
    if (newPassword !== confirmPassword) {
      this.toast.show(this.transloco.translate('changePassword.mismatch'), 'danger');
      return;
    }
    this.busy.set(true);
    this.meService.postApiMeChangePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.transloco.translate('changePassword.success'), 'success');
        // The security-stamp rotation invalidated this session's token server-side too — clear it
        // locally and send the user to sign back in with the new password.
        this.auth.clearSession();
        this.router.navigateByUrl('/login');
        this.close();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  close(): void {
    window.dispatchEvent(new CustomEvent('closeDialog'));
  }
}
