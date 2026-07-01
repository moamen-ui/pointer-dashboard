import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  InvitesService,
  getApiInvitesCodeResource,
} from '@moamen-ui/pointer-angular';
import type {
  AcceptInviteRequest,
  InvitePreviewResponse,
  LoginResponse,
} from '@moamen-ui/pointer-angular';
import { AuthService } from '../../core/auth/auth.service';
import { extractMessage } from '../../core/api/extract-message';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const pwd = control.get('password');
  const confirm = control.get('confirmPassword');
  if (!pwd || !confirm) return null;
  return pwd.value === confirm.value ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressBarModule,
    TranslocoModule,
  ],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-100">
      <mat-card class="flex w-[420px] max-w-[92vw] flex-col gap-3 p-6">

        @if (!code()) {
          <p class="text-[0.95rem] text-warn">{{ 'invite.invalidLink' | transloco }}</p>
          <a mat-button routerLink="/login" class="mt-1 text-center text-[0.9rem]">
            {{ 'auth.backToLogin' | transloco }}
          </a>
        } @else if (previewResource.isLoading()) {
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        } @else if (previewResource.error()) {
          <p class="text-[0.95rem] text-warn">{{ 'invite.invalidOrExpired' | transloco }}</p>
          <a mat-button routerLink="/login" class="mt-1 text-center text-[0.9rem]">
            {{ 'auth.backToLogin' | transloco }}
          </a>
        } @else if (preview()) {
          <h1 class="my-[0.67em] text-[1.8em] font-bold">
            {{ 'invite.joinTitle' | transloco: { workspace: preview()!.workspaceName ?? '' } }}
          </h1>
          @if (preview()!.roleName) {
            <p class="m-0 text-[0.95rem] text-muted">
              {{ 'invite.joinRole' | transloco: { role: preview()!.roleName } }}
            </p>
          }

          @if (errorMsg()) {
            <p class="text-[0.9rem] text-red-600">{{ errorMsg() }}</p>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-3">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'invite.email' | transloco }}</mat-label>
              <input matInput type="email" formControlName="email" />
              @if (form.get('email')?.hasError('required')) {
                <mat-error>{{ 'invite.email' | transloco }}</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'invite.displayName' | transloco }}</mat-label>
              <input matInput formControlName="displayName" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'invite.password' | transloco }}</mat-label>
              <input matInput type="password" formControlName="password" />
              @if (form.get('password')?.hasError('minlength')) {
                <mat-error>{{ 'invite.password' | transloco }} (min 8)</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'invite.confirmPassword' | transloco }}</mat-label>
              <input matInput type="password" formControlName="confirmPassword" />
              @if (form.hasError('passwordsMismatch') && form.get('confirmPassword')?.touched) {
                <mat-error>{{ 'invite.passwordMismatch' | transloco }}</mat-error>
              }
            </mat-form-field>

            <button
              mat-flat-button
              color="primary"
              class="mt-1"
              [disabled]="form.invalid || joining()">
              {{ 'invite.join' | transloco }}
            </button>
          </form>
        }

      </mat-card>
    </div>
  `,
})
export class JoinComponent implements OnInit {
  private fb = inject(FormBuilder);
  private invitesService = inject(InvitesService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private transloco = inject(TranslocoService);

  code = signal<string>('');
  joining = signal(false);
  errorMsg = signal<string | null>(null);

  previewResource = getApiInvitesCodeResource(this.code);

  preview = computed(() => this.previewResource.value() as InvitePreviewResponse | undefined);

  form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      displayName: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator },
  );

  ngOnInit(): void {
    const c = this.route.snapshot.queryParamMap.get('code');
    if (c) this.code.set(c);
  }

  submit(): void {
    if (this.form.invalid || !this.code()) return;

    if (this.form.hasError('passwordsMismatch')) {
      this.errorMsg.set(this.transloco.translate('invite.passwordMismatch'));
      return;
    }

    this.joining.set(true);
    this.errorMsg.set(null);

    const { email, password, displayName } = this.form.getRawValue();
    const body: AcceptInviteRequest = {
      code: this.code(),
      email,
      password,
      displayName,
    };

    this.invitesService.postApiAuthRegisterInvite(body).subscribe({
      next: (res: LoginResponse) => {
        this.authService.loginWithToken(res.token!).subscribe({
          next: (user) => {
            this.joining.set(false);
            void this.router.navigateByUrl(user.isAdmin ? '/overview' : '/profile');
          },
          error: (e: unknown) => {
            this.joining.set(false);
            this.errorMsg.set(extractMessage(e));
          },
        });
      },
      error: (e: unknown) => {
        this.joining.set(false);
        this.errorMsg.set(extractMessage(e));
      },
    });
  }
}
