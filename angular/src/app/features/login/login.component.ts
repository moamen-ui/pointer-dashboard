import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DemoService, DemoSessionResponse } from '@moamen-ui/pointer-angular';
import { AuthService } from '../../core/auth/auth.service';
import { extractMessage } from '../../core/api/extract-message';

const DEMO_SESSION_KEY = 'pointer_demo';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslocoModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-100">
      <mat-card class="flex w-[360px] max-w-[92vw] flex-col gap-2 p-6">
        <h1 class="my-[0.67em] text-[2em] font-bold">{{ 'login.title' | transloco }}</h1>
        <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-2">
          <mat-form-field appearance="outline"><mat-label>{{ 'login.email' | transloco }}</mat-label>
            <input matInput type="email" formControlName="email" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'login.password' | transloco }}</mat-label>
            <input matInput type="password" formControlName="password" /></mat-form-field>
          <button mat-flat-button color="primary" class="mt-2" [disabled]="form.invalid || loading() || demoLoading()">{{ 'login.signIn' | transloco }}</button>
        </form>
        <div class="my-1 flex items-center gap-2 text-[0.8rem] text-muted">
          <span class="h-px flex-1 bg-app-border"></span>{{ 'login.or' | transloco }}<span class="h-px flex-1 bg-app-border"></span>
        </div>
        <button mat-stroked-button type="button" class="border-app-border" [disabled]="loading() || demoLoading()" (click)="tryDemo()">
          {{ demoLoading() ? ('demo.provisioning' | transloco) : ('demo.tryDemo' | transloco) }}
        </button>
        <a mat-button routerLink="/signup" class="mt-1 text-center text-[0.9rem]">
          {{ 'login.signUpLink' | transloco }}
        </a>
      </mat-card>
    </div>`,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private demo = inject(DemoService);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  loading = signal(false);
  demoLoading = signal(false);

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
        this.snack.open(extractMessage(e) || this.transloco.translate('login.failed'), 'OK', { duration: 4000 });
      },
    });
  }

  tryDemo() {
    if (this.demoLoading()) return;
    this.demoLoading.set(true);
    // Interceptor unwraps the response envelope, so the body is DemoSessionResponse.
    this.demo.postApiDemo<DemoSessionResponse>().subscribe({
      next: (session) => {
        // Mirror login()'s post-token steps: store the token the same way, then
        // fetch the current user via /api/auth/me since the demo response has none.
        this.auth.loginWithToken(session.token!).subscribe({
          next: (user) => {
            sessionStorage.setItem(
              DEMO_SESSION_KEY,
              JSON.stringify({
                email: session.email,
                password: session.password,
                projectKey: session.projectKey,
                serverUrl: session.serverUrl,
                expiresAt: session.expiresAt,
              })
            );
            this.demoLoading.set(false);
            this.router.navigateByUrl(user.isAdmin ? '/overview' : '/profile');
          },
          error: (e: unknown) => {
            this.demoLoading.set(false);
            this.snack.open(extractMessage(e) || this.transloco.translate('demo.failed'), 'OK', { duration: 4000 });
          },
        });
      },
      error: (e: unknown) => {
        this.demoLoading.set(false);
        this.snack.open(extractMessage(e) || this.transloco.translate('demo.failed'), 'OK', { duration: 4000 });
      },
    });
  }
}
