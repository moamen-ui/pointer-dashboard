import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService, getApiAuthSignupEnabledResource, getApiPlansResource } from '@moamen-ui/pointer-angular';
import type { PlanPublicResponse } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { AppAuthLayoutComponent } from '../../shared/ui/app-auth-layout.component';
import { AppFormFieldComponent } from '../../shared/ui/app-form-field.component';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { PasswordToggleComponent } from '../../shared/password-toggle.component';
import { AppToastService } from '../../shared/ui/app-toast.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoModule,
    AppAuthLayoutComponent,
    AppFormFieldComponent,
    AppInputDirective,
    AppButtonDirective,
    PasswordToggleComponent,
  ],
  template: `
    <app-auth-layout>
      <div *transloco="let t" class="flex flex-col gap-5">
        @if (signupResource.isLoading()) {
          <p class="text-sm text-muted-foreground">{{ t('signup.checking') }}</p>
        } @else if (!signupEnabled()) {
          <h1 class="text-center text-xl font-bold">{{ t('signup.title') }}</h1>
          <p class="text-center text-sm text-muted-foreground">{{ t('signup.closed') }}</p>
          <a routerLink="/login" class="text-center text-sm text-brand hover:underline">{{ t('signup.backToLogin') }}</a>
        } @else if (submitted()) {
          <h1 class="text-center text-xl font-bold">{{ t('signup.title') }}</h1>
          <p class="text-center text-sm text-muted-foreground">{{ t('signup.pending') }}</p>
          <a routerLink="/login" class="text-center text-sm text-brand hover:underline">{{ t('signup.backToLogin') }}</a>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" noValidate class="flex flex-col gap-4">
            <h1 class="text-center text-xl font-bold">{{ t('signup.title') }}</h1>

            <app-form-field [label]="t('signup.displayName')" [error]="displayNameTouched() || submitted() ? displayNameErrorMsg() : ''">
              <input
                appInput
                formControlName="displayName"
                (blur)="displayNameTouched.set(true)"
                autoFocus
              />
            </app-form-field>

            <app-form-field [label]="t('signup.email')" [error]="emailTouched() || submitted() ? emailErrorMsg() : ''">
              <input
                appInput
                type="email"
                autoComplete="email"
                formControlName="email"
                (blur)="emailTouched.set(true)"
              />
            </app-form-field>

            <app-form-field [label]="t('signup.password')" [error]="passwordTouched() || submitted() ? passwordErrorMsg() : ''">
              <div class="relative">
                <input
                  appInput
                  [type]="pwToggle.type()"
                  class="pe-9"
                  autoComplete="new-password"
                  formControlName="password"
                  (blur)="passwordTouched.set(true)"
                />
                <app-password-toggle #pwToggle class="absolute end-1 top-1/2 -translate-y-1/2"></app-password-toggle>
              </div>
            </app-form-field>

            <!-- Plan selector — shown when public plans are available -->
            @if (selectablePlans().length > 0) {
              <div class="flex flex-col gap-2">
                <label class="text-[13px] font-medium text-foreground">{{ t('signup.plan.chooseLabel') }}</label>
                <div class="flex flex-col gap-2">
                  @for (plan of selectablePlans(); track plan.slug) {
                    <button
                      type="button"
                      [disabled]="plan.displayState === 1"
                      (click)="selectPlan(plan)"
                      class="flex w-full flex-col gap-1 rounded-lg border px-3 py-3 text-start transition-colors"
                      [class.border-brand]="selectedPlanSlug() === plan.slug"
                      [class.bg-brand-tint]="selectedPlanSlug() === plan.slug"
                      [class.text-brand]="selectedPlanSlug() === plan.slug"
                      [class.border-border]="selectedPlanSlug() !== plan.slug"
                      [class.bg-card]="selectedPlanSlug() !== plan.slug"
                      [class.text-card-foreground]="selectedPlanSlug() !== plan.slug"
                      [class.hover:border-brand/50]="selectedPlanSlug() !== plan.slug"
                      [class.cursor-not-allowed]="plan.displayState === 1"
                      [class.opacity-50]="plan.displayState === 1"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-semibold text-sm">{{ plan.name }}</span>
                        <span class="text-xs font-medium">
                          @if (!plan.priceMonthly) {
                            {{ t('signup.plan.free') }}
                          } @else if (plan.interval === 1) {
                            {{ t('signup.plan.yearlyPrice', { price: plan.priceMonthly, currency: plan.currency ?? 'USD' }) }}
                          } @else {
                            {{ t('signup.plan.monthlyPrice', { price: plan.priceMonthly, currency: plan.currency ?? 'USD' }) }}
                          }
                        </span>
                      </div>
                      @if (plan.displayState === 1) {
                        <span class="text-[10px] font-medium text-state-ready">{{ t('signup.plan.comingSoon') }}</span>
                      }
                      @if (plan.featureBullets && plan.featureBullets.length > 0) {
                        <ul class="mt-1 flex flex-col gap-0.5">
                          @for (b of plan.featureBullets.slice(0, 3); track b) {
                            <li class="text-xs text-muted-foreground">· {{ b }}</li>
                          }
                        </ul>
                      }
                    </button>
                  }
                </div>
                <p class="text-xs text-muted-foreground">{{ t('signup.plan.hint') }}</p>
              </div>
            }

            @if (error()) {
              <p class="text-sm text-state-danger">{{ error() }}</p>
            }

            <button
              type="submit"
              appButton
              variant="primary"
              class="mt-1"
              [disabled]="form.invalid || loading()"
            >
              {{ loading() ? t('signup.submitting') : t('signup.submit') }}
            </button>

            <a routerLink="/login" class="text-center text-sm text-muted-foreground hover:underline">
              {{ t('signup.backToLogin') }}
            </a>
          </form>
        }
      </div>
    </app-auth-layout>
  `,
})
export class SignupComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private toast = inject(AppToastService);
  private transloco = inject(TranslocoService);
  private route = inject(ActivatedRoute);

  private readonly MIN_PASSWORD_LENGTH = 6;

  signupResource = getApiAuthSignupEnabledResource();
  signupEnabled = computed(() => this.signupResource.value()?.enabled === true);

  // Public plans (anonymous GET /api/plans). Interceptor unwraps the envelope → PlanPublicResponse[].
  plansResource = getApiPlansResource();
  private publicPlans = computed(() => (this.plansResource.value() as unknown as PlanPublicResponse[]) ?? []);

  // Selector shows Visible (displayState 0) + ComingSoon (1), ordered by sortOrder.
  // Hidden (2) is already excluded by the public API. ComingSoon is shown greyed & disabled.
  selectablePlans = computed(() =>
    [...this.publicPlans()]
      .filter((p) => p.displayState !== 2)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  );

  selectedPlanSlug = signal<string | null>(null);

  loading = signal(false);
  submitted = signal(false);

  displayNameTouched = signal(false);
  emailTouched = signal(false);
  passwordTouched = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    displayName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(this.MIN_PASSWORD_LENGTH)]],
  });

  displayNameErrorMsg = computed(() => {
    const ctrl = this.form.controls.displayName;
    if (ctrl.hasError('required')) return this.transloco.translate('common.fieldRequired');
    return '';
  });

  emailErrorMsg = computed(() => {
    const ctrl = this.form.controls.email;
    if (ctrl.hasError('required')) return this.transloco.translate('common.fieldRequired');
    if (ctrl.hasError('email')) return this.transloco.translate('common.invalidEmail');
    return '';
  });

  passwordErrorMsg = computed(() => {
    const ctrl = this.form.controls.password;
    if (ctrl.hasError('required')) return this.transloco.translate('common.fieldRequired');
    if (ctrl.hasError('minlength')) return this.transloco.translate('common.passwordMinLength', { min: this.MIN_PASSWORD_LENGTH });
    return '';
  });

  constructor() {
    // Honor ?plan=<slug>: preselect it once plans load, but only if it's Visible (displayState 0).
    effect(() => {
      const requested = this.route.snapshot.queryParamMap.get('plan');
      if (!requested || this.selectedPlanSlug() !== null) return;
      const match = this.publicPlans().find((p) => p.slug === requested && p.displayState === 0);
      if (match) this.selectedPlanSlug.set(match.slug ?? null);
    });
  }

  selectPlan(plan: PlanPublicResponse): void {
    if (plan.displayState === 1) return; // ComingSoon plans are not selectable.
    this.selectedPlanSlug.set(this.selectedPlanSlug() === plan.slug ? null : (plan.slug ?? null));
  }

  submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) return;
    this.error.set(null);
    this.loading.set(true);

    const { email, password, displayName } = this.form.getRawValue();

    // INTENTIONAL: planId is always null for now.
    // The public /api/plans endpoint exposes only `slug`, not `id`; the admin plans list
    // (which has ids) requires super-admin auth that anonymous signup callers don't have.
    // register-admin takes planId (int) but we can't resolve it from a slug here, and no
    // paid plan is purchasable until payment integration exists — the backend defaults new
    // workspaces to Free regardless. So the plan selector is display-only marketing and we
    // send planId: null. Replace this with the resolved id once payment integration + an
    // id-bearing public plans endpoint are in place.
    const planId: number | null = null;

    this.authService.postApiAuthRegisterAdmin({ email, password, displayName, planId }).subscribe({
      next: () => {
        this.loading.set(false);
        this.submitted.set(true);
      },
      error: (e: unknown) => {
        this.loading.set(false);
        const msg = extractMessage(e) || this.transloco.translate('signup.failed');
        this.error.set(msg);
        this.toast.show(msg, 'danger');
      },
    });
  }
}
