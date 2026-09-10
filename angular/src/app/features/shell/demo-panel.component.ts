import { Component, computed, inject, OnDestroy, signal, viewChild, TemplateRef } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DemoService, UpgradeDemoResponse } from '@moamen-ui/pointer-angular';
import { AuthService } from '../../core/auth/auth.service';
import { InstallGuideService } from '../../shared/install-guide/install-guide.service';
import { extractMessage } from '../../core/api/extract-message';
import { AppFormFieldComponent } from '../../shared/ui/app-form-field.component';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppDialogService } from '../../shared/ui/app-dialog.service';
import { AppToastService } from '../../shared/ui/app-toast.service';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppIconComponent } from '../../shared/ui/app-icon.component';

interface DemoSession {
  email?: string | null;
  password?: string | null;
  projectKey?: string | null;
  serverUrl?: string | null;
  expiresAt?: string;
  emailSent?: boolean;
}

/** One setup step in the guide slider. `code` is optional — instruction-only steps omit it. */
interface SetupStep {
  titleKey: string;
  hintKey: string;
  code?: string;
}

const DEMO_SESSION_KEY = 'pointer_demo';
/** Banner-only hide flag — the session itself outlives a dismissal. */
const DEMO_DISMISSED_KEY = 'pointer_demo_dismissed';

/**
 * Dismissible banner shown in the shell while a demo session (stored in
 * sessionStorage under `pointer_demo`) is active. Surfaces the demo project key,
 * the widget login, a live countdown, and a step-by-step setup guide shown one
 * step at a time (Back / Next slider).
 *
 * Also includes a "Keep this workspace" button that opens an upgrade dialog to
 * convert the demo session into a permanent account.
 */
@Component({
  selector: 'app-demo-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    AppFormFieldComponent,
    AppInputDirective,
    AppButtonDirective,
    AppIconComponent,
  ],
  template: `
    @if (!dismissed() && session(); as s) {
      <div class="bg-gutter border-b border-border px-6 py-3">
        <div class="mx-auto w-full max-w-[1120px]">
          <!-- Header row: banner badge + project key + countdown + keep + dismiss -->
          <div class="mb-3 flex flex-wrap items-center gap-3">
            <span class="text-[13px] font-medium text-muted-foreground">
              {{ 'demo.banner' | transloco }}
            </span>
            <span class="font-mono text-[13px] rounded bg-brand text-brand-foreground px-2 py-0.5">
              {{ s.projectKey }}
            </span>
            @if (s.expiresAt) {
              <span
                class="font-mono text-[13px]"
                [class.text-state-danger]="isExpiringSoon()"
                [class.text-muted-foreground]="!isExpiringSoon()"
              >
                {{ 'demo.expires' | transloco }} {{ countdown() }}
              </span>
            }
            <div class="ms-auto flex items-center gap-2">
              <button appButton variant="secondary" size="sm" type="button" (click)="openUpgrade(s)">
                {{ 'demo.keepWorkspace' | transloco }}
              </button>
              <button appButton variant="ghost" size="sm" class="h-7 w-7 p-0" type="button" [attr.aria-label]="'demo.dismiss' | transloco" (click)="dismiss()">
                <app-icon name="x" class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- Widget login credentials -->
          <div class="text-[13px]">
            <div class="font-medium text-muted-foreground">
              {{ 'demo.widgetLogin' | transloco }}
            </div>
            <div class="mt-1">
              <span class="font-medium text-foreground">{{ s.email }}</span>
              @if (s.password) {
                <ng-container>
                  <span class="text-muted-foreground"> · </span>
                  <code class="font-mono text-[13px] rounded bg-background px-1.5 py-0.5 border border-border">{{ s.password }}</code>
                </ng-container>
              } @else {
                <span class="ms-1 text-muted-foreground italic">{{ 'demo.credsEmailed' | transloco }}</span>
              }
            </div>
          </div>

          <!-- The steps themselves live in the shared install guide (also on the
               header icon), so demo and permanent accounts read the same thing. -->
          <div class="mt-3">
            <button appButton variant="secondary" size="sm" type="button" (click)="installGuide.open()">
              <app-icon name="rocket" class="h-4 w-4" />
              {{ 'install.open' | transloco }}
            </button>
          </div>

          <!-- Server URL reference -->
          @if (s.serverUrl) {
            <div class="mt-2 text-[12px] text-muted-foreground">
              {{ s.serverUrl }}
            </div>
          }
        </div>
      </div>
    }

    <!-- Upgrade dialog template -->
    <ng-template #upgradeDialog>
      <div class="px-5 pt-5 pb-3 border-b border-border">
        <h2 class="m-0 text-[16px] font-semibold text-foreground">
          {{ 'demo.upgradeTitle' | transloco }}
        </h2>
      </div>
      <div class="px-5 py-2 space-y-4">
        <p class="text-[14px] text-muted-foreground">{{ 'demo.upgradeIntro' | transloco }}</p>
        <form [formGroup]="upgradeForm" class="flex flex-col gap-4">
          <app-form-field [label]="'demo.email' | transloco" [error]="emailError()">
            <input appInput type="email" formControlName="email" autocomplete="email" />
          </app-form-field>
          <app-form-field [label]="'demo.password' | transloco" [error]="passwordError()">
            <input appInput type="password" formControlName="password" autocomplete="new-password" />
          </app-form-field>
          <app-form-field
            [label]="'demo.confirmPassword' | transloco"
            [error]="upgradeForm.errors?.['passwordMismatch'] && upgradeForm.get('confirmPassword')?.dirty ? ('demo.passwordMismatch' | transloco) : ''"
          >
            <input appInput type="password" formControlName="confirmPassword" autocomplete="new-password" />
          </app-form-field>
          <app-form-field [label]="'demo.displayName' | transloco">
            <input appInput type="text" formControlName="displayName" autocomplete="name" />
          </app-form-field>
        </form>
      </div>
      <div class="px-5 pb-5 pt-3 flex justify-end gap-2">
        <button appButton variant="secondary" size="default" type="button" (click)="dismissUpgradeDialog()" [disabled]="upgradeBusy()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button appButton variant="primary" size="default" type="button" (click)="submitUpgrade()" [disabled]="upgradeForm.invalid || upgradeBusy()">
          {{ 'demo.upgradeSubmit' | transloco }}
        </button>
      </div>
    </ng-template>
  `,
})
export class DemoPanelComponent implements OnDestroy {
  private transloco = inject(TranslocoService);
  private appDialog = inject(AppDialogService);
  private toast = inject(AppToastService);
  private demoService = inject(DemoService);
  private auth = inject(AuthService);
  installGuide = inject(InstallGuideService);
  private fb = inject(FormBuilder);

