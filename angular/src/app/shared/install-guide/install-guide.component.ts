import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { InstallGuideService } from './install-guide.service';

/** One step in the guide. `code` is optional — instruction-only steps omit it. */
export interface SetupStep {
  titleKey: string;
  hintKey: string;
  code?: string;
}

/** Demo session written by the demo provisioning flow (sessionStorage). */
interface DemoSession {
  email?: string | null;
  password?: string | null;
  projectKey?: string | null;
  serverUrl?: string | null;
  emailSent?: boolean;
}

const DEMO_SESSION_KEY = 'pointer_demo';
/** Rendered in the snippet until the user actually has a project to point at. */
export const PROJECT_KEY_PLACEHOLDER = '<your-project-key>';
/** Placeholder inside the credentials snippet. Deliberately not translated — it is
 *  pasted into .pointer/credentials.env, where English reads correctly either way. */
export const PASSWORD_PLACEHOLDER = '<your password>';

/**
 * Builds the install steps. Pure so the branching (demo credentials vs. the signed-in
 * user's own, and the placeholder when there is no project yet) is unit-testable.
 */
export function buildSteps(input: {
  server: string;
  projectKey: string | null;
  userEmail: string | null;
  demo: DemoSession | null;
  credsEmailedText: string;
}): SetupStep[] {
  const { server, demo } = input;
  const projectKey = input.projectKey || PROJECT_KEY_PLACEHOLDER;
  const credentials = demo
    ? demo.emailSent
      ? input.credsEmailedText
      : `POINTER_EMAIL=${demo.email ?? ''}\nPOINTER_PASSWORD=${demo.password ?? ''}`
    : `POINTER_EMAIL=${input.userEmail ?? ''}\nPOINTER_PASSWORD=${PASSWORD_PLACEHOLDER}`;

  return [
    { titleKey: 'demo.step1Title', hintKey: 'demo.step1Hint', code: `<script src="${server}/pointer.js" defer></script>` },
    { titleKey: 'demo.step2Title', hintKey: 'demo.step2Hint', code: `<pointer-feedback project="${projectKey}" server="${server}"></pointer-feedback>` },
    { titleKey: 'demo.step3Title', hintKey: 'demo.step3Hint', code: `curl -fsSL ${server}/install.sh | sh` },
    { titleKey: 'demo.step4Title', hintKey: 'demo.step4Hint', code: credentials },
    { titleKey: 'demo.step5Title', hintKey: 'demo.step5Hint' },
    // Kept English on purpose — the pointer-feedback skill triggers on this phrasing.
    { titleKey: 'demo.step6Title', hintKey: 'demo.step6Hint', code: 'What are the new Pointer comments?' },
  ];
}

/**
 * The installation steps, in a dialog. Opened from the header icon (any signed-in
 * user, any time) and automatically for a workspace admin who is new here or has
 * no feedback yet — see InstallGuideService for that policy.
 */
@Component({
  selector: 'app-install-guide',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatCheckboxModule,
    RouterLink,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title class="flex items-center gap-2">
      <mat-icon class="text-brand">rocket_launch</mat-icon>
      {{ 'install.title' | transloco }}
    </h2>

    <mat-dialog-content>
      <p class="mt-0 mb-4 text-[0.85rem] text-muted">{{ 'install.intro' | transloco }}</p>

      <!-- Which project the snippet points at -->
      @if (projects().length > 0) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
          <mat-label>{{ 'install.project' | transloco }}</mat-label>
          <mat-select [value]="projectKey()" (selectionChange)="projectKey.set($event.value)">
            @for (p of projects(); track p.id) {
              <mat-option [value]="p.key">{{ p.name }} ({{ p.key }})</mat-option>
            }
          </mat-select>
        </mat-form-field>
      } @else if (!demo()) {
        <p class="my-0 rounded-lg border border-app-border bg-app/40 p-3 text-[0.85rem]">
          {{ 'install.noProjects' | transloco }}
          <a routerLink="/projects" mat-dialog-close class="text-brand underline">
            {{ 'nav.projects' | transloco }}
          </a>
        </p>
      }

      <!-- Steps, all of them, in order -->
      <ol class="mt-4 mb-0 flex list-none flex-col gap-3 p-0">
        @for (st of steps(); track st.titleKey; let i = $index) {
          <li class="rounded-lg border border-app-border bg-app/40 p-3">
            <div class="text-[0.85rem] font-semibold">{{ i + 1 }}. {{ st.titleKey | transloco }}</div>
            <div class="mt-0.5 text-[0.78rem] text-muted">{{ st.hintKey | transloco }}</div>
            @if (st.code; as code) {
              <div class="mt-2 flex items-start gap-2">
                <pre class="m-0 flex-1 overflow-x-auto rounded bg-app px-2 py-1.5 text-[0.78rem]"><code>{{ code }}</code></pre>
                <button mat-stroked-button class="border-app-border" type="button" (click)="copy(code)">
                  <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                </button>
              </div>
            }
          </li>
        }
      </ol>
    </mat-dialog-content>

    <mat-dialog-actions class="justify-between gap-3">
      <mat-checkbox [checked]="suppressed()" (change)="setSuppressed($event.checked)">
        <span class="text-[0.8rem]">{{ 'install.dontShowAgain' | transloco }}</span>
      </mat-checkbox>
      <button mat-flat-button color="primary" mat-dialog-close>{{ 'install.done' | transloco }}</button>
    </mat-dialog-actions>
  `,
})
export class InstallGuideComponent {
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private auth = inject(AuthService);
  private guide = inject(InstallGuideService);

  // Transloco loads its language file over HTTP, so a translate() call made while
  // building the steps can land before the file arrives and echo the key back. This
  // signal makes the computed below re-run once a load event fires.
  private translationEvents = toSignal(this.transloco.events$, { initialValue: null });

  readonly demo = signal<DemoSession | null>(this.readDemoSession());
  readonly projects = computed(() => this.guide.projects().filter((p) => p.key));

  /** Selected project key; defaults to the demo project, else the first one. */
  readonly projectKey = signal<string | null>(
    this.readDemoSession()?.projectKey ?? null,
  );

  readonly suppressed = signal(this.guide.isSuppressed(this.auth.user()?.id ?? null));

  readonly steps = computed(() =>
    buildSteps({
      server: this.demo()?.serverUrl || environment.apiBase,
      projectKey: this.projectKey() ?? this.projects()[0]?.key ?? null,
      userEmail: this.auth.user()?.email ?? null,
      demo: this.demo(),
      credsEmailedText: this.translatedCredsEmailed(),
    }),
  );

  /** Re-resolves whenever transloco emits (initial load, language switch). */
  private readonly translatedCredsEmailed = computed(() => {
    this.translationEvents();
    return this.transloco.translate('demo.credsEmailed');
  });

  constructor() {
    // Opening it counts as seen, however it was opened.
    this.guide.markShown(this.auth.user()?.id ?? null);
  }

  setSuppressed(checked: boolean): void {
    this.suppressed.set(checked);
    const userId = this.auth.user()?.id ?? null;
    if (checked) this.guide.suppress(userId);
    else this.guide.unsuppress(userId);
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(
      () => this.snack.open(this.transloco.translate('demo.copied'), 'OK', { duration: 2000 }),
      () => this.snack.open(this.transloco.translate('demo.copyFailed'), 'OK', { duration: 3000 }),
    );
  }

  private readDemoSession(): DemoSession | null {
    try {
      return JSON.parse(sessionStorage.getItem(DEMO_SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }
}
