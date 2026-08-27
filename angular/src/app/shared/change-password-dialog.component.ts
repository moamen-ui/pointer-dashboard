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
  ],
  template: `
    <h2 mat-dialog-title>{{ 'changePassword.title' | transloco }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" (ngSubmit)="submit()" class="flex min-w-80 flex-col gap-3 pt-2">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'changePassword.current' | transloco }}</mat-label>
          <input matInput [type]="currentToggle.type()" formControlName="currentPassword" />
          <app-password-toggle matSuffix #currentToggle />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'changePassword.new' | transloco }}</mat-label>
          <input matInput [type]="newToggle.type()" formControlName="newPassword" />
          <app-password-toggle matSuffix #newToggle />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'changePassword.confirm' | transloco }}</mat-label>
          <input matInput [type]="confirmToggle.type()" formControlName="confirmPassword" />
          <app-password-toggle matSuffix #confirmToggle />
        </mat-form-field>
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
