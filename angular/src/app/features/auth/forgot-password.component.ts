import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService as ApiAuthService, ForgotPasswordRequest } from '@moamen-ui/pointer-angular';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslocoModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-100">
      <mat-card class="flex w-[360px] max-w-[92vw] flex-col gap-2 p-6">
        <h1 class="my-[0.67em] text-[2em] font-bold">{{ 'auth.forgotTitle' | transloco }}</h1>

        @if (sent()) {
          <p class="text-[0.95rem] text-muted">{{ 'auth.forgotSent' | transloco }}</p>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-2">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'login.email' | transloco }}</mat-label>
              <input matInput type="email" formControlName="email" />
            </mat-form-field>
            <button mat-flat-button color="primary" class="mt-2" [disabled]="form.invalid || loading()">
              {{ 'auth.forgotSubmit' | transloco }}
            </button>
          </form>
        }

        <a mat-button routerLink="/login" class="mt-1 text-center text-[0.9rem]">
          {{ 'auth.backToLogin' | transloco }}
        </a>
      </mat-card>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private apiAuth = inject(ApiAuthService);
  loading = signal(false);
  sent = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

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
