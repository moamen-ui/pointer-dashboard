import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { DemoService, DemoRequest, DemoSessionResponse } from '@moamen-ui/pointer-angular';
import { AuthService } from '../../core/auth/auth.service';
import { extractMessage } from '../../core/api/extract-message';
import { AppAuthLayoutComponent } from '../../shared/ui/app-auth-layout.component';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppToastService } from '../../shared/ui/app-toast.service';

const DEMO_SESSION_KEY = 'pointer_demo';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
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
            @if (emailTouched() || submitted()) {
              @if (emailError()) {
                <p class="text-[12px] text-state-danger">{{ emailError() }}</p>
              }
            }
          </div>

          <div class="flex flex-col gap-2">
            <label for="password" class="text-[14px] font-medium text-foreground">
              {{ t('login.password') }}
            </label>
            <input
              appInput
              id="password"
              type="password"
              formControlName="password"
              (blur)="passwordTouched.set(true)"
              autocomplete="current-password"
            />
            @if (passwordTouched() || submitted()) {
              @if (passwordError()) {
                <p class="text-[12px] text-state-danger">{{ passwordError() }}</p>
              }
            }
          </div>

          @if (error()) {
            <p class="text-[14px] text-state-danger">{{ error() }}</p>
          }

          <button
            appButton
            variant="primary"
            type="submit"
            class="w-full"
            [disabled]="form.invalid || loading()"
          >
            {{ t('login.signIn') }}
          </button>

          <a
            routerLink="/forgot"
            class="text-center text-[13px] text-muted-foreground hover:text-foreground"
          >
            {{ t('login.forgot') }}
          </a>

        </form>

        <!-- Hairline divider with "or" -->
        <div class="flex items-center gap-2">
          <div class="flex-1 border-t border-border"></div>
          <span class="text-[12px] text-muted-foreground">{{ t('login.or') }}</span>
          <div class="flex-1 border-t border-border"></div>
        </div>

        <!-- Demo email input -->
        <div class="flex flex-col gap-2">
          <label for="demo-email" class="text-[14px] font-medium text-foreground">
            {{ t('login.demoEmailLabel') }}
          </label>
          <input
            appInput
            id="demo-email"
            type="email"
            [(ngModel)]="demoEmail"
            [ngModelOptions]="{standalone: true}"
            placeholder="you@example.com"
            autocomplete="email"
          />
          @if (demoEmailError()) {
            <p class="text-[12px] text-state-danger">{{ t('login.demoEmailLabel') }} {{ t('common.fieldRequired') }}</p>
          }
        </div>

        @if (demoError()) {
          <p class="text-[14px] text-state-danger">{{ demoError() }}</p>
        }

        <button
          appButton
          variant="secondary"
          type="button"
          class="w-full"
          [disabled]="demoLoading()"
          (click)="tryDemo()"
        >
          {{ demoLoading() ? t('login.demoLoading') : t('login.tryDemo') }}
        </button>

        <!-- Hairline divider -->
        <div class="flex-1 border-t border-border"></div>

        <!-- Sign up prompt -->
        <p class="text-center text-[13px] text-muted-foreground">
          {{ t('login.signupPrompt') }}
          <a routerLink="/signup" class="text-brand hover:text-brand/80">
            {{ t('login.signupLink') }}
          </a>
        </p>
      </div>
    </app-auth-layout>
  `,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private demo = inject(DemoService);
  private router = inject(Router);
  private toast = inject(AppToastService);

  signupEnabled = signal(true);
  loading = signal(false);
  demoLoading = signal(false);
  submitted = signal(false);
  emailTouched = signal(false);
  passwordTouched = signal(false);
  error = signal<string | null>(null);
  demoEmail = '';
  demoEmailError = signal(false);
  demoError = signal<string | null>(null);

  constructor() {
    if (this.auth.isAuthenticated()) {
      this.router.navigateByUrl(this.auth.isAdmin() ? '/overview' : '/profile');
    }
  }

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  emailError(): string {
    const ctrl = this.form.controls.email;
    if (ctrl.hasError('required')) return 'Email is required.';
    if (ctrl.hasError('email')) return 'Enter a valid email address.';
    return '';
  }

  passwordError(): string {
    const ctrl = this.form.controls.password;
    if (ctrl.hasError('required')) return 'Password is required.';
    return '';
  }

  submit() {
    this.submitted.set(true);
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.router.navigateByUrl(user.isAdmin ? '/overview' : '/profile');
      },
      error: (e: unknown) => {
        this.loading.set(false);
        const msg = extractMessage(e) || 'Sign in failed.';
        this.error.set(msg);
        this.toast.show(msg, 'danger');
      },
    });
  }

  tryDemo() {
    this.demoEmailError.set(false);
    this.demoError.set(null);

    if (!this.demoEmail.trim() || !this.isValidEmail(this.demoEmail)) {
      this.demoEmailError.set(true);
      return;
    }

    this.demoLoading.set(true);
    this.demo.postApiDemo({ email: this.demoEmail.trim() } as DemoRequest).subscribe({
      next: (session) => {
        this.auth.loginWithToken((session as any).token!).subscribe({
          next: (user) => {
            const emailSent = !(session as any).password;
            sessionStorage.setItem(
              DEMO_SESSION_KEY,
              JSON.stringify({
                email: (session as any).email,
                password: (session as any).password,
                projectKey: (session as any).projectKey,
                serverUrl: (session as any).serverUrl,
                expiresAt: (session as any).expiresAt,
                emailSent,
              }),
            );
            this.demoLoading.set(false);
            if (emailSent) {
              this.toast.show('Check your email for demo credentials', 'success');
            }
            this.router.navigateByUrl(user.isAdmin ? '/overview' : '/profile');
          },
          error: (e: unknown) => {
            this.demoLoading.set(false);
            const msg = extractMessage(e) || 'Demo session failed.';
            this.demoError.set(msg);
            this.toast.show(msg, 'danger');
          },
        });
      },
      error: (e: unknown) => {
        this.demoLoading.set(false);
        const msg = extractMessage(e) || 'Demo session failed.';
        this.demoError.set(msg);
        this.toast.show(msg, 'danger');
      },
    });
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }
}
