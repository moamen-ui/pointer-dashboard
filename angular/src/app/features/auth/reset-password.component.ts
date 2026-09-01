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
import { FormFieldComponent } from '../../shared/form-field/form-field.component';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPwd = control.get('newPassword');
  const confirm = control.get('confirmPassword');
  if (!newPwd || !confirm) return null;
  return newPwd.value === confirm.value ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslocoModule, FormFieldComponent],
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
            <app-form-field
              [control]="form.controls.newPassword"
              [label]="'auth.newPassword' | transloco"
              type="password"
              [errorMessage]="newPasswordError()"
            />
            <app-form-field
              [control]="form.controls.confirmPassword"
              [label]="'auth.confirmPassword' | transloco"
              type="password"
            />
            <!-- Cross-field validator lives on the FormGroup, not confirmPassword itself, so it
                 can't go through app-form-field's per-control error slot. -->
            @if (form.hasError('passwordsMismatch') && form.get('confirmPassword')?.touched) {
              <p class="m-0 -mt-1 text-[0.8rem] text-danger">{{ 'auth.confirmPassword' | transloco }}</p>
            }
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

  newPasswordError(): string {
    const ctrl = this.form.controls.newPassword;
    if (ctrl.hasError('required')) return this.transloco.translate('common.fieldRequired');
    if (ctrl.hasError('minlength')) return this.transloco.translate('common.passwordMinLength', { min: 8 });
    return '';
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
