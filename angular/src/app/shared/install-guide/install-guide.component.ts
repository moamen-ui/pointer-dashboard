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
import { getApiMeApiKeyResource } from '@moamen-ui/pointer-angular';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { InstallGuideService } from './install-guide.service';
import { TabsComponent, type TabItem } from '../tabs/tabs.component';
import { TabContentDirective } from '../tabs/tab-content.directive';

/** One step in the guide. `code`/`downloadUrl` are optional — instruction-only steps omit both. */
export interface SetupStep {
  titleKey: string;
  hintKey: string;
  code?: string;
  /** Renders the step as a download anchor instead of a code block. */
  downloadUrl?: string;
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
/** The extension zip is a landing-domain artifact served by Caddy — deliberately
 *  not derived from the API base, which points at a different origin. */
export const EXTENSION_ZIP_URL = 'https://pointer.moamen.work/pointer-extension.zip';
/** Rendered in the snippet until the user actually has a project to point at. */
export const PROJECT_KEY_PLACEHOLDER = '<your-project-key>';
/** Placeholder inside the credentials snippet for a demo session. Deliberately not
 *  translated — it is pasted into .pointer/credentials.env, where English reads
 *  correctly either way. */
export const PASSWORD_PLACEHOLDER = '<your password>';
/** Placeholder shown for the signed-in user's own API key while it's still loading
 *  (or failed to load) — see ProfileComponent for the same key, always re-viewable. */
export const API_KEY_PLACEHOLDER = '<your API key — see your Profile page>';

/** What the dialog renders: the agent-driven path, plus the hand-wiring fallback. */
export interface GuideSteps {
  /** The recommended path, in order. */
  primary: SetupStep[];
  /** Hand-wiring the widget — only needed if you skip the agent prompt. */
  manual: SetupStep[];
}

/**
 * Builds the install steps. Pure so the branching (demo credentials vs. the signed-in
 * user's own, and the placeholder when there is no project yet) is unit-testable.
 *
 * Shape of the flow: install.sh drops in two skills — pointer-init and
 * pointer-feedback — so wiring the widget is a prompt, not two snippets pasted into
 * index.html. pointer-init detects the host stack (Vite / Angular / Next / CRA /
 * static / Swagger) and wires the loader and env vars the way that stack expects,
 * which the raw snippets cannot do. They stay available as the manual fallback.
 */
export function buildSteps(input: {
  server: string;
  projectKey: string | null;
  userEmail: string | null;
  apiKey: string | null;
  demo: DemoSession | null;
  credsEmailedText: string;
}): GuideSteps {
  const { server, demo } = input;
  const projectKey = input.projectKey || PROJECT_KEY_PLACEHOLDER;
  const credentials = credentialsSnippet(input);

  return {
    primary: [
      // Installs pointer-init + pointer-feedback and scaffolds .pointer/credentials.env.
      { titleKey: 'demo.step3Title', hintKey: 'demo.step3Hint', code: `curl -fsSL ${server}/install.sh | sh` },
      { titleKey: 'demo.step4Title', hintKey: 'demo.step4Hint', code: credentials },
      // Names the skill and supplies its three variables, so the agent wires the
      // widget straight away instead of stopping to ask for them.
      {
        titleKey: 'install.stepAgentTitle',
        hintKey: 'install.stepAgentHint',
        code: `Add the Pointer feedback widget to this app using the pointer-init skill — project key: ${projectKey}, Pointer server URL: ${server}, environment: local`,
      },
      { titleKey: 'demo.step5Title', hintKey: 'demo.step5Hint' },
      // Kept English on purpose — the pointer-feedback skill triggers on this phrasing.
      { titleKey: 'demo.step6Title', hintKey: 'demo.step6Hint', code: 'What are the new Pointer comments?' },
    ],
    manual: [
      { titleKey: 'demo.step1Title', hintKey: 'demo.step1Hint', code: `<script src="${server}/pointer.js" defer></script>` },
      { titleKey: 'demo.step2Title', hintKey: 'demo.step2Hint', code: `<pointer-feedback project="${projectKey}" server="${server}"></pointer-feedback>` },
    ],
  };
}

/** The credentials snippet, shared by the code guide and the extension sign-in step:
 *  demo widget login during a demo session (still email/password — a demo account's
 *  own API key isn't fetched here, a separate concern from the signed-in user's own),
 *  the signed-in user's own API key otherwise (fetched by the component, passed in —
 *  this function stays pure/sync for testability). */
function credentialsSnippet(input: {
  server: string;
  userEmail: string | null;
  apiKey: string | null;
  demo: DemoSession | null;
  credsEmailedText: string;
}): string {
  const { demo } = input;
  return demo
    ? demo.emailSent
      ? input.credsEmailedText
      : `POINTER_EMAIL=${demo.email ?? ''}\nPOINTER_PASSWORD=${demo.password ?? ''}`
    : `POINTER_API_KEY=${input.apiKey ?? API_KEY_PLACEHOLDER}`;
}

/**
 * Builds the Chrome-extension install steps. Pure, like buildSteps, so the
 * credentials branching is unit-testable the same way.
 */
export function buildExtensionSteps(input: {
  server: string;
  userEmail: string | null;
  apiKey: string | null;
  demo: DemoSession | null;
  credsEmailedText: string;
}): SetupStep[] {
  const { server } = input;
  return [
    {
      titleKey: 'install.extStep1Title',
      hintKey: 'install.extStep1Hint',
      downloadUrl: EXTENSION_ZIP_URL,
    },
    { titleKey: 'install.extStep2Title', hintKey: 'install.extStep2Hint' },
    { titleKey: 'install.extStep3Title', hintKey: 'install.extStep3Hint', code: 'chrome://extensions' },
    {
      titleKey: 'install.extStep4Title',
      hintKey: 'install.extStep4Hint',
      code: `${server}\n${credentialsSnippet(input)}`,
    },
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
    TabsComponent,
    TabContentDirective,
  ],
  template: `
    <h2 mat-dialog-title class="flex items-center gap-2">
      <mat-icon class="text-brand">rocket_launch</mat-icon>
      {{ 'install.title' | transloco }}
    </h2>

    <mat-dialog-content>
      <p class="mt-0 mb-4 text-[0.85rem] text-muted">{{ 'install.intro' | transloco }}</p>

      <!-- Two install paths: the code-based guide and the Chrome extension. Not persisted:
           "Code" is the default every time. -->
      <app-tabs [tabs]="tabItems()" [activeTab]="tab()" (activeTabChange)="tab.set($event)">
        <ng-template appTabContent="code">
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

          <!-- The recommended path: install the skills, then let the agent wire the widget -->
          <ol class="mt-4 mb-0 flex list-none flex-col gap-3 p-0">
            @for (st of steps().primary; track st.titleKey; let i = $index) {
              <li class="rounded-lg border border-app-border bg-app/40 p-3">
                <div class="text-[0.85rem] font-semibold">{{ i + 1 }}. {{ st.titleKey | transloco }}</div>
                <div class="mt-0.5 text-[0.78rem] text-muted">{{ st.hintKey | transloco }}</div>
                @if (st.code; as code) {
                  <div class="mt-2 flex items-start gap-2">
                    <pre class="m-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded bg-app px-2 py-1.5 text-[0.78rem]"><code>{{ code }}</code></pre>
                    <button mat-stroked-button class="border-app-border" type="button" (click)="copy(code)">
                      <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                    </button>
                  </div>
                }
              </li>
            }
          </ol>

          <!-- Hand-wiring, for anyone not using an agent. Collapsed: the prompt above
               does this per-stack, so these snippets are the fallback, not the path. -->
          <details class="mt-4 rounded-lg border border-app-border p-3">
            <summary class="cursor-pointer text-[0.85rem] font-semibold">
              {{ 'install.manualTitle' | transloco }}
            </summary>
            <p class="mb-2 mt-1 text-[0.78rem] text-muted">{{ 'install.manualHint' | transloco }}</p>
            <div class="flex flex-col gap-3">
              @for (st of steps().manual; track st.titleKey) {
                <div>
                  <div class="text-[0.8rem] font-medium">{{ st.titleKey | transloco }}</div>
                  <div class="mt-0.5 text-[0.75rem] text-muted">{{ st.hintKey | transloco }}</div>
                  @if (st.code; as code) {
                    <div class="mt-1.5 flex items-start gap-2">
                      <pre class="m-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded bg-app px-2 py-1.5 text-[0.78rem]"><code>{{ code }}</code></pre>
                      <button mat-stroked-button class="border-app-border" type="button" (click)="copy(code)">
                        <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          </details>
        </ng-template>

        <ng-template appTabContent="extension">
          <!-- Chrome extension: download, unzip, load unpacked, sign in -->
          <ol class="mt-0 mb-0 flex list-none flex-col gap-3 p-0">
            @for (st of extensionSteps(); track st.titleKey; let i = $index) {
              <li class="rounded-lg border border-app-border bg-app/40 p-3">
                <div class="text-[0.85rem] font-semibold">{{ i + 1 }}. {{ st.titleKey | transloco }}</div>
                <div class="mt-0.5 text-[0.78rem] text-muted">{{ st.hintKey | transloco }}</div>
                @if (st.downloadUrl; as url) {
                  <a mat-flat-button color="primary" class="mt-2" [href]="url" download>
                    <mat-icon>download</mat-icon> {{ 'install.extDownload' | transloco }}
                  </a>
                } @else if (st.code; as code) {
                  <div class="mt-2 flex items-start gap-2">
                    <pre class="m-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded bg-app px-2 py-1.5 text-[0.78rem]"><code>{{ code }}</code></pre>
                    <button mat-stroked-button class="border-app-border" type="button" (click)="copy(code)">
                      <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                    </button>
                  </div>
                }
              </li>
            }
          </ol>
        </ng-template>
      </app-tabs>
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

  // The signed-in user's own API key — same one shown on the Profile page, re-viewable there
  // any time. Not fetched for a demo session (credentialsSnippet keeps demo email/password).
  private readonly apiKeyResource = getApiMeApiKeyResource();

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

  /** Which install method the dialog shows. Component state only — not persisted. */
  readonly tab = signal<string>('code');

  // A method (not a stored field) so labels stay live if the app language changes.
  tabItems(): TabItem[] {
    return [
      { value: 'code', label: this.transloco.translate('install.tabCode') },
      { value: 'extension', label: this.transloco.translate('install.tabExtension') },
    ];
  }

  private readonly stepsInput = () => ({
    server: this.demo()?.serverUrl || environment.apiBase,
    userEmail: this.auth.user()?.email ?? null,
    apiKey: this.apiKeyResource.value()?.apiKey ?? null,
    demo: this.demo(),
    credsEmailedText: this.translatedCredsEmailed(),
  });

  readonly steps = computed(() =>
    buildSteps({
      ...this.stepsInput(),
      projectKey: this.projectKey() ?? this.projects()[0]?.key ?? null,
    }),
  );

  readonly extensionSteps = computed(() => buildExtensionSteps(this.stepsInput()));

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
