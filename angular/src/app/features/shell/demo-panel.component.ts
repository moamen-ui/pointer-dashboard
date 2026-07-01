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
import { extractMessage } from '../../core/api/extract-message';

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
  ],
  template: `
    @if (session(); as s) {
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

            <!-- Setup guide: one step at a time, Back / Next -->
            <div class="mt-4 rounded-lg border border-app-border bg-app/40 p-3">
              @if (steps()[step() - 1]; as st) {
                <div>
                  <div class="text-[0.8rem] font-semibold">{{ st.titleKey | transloco }}</div>
                  <div class="text-[0.75rem] text-muted">{{ st.hintKey | transloco }}</div>
                  @if (st.code; as code) {
                    <div class="mt-1 flex items-start gap-2">
                      <pre class="m-0 flex-1 overflow-x-auto rounded bg-app px-2 py-1.5 text-[0.8rem]"><code>{{ code }}</code></pre>
                      <button mat-stroked-button class="border-app-border" type="button" (click)="copy(code)">
                        <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                      </button>
                    </div>
                  }
                </div>
              }

              <div class="mt-3 flex items-center gap-2">
                <button mat-stroked-button class="border-app-border" type="button" [disabled]="step() === 1" (click)="prev()">
                  <mat-icon>chevron_left</mat-icon> {{ 'demo.back' | transloco }}
                </button>
                <span class="text-[0.8rem] text-muted">{{ step() }} / {{ steps().length }}</span>
                <button mat-stroked-button class="ms-auto border-app-border" type="button" [disabled]="step() === steps().length" (click)="next()">
                  {{ 'demo.next' | transloco }} <mat-icon>chevron_right</mat-icon>
                </button>
              </div>
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
          <mat-form-field appearance="outline">
            <mat-label>{{ 'demo.email' | transloco }}</mat-label>
            <input matInput type="email" formControlName="email" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'demo.password' | transloco }}</mat-label>
            <input matInput type="password" formControlName="password" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'demo.confirmPassword' | transloco }}</mat-label>
            <input matInput type="password" formControlName="confirmPassword" />
          </mat-form-field>
          @if (upgradeForm.errors?.['passwordMismatch'] && upgradeForm.get('confirmPassword')?.dirty) {
            <p class="m-0 text-[0.85rem] text-red-600">{{ 'demo.passwordMismatch' | transloco }}</p>
          }
          <mat-form-field appearance="outline">
            <mat-label>{{ 'demo.displayName' | transloco }}</mat-label>
            <input matInput formControlName="displayName" />
          </mat-form-field>
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
  private fb = inject(FormBuilder);

  readonly upgradeDialog = viewChild.required<TemplateRef<unknown>>('upgradeDialog');
  private dialogRef?: MatDialogRef<unknown>;

  private now = signal(Date.now());
  private timer = setInterval(() => this.now.set(Date.now()), 1000);
  session = signal<DemoSession | null>(this.read());
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

  // The setup guide, derived from the demo session. Add/remove entries here to
  // change the guide — the slider count follows the array length.
  steps = computed<SetupStep[]>(() => {
    const s = this.session();
    if (!s) return [];
    const srv = s.serverUrl ?? '';
    return [
      { titleKey: 'demo.step1Title', hintKey: 'demo.step1Hint', code: `<script src="${srv}/pointer.js" defer></script>` },
      { titleKey: 'demo.step2Title', hintKey: 'demo.step2Hint', code: `<pointer-feedback project="${s.projectKey ?? ''}" server="${srv}"></pointer-feedback>` },
      { titleKey: 'demo.step3Title', hintKey: 'demo.step3Hint', code: `curl -fsSL ${srv}/install.sh | sh` },
      {
        titleKey: 'demo.step4Title',
        hintKey: 'demo.step4Hint',
        code: s.emailSent
          ? this.transloco.translate('demo.credsEmailed')
          : `POINTER_EMAIL=${s.email ?? ''}\nPOINTER_PASSWORD=${s.password ?? ''}`,
      },
      { titleKey: 'demo.step5Title', hintKey: 'demo.step5Hint' },
      // Example prompt kept English — the pointer-feedback skill triggers on it.
      { titleKey: 'demo.step6Title', hintKey: 'demo.step6Hint', code: 'What are the new Pointer comments?' },
    ];
  });

  step = signal(1);
  next(): void { this.step.update((n) => Math.min(this.steps().length, n + 1)); }
  prev(): void { this.step.update((n) => Math.max(1, n - 1)); }

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

  dismiss(): void {
    sessionStorage.removeItem(DEMO_SESSION_KEY);
    this.session.set(null);
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
