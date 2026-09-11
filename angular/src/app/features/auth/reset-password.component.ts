import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService as ApiAuthService, ResetPasswordRequest } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { AppAuthLayoutComponent } from '../../shared/ui/app-auth-layout.component';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppFormFieldComponent } from '../../shared/ui/app-form-field.component';
import { AppToastService } from '../../shared/ui/app-toast.service';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPwd = control.get('newPassword');
  const confirm = control.get('confirmPassword');
  if (!newPwd || !confirm) return null;
  return newPwd.value === confirm.value ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoModule,
    AppAuthLayoutComponent,
    AppInputDirective,
    AppButtonDirective,
    AppFormFieldComponent,
  ],
  template: `
    <app-auth-layout>
      <div *transloco="let t">
        @if (!token()) {
          <p class="text-[14px] text-state-danger">{{ t('auth.resetInvalid') }}</p>
          <a routerLink="/login" appButton variant="primary" class="w-full">
            {{ t('auth.backToLogin') }}
          </a>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4" novalidate>
            <app-form-field [label]="t('auth.newPassword')" [error]="passwordTouched() && newPasswordError() ? newPasswordError() : ''">
              <input
                appInput
                type="password"
                formControlName="newPassword"
                (blur)="passwordTouched.set(true)"
                autocomplete="new-password"
              />
            </app-form-field>

            <app-form-field [label]="t('auth.confirmPassword')" [error]="confirmTouched() && form.hasError('passwordsMismatch') ? t('auth.passwordMismatch') : ''">
              <input
                appInput
                type="password"
                formControlName="confirmPassword"
                (blur)="confirmTouched.set(true)"
                autocomplete="new-password"
              />
            </app-form-field>

            <button
              appButton
              variant="primary"
              type="submit"
              class="w-full"
              [disabled]="form.invalid || loading()"
            >
              {{ t('auth.resetSubmit') }}
            </button>

            <a routerLink="/login" class="text-center text-[13px] text-brand hover:text-brand/80">
              {{ t('auth.backToLogin') }}
            </a>
          </form>
        }
      </div>
    </app-auth-layout>
  `,
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private apiAuth = inject(ApiAuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(AppToastService);

  loading = signal(false);
  token = signal<string | null>(null);
  passwordTouched = signal(false);
  confirmTouched = signal(false);

  form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator }
  );

  ngOnInit(): void {
    const t = this.route.snapshot.queryParamMap.get('token');
    this.token.set(t);
  }

  newPasswordError(): string {
    const ctrl = this.form.controls.newPassword;
    if (ctrl.hasError('required')) return 'Password is required.';
    if (ctrl.hasError('minlength')) return 'Password must be at least 8 characters.';
    return '';
  }

  submit() {
    if (this.form.invalid || !this.token()) return;
    this.loading.set(true);
    const { newPassword } = this.form.getRawValue();
    this.apiAuth.postApiAuthResetPassword({ token: this.token()!, newPassword } as ResetPasswordRequest).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.show('Password reset successfully. Redirecting to login...', 'success');
        setTimeout(() => this.router.navigateByUrl('/login'), 1000);
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.toast.show(extractMessage(e) || 'Invalid or expired reset link.', 'danger');
      },
    });
  }
}
