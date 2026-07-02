import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService, getApiAuthSignupEnabledResource, getApiPlansResource } from '@moamen-ui/pointer-angular';
import type { PlanPublicResponse } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    TranslocoModule,
  ],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-100">
      <div class="flex w-full max-w-[880px] flex-col items-center gap-6 px-4 py-8">

        @if (signupResource.isLoading()) {
          <p class="text-muted">{{ 'signup.loading' | transloco }}</p>
        } @else if (!signupEnabled()) {
          <mat-card class="flex w-[400px] max-w-[92vw] flex-col gap-2 p-6">
            <h1 class="my-[0.67em] text-[2em] font-bold">{{ 'signup.title' | transloco }}</h1>
            <div class="flex flex-col gap-4">
              <p class="m-0 text-muted">{{ 'signup.closed' | transloco }}</p>
              <a mat-stroked-button routerLink="/login">{{ 'signup.backToLogin' | transloco }}</a>
            </div>
          </mat-card>
        } @else if (submitted()) {
          <mat-card class="flex w-[400px] max-w-[92vw] flex-col gap-2 p-6">
            <h1 class="my-[0.67em] text-[2em] font-bold">{{ 'signup.title' | transloco }}</h1>
            <div class="flex flex-col gap-4">
              <p class="m-0 text-green-700 dark:text-green-400">{{ 'signup.pendingApproval' | transloco }}</p>
              <a mat-stroked-button routerLink="/login">{{ 'signup.backToLogin' | transloco }}</a>
            </div>
          </mat-card>
        } @else {

          <!-- Optional plan selector (public plans). Marketing display only — see submit(). -->
          @if (selectablePlans().length > 0) {
            <div class="w-full">
              <h2 class="mb-4 text-center text-[1.2em] font-semibold">{{ 'signup.plan.selectTitle' | transloco }}</h2>
              <div class="flex flex-wrap justify-center gap-4">
                @for (plan of selectablePlans(); track plan.slug) {
                  <div
                    class="flex w-[200px] flex-col rounded-xl border-2 p-4 transition-colors"
                    [class.border-brand]="selectedPlanSlug() === plan.slug"
                    [class.border-app-border]="selectedPlanSlug() !== plan.slug"
                    [class.opacity-50]="plan.displayState === 1"
                    [class.cursor-not-allowed]="plan.displayState === 1"
                    [class.cursor-pointer]="plan.displayState !== 1"
                    (click)="selectPlan(plan)">
                    <p class="m-0 font-semibold">{{ plan.name }}</p>
                    <p class="m-0 mt-1 text-sm text-muted">
                      @if (!plan.priceMonthly) {
                        {{ 'signup.plan.free' | transloco }}
                      } @else if (plan.interval === 1) {
                        {{ 'signup.plan.yearlyPrice' | transloco: { price: plan.priceMonthly, currency: plan.currency ?? 'USD' } }}
                      } @else {
                        {{ 'signup.plan.monthlyPrice' | transloco: { price: plan.priceMonthly, currency: plan.currency ?? 'USD' } }}
                      }
                    </p>
                    @if (plan.displayState === 1) {
                      <span class="mt-2 text-xs font-medium text-amber-600">{{ 'signup.plan.comingSoon' | transloco }}</span>
                    }
                    @if (plan.featureBullets && plan.featureBullets.length > 0) {
                      <ul class="m-0 mt-3 list-none p-0 text-xs text-muted">
                        @for (b of plan.featureBullets; track b) {
                          <li class="mb-1">• {{ b }}</li>
                        }
                      </ul>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <!-- Signup form -->
          <mat-card class="flex w-[400px] max-w-[92vw] flex-col gap-2 p-6">
            <h1 class="my-[0.67em] text-[2em] font-bold">{{ 'signup.title' | transloco }}</h1>
            <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-2">
              <mat-form-field appearance="outline">
                <mat-label>{{ 'signup.displayName' | transloco }}</mat-label>
                <input matInput formControlName="displayName" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'signup.email' | transloco }}</mat-label>
                <input matInput type="email" formControlName="email" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'signup.password' | transloco }}</mat-label>
                <input matInput type="password" formControlName="password" />
              </mat-form-field>
              <button mat-flat-button color="primary" class="mt-2"
                [disabled]="form.invalid || loading()">
                {{ loading() ? ('signup.submitting' | transloco) : ('signup.submit' | transloco) }}
              </button>
            </form>
            <a mat-button routerLink="/login" class="mt-2 text-center">
              {{ 'signup.backToLogin' | transloco }}
            </a>
          </mat-card>
        }
      </div>
    </div>
  `,
})
export class SignupComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private route = inject(ActivatedRoute);

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

  form = this.fb.nonNullable.group({
    displayName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
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
    if (this.form.invalid) return;
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
        this.snack.open(extractMessage(e) || this.transloco.translate('signup.failed'), 'OK', { duration: 4000 });
      },
    });
  }
}
