import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService, getApiAuthSignupEnabledResource } from '@moamen-ui/pointer-angular';
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
      <mat-card class="flex w-[400px] max-w-[92vw] flex-col gap-2 p-6">
        <h1 class="my-[0.67em] text-[2em] font-bold">{{ 'signup.title' | transloco }}</h1>

        @if (signupResource.isLoading()) {
          <p class="text-muted">{{ 'signup.loading' | transloco }}</p>
        } @else if (!signupEnabled()) {
          <div class="flex flex-col gap-4">
            <p class="m-0 text-muted">{{ 'signup.closed' | transloco }}</p>
            <a mat-stroked-button routerLink="/login">{{ 'signup.backToLogin' | transloco }}</a>
          </div>
        } @else if (submitted()) {
          <div class="flex flex-col gap-4">
            <p class="m-0 text-green-700 dark:text-green-400">{{ 'signup.pendingApproval' | transloco }}</p>
            <a mat-stroked-button routerLink="/login">{{ 'signup.backToLogin' | transloco }}</a>
          </div>
        } @else {
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
        }
      </mat-card>
    </div>
  `,
})
export class SignupComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);

  signupResource = getApiAuthSignupEnabledResource();
  signupEnabled = computed(() => {
    const val = this.signupResource.value() as unknown;
    if (val && typeof val === 'object' && 'enabled' in (val as Record<string, unknown>)) {
      return !!(val as Record<string, unknown>)['enabled'];
    }
    return false;
  });

  loading = signal(false);
  submitted = signal(false);

  form = this.fb.nonNullable.group({
    displayName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const { email, password, displayName } = this.form.getRawValue();
    this.authService.postApiAuthRegisterAdmin({ email, password, displayName }).subscribe({
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
