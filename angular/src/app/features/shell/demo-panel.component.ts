import { Component, computed, inject, OnDestroy, signal, viewChild, TemplateRef } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { DemoService, UpgradeDemoResponse } from '@moamen-ui/pointer-angular';
import { AuthService } from '../../core/auth/auth.service';
import { InstallGuideService } from '../../shared/install-guide/install-guide.service';
import { extractMessage } from '../../core/api/extract-message';
import { FormFieldComponent } from '../../shared/form-field/form-field.component';

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
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoModule,
    FormFieldComponent,
  ],
  template: `
    @if (!dismissed() && session(); as s) {
      <div class="mb-4 rounded-xl border border-brand/40 bg-brand-tint p-4 text-ink">
        <div class="flex items-start gap-2">
          <mat-icon class="text-brand">science</mat-icon>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="text-[1rem] font-bold">{{ 'demo.panelTitle' | transloco }}</span>
              <span class="ms-auto text-[0.85rem] text-muted">{{ countdownLabel() }}</span>
            </div>
            <p class="mt-1 mb-3 text-[0.85rem] text-muted">{{ 'demo.panelIntro' | transloco }}</p>

            <div class="grid gap-3 md:grid-cols-2">
              <div>
                <div class="text-[0.75rem] font-semibold uppercase text-muted">{{ 'demo.projectKey' | transloco }}</div>
                <code class="mt-1 inline-block rounded bg-app px-2 py-1 text-[0.85rem]">{{ s.projectKey }}</code>
              </div>
              <div>
                <div class="text-[0.75rem] font-semibold uppercase text-muted">{{ 'demo.widgetLogin' | transloco }}</div>
                <div class="mt-1 text-[0.85rem]">
                  <span class="font-medium">{{ s.email }}</span>
                  <span class="text-muted"> · </span>
                  <code class="rounded bg-app px-1.5 py-0.5">{{ s.password }}</code>
                </div>
              </div>
            </div>

            <!-- The steps themselves live in the shared install guide (also on the
                 header icon), so demo and permanent accounts read the same thing. -->
            <div class="mt-4">
              <button mat-stroked-button class="border-app-border" type="button" (click)="installGuide.open()">
                <mat-icon>rocket_launch</mat-icon> {{ 'install.open' | transloco }}
              </button>
            </div>

            <!-- Keep this workspace button -->
            <div class="mt-3">
              <button mat-flat-button color="primary" type="button" (click)="openUpgrade(s)">
                <mat-icon>lock_open</mat-icon> {{ 'demo.keepWorkspace' | transloco }}
              </button>
            </div>
          </div>
          <button mat-icon-button type="button" [attr.aria-label]="'demo.dismiss' | transloco" (click)="dismiss()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
    }

    <!-- Upgrade dialog template -->
    <ng-template #upgradeDialog>
      <h2 mat-dialog-title>{{ 'demo.upgradeTitle' | transloco }}</h2>
      <mat-dialog-content>
        <p class="mb-4 mt-1 text-[0.9rem] text-muted">{{ 'demo.upgradeIntro' | transloco }}</p>
        <form [formGroup]="upgradeForm" class="flex min-w-80 flex-col gap-3">
          <app-form-field
            [control]="upgradeForm.controls.email"
            [label]="'demo.email' | transloco"
            type="email"
            [errorMessage]="emailError()"
          />
          <app-form-field
            [control]="upgradeForm.controls.password"
            [label]="'demo.password' | transloco"
            type="password"
            [errorMessage]="passwordError()"
          />
          <app-form-field
            [control]="upgradeForm.controls.confirmPassword"
            [label]="'demo.confirmPassword' | transloco"
            type="password"
          />
          <!-- Cross-field validator lives on the FormGroup, not confirmPassword itself. -->
          @if (upgradeForm.errors?.['passwordMismatch'] && upgradeForm.get('confirmPassword')?.dirty) {
            <p class="m-0 -mt-2 text-[0.85rem] text-danger">{{ 'demo.passwordMismatch' | transloco }}</p>
          }
          <app-form-field
            [control]="upgradeForm.controls.displayName"
            [label]="'demo.displayName' | transloco"
          />
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close [disabled]="upgradeBusy()">{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary" (click)="submitUpgrade()" [disabled]="upgradeForm.invalid || upgradeBusy()">
          {{ 'demo.upgradeSubmit' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>
  `,
})
export class DemoPanelComponent implements OnDestroy {
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private dialog = inject(MatDialog);
  private demoService = inject(DemoService);
  private auth = inject(AuthService);
  installGuide = inject(InstallGuideService);
  private fb = inject(FormBuilder);

  readonly upgradeDialog = viewChild.required<TemplateRef<unknown>>('upgradeDialog');
  private dialogRef?: MatDialogRef<unknown>;

  private now = signal(Date.now());
  private timer = setInterval(() => this.now.set(Date.now()), 1000);
  session = signal<DemoSession | null>(this.read());
  dismissed = signal(this.readDismissed());
  upgradeBusy = signal(false);

  upgradeForm = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
      displayName: [''],
    },
    { validators: (g) => {
        const pw = g.get('password')?.value;
        const cpw = g.get('confirmPassword')?.value;
        return pw && cpw && pw !== cpw ? { passwordMismatch: true } : null;
      }
    }
  );

  countdownLabel = computed(() => {
    const s = this.session();
    if (!s?.expiresAt) return '';
    const remaining = new Date(s.expiresAt).getTime() - this.now();
    if (remaining <= 0) return this.transloco.translate('demo.expired');
    const totalMinutes = Math.floor(remaining / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return this.transloco.translate('demo.expiresIn', { hours, minutes });
  });

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

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(
      () => this.snack.open(this.transloco.translate('demo.copied'), 'OK', { duration: 2000 }),
      () => this.snack.open(this.transloco.translate('demo.copyFailed'), 'OK', { duration: 3000 })
    );
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
    this.dialogRef = this.dialog.open(this.upgradeDialog(), { width: '480px' });
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
            this.snack.open(this.transloco.translate('demo.upgradeSuccess'), 'OK', { duration: 5000 });
          },
          error: (e: unknown) => {
            this.upgradeBusy.set(false);
            this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
          },
        });
      },
      error: (e: unknown) => {
        this.upgradeBusy.set(false);
        this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
      },
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
