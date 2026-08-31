import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MeService } from '@moamen-ui/pointer-angular';
import { AuthService } from '../core/auth/auth.service';
import { extractMessage } from '../core/api/extract-message';
import { PasswordToggleComponent } from './password-toggle.component';
import { FormFieldComponent } from './form-field/form-field.component';

/**
 * Self-service change-password, opened from the profile menu. Success rotates the server-side
 * SecurityStamp (invalidates every session, including this one — same as password reset), so we
 * clear the local session and send the user back to /login rather than pretending to stay signed in.
 */
@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoModule,
    PasswordToggleComponent,
    FormFieldComponent,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'changePassword.title' | transloco }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" (ngSubmit)="submit()" class="flex min-w-80 flex-col gap-3 pt-2">
        <app-form-field
          [control]="form.controls.currentPassword"
          [label]="'changePassword.current' | transloco"
          [type]="currentToggle.type()"
          [errorMessage]="'common.fieldRequired' | transloco"
        >
          <app-password-toggle matSuffix #currentToggle />
        </app-form-field>
        <app-form-field
          [control]="form.controls.newPassword"
          [label]="'changePassword.new' | transloco"
          [type]="newToggle.type()"
          [errorMessage]="newPasswordError()"
        >
          <app-password-toggle matSuffix #newToggle />
        </app-form-field>
        <app-form-field
          [control]="form.controls.confirmPassword"
          [label]="'changePassword.confirm' | transloco"
          [type]="confirmToggle.type()"
          [errorMessage]="'common.fieldRequired' | transloco"
        >
          <app-password-toggle matSuffix #confirmToggle />
        </app-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="busy()">{{ 'common.cancel' | transloco }}</button>
      <button mat-flat-button color="primary" (click)="submit()" [disabled]="form.invalid || busy()">
        {{ 'changePassword.submit' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ChangePasswordDialogComponent {
  private fb = inject(FormBuilder);
  private meService = inject(MeService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private dialogRef = inject(MatDialogRef<ChangePasswordDialogComponent>);

  busy = signal(false);

  form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });

  newPasswordError(): string {
    const ctrl = this.form.controls.newPassword;
    if (ctrl.hasError('required')) return this.transloco.translate('common.fieldRequired');
    if (ctrl.hasError('minlength')) return this.transloco.translate('common.passwordMinLength', { min: 8 });
    return '';
  }

  submit(): void {
    if (this.form.invalid) return;
    const { currentPassword, newPassword, confirmPassword } = this.form.getRawValue();
    if (newPassword !== confirmPassword) {
      this.snack.open(this.transloco.translate('changePassword.mismatch'), 'OK', { duration: 4000 });
      return;
    }
    this.busy.set(true);
    this.meService.postApiMeChangePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.busy.set(false);
        this.dialogRef.close();
        this.snack.open(this.transloco.translate('changePassword.success'), 'OK', { duration: 4000 });
        // The security-stamp rotation invalidated this session's token server-side too — clear it
        // locally and send the user to sign back in with the new password.
        this.auth.clearSession();
        this.router.navigateByUrl('/login');
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
      },
    });
  }
}
