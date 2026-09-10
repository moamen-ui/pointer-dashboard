import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService as ApiAuthService, ForgotPasswordRequest } from '@moamen-ui/pointer-angular';
import { AppAuthLayoutComponent } from '../../shared/ui/app-auth-layout.component';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoModule,
    AppAuthLayoutComponent,
    AppInputDirective,
    AppButtonDirective,
  ],
  template: `
    <app-auth-layout>
      <div *transloco="let t">
        @if (sent()) {
          <p class="text-[14px] text-muted-foreground max-w-[72ch]">{{ t('auth.forgotSent') }}</p>
          <a routerLink="/login" appButton variant="primary" class="w-full">
            {{ t('auth.backToLogin') }}
          </a>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4" novalidate>
            <div class="flex flex-col gap-2">
              <label for="email" class="text-[14px] font-medium text-foreground">
                {{ t('login.email') }}
              </label>
              <input
                appInput
                id="email"
                type="email"
                formControlName="email"
                (blur)="emailTouched.set(true)"
                autocomplete="email"
              />
              @if (emailTouched() && emailError()) {
                <p class="text-[12px] text-state-danger">{{ emailError() }}</p>
              }
            </div>

            <button
              appButton
              variant="primary"
              type="submit"
              class="w-full"
              [disabled]="form.invalid || loading()"
            >
              {{ t('auth.forgotSubmit') }}
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
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private apiAuth = inject(ApiAuthService);
  private transloco = inject(TranslocoService);

  loading = signal(false);
  sent = signal(false);
  emailTouched = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  emailError(): string {
    const ctrl = this.form.controls.email;
    if (ctrl.hasError('required')) return 'Email is required.';
    if (ctrl.hasError('email')) return 'Enter a valid email address.';
    return '';
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const { email } = this.form.getRawValue();
    this.apiAuth.postApiAuthForgotPassword({ email } as ForgotPasswordRequest).subscribe({
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: () => {
        // Always show success to avoid email enumeration
        this.loading.set(false);
        this.sent.set(true);
      },
    });
  }
}
