import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService as ApiAuthService, ResetPasswordRequest } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPwd = control.get('newPassword');
  const confirm = control.get('confirmPassword');
  if (!newPwd || !confirm) return null;
  return newPwd.value === confirm.value ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslocoModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-100">
      <mat-card class="flex w-[360px] max-w-[92vw] flex-col gap-2 p-6">
        <h1 class="my-[0.67em] text-[2em] font-bold">{{ 'auth.resetTitle' | transloco }}</h1>

        @if (!token()) {
          <p class="text-[0.95rem] text-warn">{{ 'auth.resetInvalid' | transloco }}</p>
          <a mat-button routerLink="/login" class="mt-1 text-center text-[0.9rem]">
            {{ 'auth.backToLogin' | transloco }}
          </a>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-2">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.newPassword' | transloco }}</mat-label>
              <input matInput type="password" formControlName="newPassword" />
              @if (form.get('newPassword')?.hasError('minlength')) {
                <mat-error>{{ 'auth.newPassword' | transloco }} (min 8)</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.confirmPassword' | transloco }}</mat-label>
              <input matInput type="password" formControlName="confirmPassword" />
              @if (form.hasError('passwordsMismatch') && form.get('confirmPassword')?.touched) {
                <mat-error>{{ 'auth.confirmPassword' | transloco }}</mat-error>
              }
            </mat-form-field>
            <button mat-flat-button color="primary" class="mt-2" [disabled]="form.invalid || loading()">
              {{ 'auth.resetSubmit' | transloco }}
            </button>
          </form>
          <a mat-button routerLink="/login" class="mt-1 text-center text-[0.9rem]">
            {{ 'auth.backToLogin' | transloco }}
          </a>
        }
      </mat-card>
    </div>
  `,
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private apiAuth = inject(ApiAuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);

  loading = signal(false);
  token = signal<string | null>(null);

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

  submit() {
    if (this.form.invalid || !this.token()) return;
    this.loading.set(true);
    const { newPassword } = this.form.getRawValue();
    this.apiAuth.postApiAuthResetPassword({ token: this.token()!, newPassword } as ResetPasswordRequest).subscribe({
      next: () => {
        this.loading.set(false);
        this.snack.open(this.transloco.translate('auth.resetDone'), 'OK', { duration: 5000 });
        void this.router.navigateByUrl('/login');
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.snack.open(extractMessage(e) || this.transloco.translate('auth.resetInvalid'), 'OK', { duration: 5000 });
      },
    });
  }
}
