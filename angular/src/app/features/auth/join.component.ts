import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
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
import { AppAuthLayoutComponent } from '../../shared/ui/app-auth-layout.component';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';

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
    TranslocoModule,
    AppAuthLayoutComponent,
    AppInputDirective,
    AppButtonDirective,
  ],
  template: `
    <app-auth-layout>
      <div *transloco="let t">
        @if (!code()) {
          <p class="text-[14px] text-state-danger">{{ t('invite.invalidLink') }}</p>
          <a routerLink="/login" appButton variant="primary" class="w-full">
            {{ t('auth.backToLogin') }}
          </a>
        } @else if (previewResource.isLoading()) {
          <div class="space-y-2">
            <div class="h-4 bg-gutter rounded-md w-3/4"></div>
            <div class="h-3 bg-gutter rounded-md w-1/2"></div>
          </div>
        } @else if (previewResource.error()) {
          <p class="text-[14px] text-state-danger">{{ t('invite.invalidOrExpired') }}</p>
          <a routerLink="/login" appButton variant="primary" class="w-full">
            {{ t('auth.backToLogin') }}
          </a>
        } @else if (preview()) {
          <div class="mb-4">
            <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
              @if (preview()!.isNewWorkspace) {
                {{ t('invite.createWorkspaceTitle') }}
              } @else {
                {{ t('invite.joinTitle', { workspace: preview()!.workspaceName ?? '' }) }}
              }
            </h1>
            @if (preview()!.roleName) {
              <p class="text-[14px] text-muted-foreground mt-2">
                {{ t('invite.joinRole', { role: preview()!.roleName }) }}
              </p>
            }
          </div>

          @if (errorMsg()) {
            <p class="text-[14px] text-state-danger mb-4">{{ errorMsg() }}</p>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4" novalidate>
            <div class="flex flex-col gap-2">
              <label for="email" class="text-[14px] font-medium text-foreground">
                {{ t('invite.email') }}
              </label>
              <input
                appInput
                id="email"
                type="email"
                formControlName="email"
                (blur)="emailTouched.set(true)"
                autocomplete="email"
              />
              @if (emailTouched() && emailError()) {
                <p class="text-[12px] text-state-danger">{{ emailError() }}</p>
              }
            </div>

            <div class="flex flex-col gap-2">
              <label for="name" class="text-[14px] font-medium text-foreground">
                {{ t('invite.displayName') }}
              </label>
              <input
                appInput
                id="name"
                formControlName="displayName"
                (blur)="nameTouched.set(true)"
              />
              @if (nameTouched() && form.controls.displayName.hasError('required')) {
                <p class="text-[12px] text-state-danger">{{ t('common.fieldRequired') }}</p>
              }
            </div>

            <div class="flex flex-col gap-2">
              <label for="password" class="text-[14px] font-medium text-foreground">
                {{ t('invite.password') }}
              </label>
              <input
                appInput
                id="password"
                type="password"
                formControlName="password"
                (blur)="passwordTouched.set(true)"
                autocomplete="new-password"
              />
              @if (passwordTouched() && passwordError()) {
                <p class="text-[12px] text-state-danger">{{ passwordError() }}</p>
              }
            </div>

            <div class="flex flex-col gap-2">
              <label for="confirm" class="text-[14px] font-medium text-foreground">
                {{ t('invite.confirmPassword') }}
              </label>
              <input
                appInput
                id="confirm"
                type="password"
                formControlName="confirmPassword"
                (blur)="confirmTouched.set(true)"
                autocomplete="new-password"
              />
              @if (confirmTouched() && form.hasError('passwordsMismatch')) {
                <p class="text-[12px] text-state-danger">{{ t('invite.passwordMismatch') }}</p>
              }
            </div>

            <button
              appButton
              variant="primary"
              type="submit"
              class="w-full mt-2"
              [disabled]="form.invalid || joining()"
            >
              {{ preview()!.isNewWorkspace ? t('invite.createWorkspace') : t('invite.join') }}
            </button>
          </form>
        }
      </div>
    </app-auth-layout>
  `,
})
export class JoinComponent implements OnInit {
  private fb = inject(FormBuilder);
  private invitesService = inject(InvitesService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  code = signal<string>('');
  joining = signal(false);
  errorMsg = signal<string | null>(null);
  emailTouched = signal(false);
  nameTouched = signal(false);
  passwordTouched = signal(false);
  confirmTouched = signal(false);

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

  emailError(): string {
    const ctrl = this.form.controls.email;
    if (ctrl.hasError('required')) return 'Email is required.';
    if (ctrl.hasError('email')) return 'Enter a valid email address.';
    return '';
  }

  passwordError(): string {
    const ctrl = this.form.controls.password;
    if (ctrl.hasError('required')) return 'Password is required.';
    if (ctrl.hasError('minlength')) return 'Password must be at least 8 characters.';
    return '';
  }

  submit(): void {
    if (this.form.invalid || !this.code()) return;

    if (this.form.hasError('passwordsMismatch')) {
      this.errorMsg.set('Passwords do not match.');
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