  readonly upgradeDialog = viewChild.required<TemplateRef<unknown>>('upgradeDialog');
  private dialogRef?: any;

  private now = signal(Date.now());
  private timer = setInterval(() => this.now.set(Date.now()), 1000);
  session = signal<DemoSession | null>(this.read());
  dismissed = signal(this.readDismissed());
  upgradeBusy = signal(false);
  countdown = signal('');

  private refreshCountdown = (): void => {
    if (!this.session()?.expiresAt) return;
    const ms = new Date(this.session()!.expiresAt!).getTime() - Date.now();
    this.countdown.set(this.formatCountdown(ms));
    if (ms <= 0) {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
      this.session.set(null);
    }
  };

  isExpiringSoon = computed(() => {
    const s = this.session();
    if (!s?.expiresAt) return false;
    return new Date(s.expiresAt).getTime() - Date.now() < 5 * 60 * 1000;
  });

  upgradeForm = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
      displayName: [''],
    },
    {
      validators: (g) => {
        const pw = g.get('password')?.value;
        const cpw = g.get('confirmPassword')?.value;
        return pw && cpw && pw !== cpw ? { passwordMismatch: true } : null;
      },
    }
  );

  private formatCountdown(ms: number): string {
    if (ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  constructor() {
    // Set up countdown interval
    const countdownInterval = setInterval(() => {
      this.refreshCountdown();
    }, 1000);

    // Initial countdown
    this.refreshCountdown();

    // Clean up interval on destroy
    const origDestroy = this.ngOnDestroy.bind(this);
    this.ngOnDestroy = () => {
      clearInterval(countdownInterval);
      origDestroy();
    };
  }

  emailError(): string {
    const ctrl = this.upgradeForm.controls.email;
    if (ctrl.hasError('required')) return this.transloco.translate('common.fieldRequired');
    if (ctrl.hasError('email')) return this.transloco.translate('common.invalidEmail');
    return '';
  }

  passwordError(): string {
    const ctrl = this.upgradeForm.controls.password;
    if (ctrl.hasError('required')) return this.transloco.translate('common.fieldRequired');
    if (ctrl.hasError('minlength')) return this.transloco.translate('common.passwordMinLength', { min: 8 });
    return '';
  }

  private readDismissed(): boolean {
    try {
      return sessionStorage.getItem(DEMO_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  private read(): DemoSession | null {
    try {
      return JSON.parse(sessionStorage.getItem(DEMO_SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }

  /**
   * Hides the banner but keeps the session: it holds the demo project key and the
   * widget login, which the install guide still needs. Deleting it here used to
   * throw those credentials away with no way to get them back.
   */
  dismiss(): void {
    try {
      sessionStorage.setItem(DEMO_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
    this.dismissed.set(true);
  }

  openUpgrade(session: DemoSession): void {
    this.upgradeForm.reset({
      email: session.email ?? '',
      password: '',
      confirmPassword: '',
      displayName: '',
    });
    this.dialogRef = this.appDialog.openRef(this.upgradeDialog(), {});
  }

  dismissUpgradeDialog(): void {
    this.dialogRef?.close();
  }

  submitUpgrade(): void {
    if (this.upgradeForm.invalid) return;
    const val = this.upgradeForm.getRawValue();
    this.upgradeBusy.set(true);
    this.demoService.postApiDemoUpgrade<UpgradeDemoResponse>({
      email: val.email,
      password: val.password,
      displayName: val.displayName || undefined,
    }).subscribe({
      next: (res) => {
        // Swap the token exactly like the demo-login flow does.
        this.auth.loginWithToken(res.token!).subscribe({
          next: () => {
            this.upgradeBusy.set(false);
            this.dialogRef?.close();
            sessionStorage.removeItem(DEMO_SESSION_KEY);
            this.session.set(null);
            this.toast.show(this.transloco.translate('demo.upgradeSuccess'), 'success');
          },
          error: (e: unknown) => {
            this.upgradeBusy.set(false);
            this.toast.show(extractMessage(e), 'danger');
          },
        });
      },
      error: (e: unknown) => {
        this.upgradeBusy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
