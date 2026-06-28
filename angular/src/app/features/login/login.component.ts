import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { extractMessage } from '../../core/api/extract-message';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslocoModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-100">
      <mat-card class="flex w-[360px] max-w-[92vw] flex-col gap-2 p-6">
        <h1 class="my-[0.67em] text-[2em] font-bold">{{ 'login.title' | transloco }}</h1>
        <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-2">
          <mat-form-field appearance="outline"><mat-label>{{ 'login.email' | transloco }}</mat-label>
            <input matInput type="email" formControlName="email" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'login.password' | transloco }}</mat-label>
            <input matInput type="password" formControlName="password" /></mat-form-field>
          <button mat-flat-button color="primary" class="mt-2" [disabled]="form.invalid || loading()">{{ 'login.signIn' | transloco }}</button>
        </form>
      </mat-card>
    </div>`,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  loading = signal(false);

  constructor() {
    if (this.auth.isAuthenticated()) {
      this.router.navigateByUrl(this.auth.isAdmin() ? '/overview' : '/profile');
    }
  }
  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.router.navigateByUrl(user.isAdmin ? '/overview' : '/profile');
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.snack.open(extractMessage(e) || 'Login failed', 'OK', { duration: 4000 });
      },
    });
  }
}
