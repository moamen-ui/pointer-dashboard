import {
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  getApiMeApiKeyResource,
  ProjectsService,
} from '@moamen-ui/pointer-angular';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { InstallGuideService } from './install-guide.service';
import { slugifyKey } from '../project-utils';

/** One step in the guide. `code`/`downloadUrl` are optional — instruction-only steps omit both. */
export type SetupStep = {
  titleKey: string;
  hintKey: string;
  code?: string;
  /** Renders the step as a download anchor instead of a code block. */
  downloadUrl?: string;
};

/** Demo session written by the demo provisioning flow (sessionStorage). */
export type DemoSession = {
  email?: string | null;
  password?: string | null;
  projectKey?: string | null;
  serverUrl?: string | null;
  emailSent?: boolean;
};

export type WizardStep = 'project' | 'method' | 'install' | 'verify';
export type InstallMethod = 'agent' | 'snippet' | 'extension';
export type FrameworkStack = 'html' | 'react' | 'vue' | 'angular';
export type ConnectionStatus = 'idle' | 'checking' | 'active' | 'inactive';

const DEMO_SESSION_KEY = 'pointer_demo';
export const EXTENSION_ZIP_URL = 'https://pointer.moamen.work/pointer-extension.zip';
export const PROJECT_KEY_PLACEHOLDER = '<your-project-key>';
export const PASSWORD_PLACEHOLDER = '<your password>';
export const API_KEY_PLACEHOLDER = '<your API key — see your Profile page>';

/** What the dialog renders: the agent-driven path, plus the hand-wiring fallback. */
export type GuideSteps = {
  /** The recommended path, in order. */
  primary: SetupStep[];
  /** Hand-wiring the widget — only needed if you skip the agent prompt. */
  manual: SetupStep[];
};

export async function checkLocalhostWidgetStatus(server: string, projectKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${server}/api/public/projects/${projectKey}/widget-status?origin=http://localhost:3000`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.data?.active;
  } catch {
    return false;
  }
}

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
      { titleKey: 'demo.step3Title', hintKey: 'demo.step3Hint', code: `curl -fsSL ${server}/install.sh | sh` },
      { titleKey: 'demo.step4Title', hintKey: 'demo.step4Hint', code: credentials },
      {
        titleKey: 'install.stepAgentTitle',
        hintKey: 'install.stepAgentHint',
        code: `Add the Pointer feedback widget to this app using the pointer-init skill — project key: ${projectKey}, Pointer server URL: ${server}, environment: local`,
      },
      { titleKey: 'demo.step5Title', hintKey: 'demo.step5Hint' },
      { titleKey: 'demo.step6Title', hintKey: 'demo.step6Hint', code: 'What are the new Pointer comments?' },
    ],
    manual: [
      { titleKey: 'demo.step1Title', hintKey: 'demo.step1Hint', code: `<script src="${server}/pointer.js" defer></script>` },
      { titleKey: 'demo.step2Title', hintKey: 'demo.step2Hint', code: `<pointer-feedback project="${projectKey}" server="${server}"></pointer-feedback>` },
    ],
  };
}

export function credentialsSnippet(input: {
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

@Component({
  selector: 'app-install-guide',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    RouterLink,
    TranslocoModule,
  ],
  template: `
    <div class="flex items-center justify-between border-b border-app-border px-6 py-4">
      <h2 class="m-0 flex items-center gap-2 text-lg font-bold text-ink">
        <mat-icon class="text-brand">rocket_launch</mat-icon>
        {{ 'install.title' | transloco }}
      </h2>
      <button mat-icon-button type="button" class="!h-8 !w-8" (click)="closeDialog()">
        <mat-icon class="!text-base">close</mat-icon>
      </button>
    </div>

    <div class="max-h-[82vh] overflow-y-auto px-6 py-4">
      <!-- Stepper / Progress Bar -->
      <div class="mb-6 flex items-center justify-between border-b border-app-border pb-4">
        @for (st of wizardSteps; track st.key; let i = $index) {
          <div
            class="flex items-center gap-2 cursor-pointer transition-colors"
            (click)="canNavigateToStep(st.key) && currentStep.set(st.key)"
          >
            <div
              class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all"
              [class.bg-brand]="currentStep() === st.key"
              [class.text-white]="currentStep() === st.key"
              [class.bg-app-border]="currentStep() !== st.key"
              [class.text-muted]="currentStep() !== st.key"
            >
              {{ i + 1 }}
            </div>
            <span
              class="hidden text-xs font-medium sm:inline"
              [class.text-brand]="currentStep() === st.key"
              [class.text-muted]="currentStep() !== st.key"
            >
              {{ st.labelKey | transloco }}
            </span>
          </div>
          @if (i < wizardSteps.length - 1) {
            <div class="h-[1px] flex-1 bg-app-border mx-2"></div>
          }
        }
      </div>

      <!-- ========================================================================= -->
      <!-- STEP 1: PROJECT SETUP                                                     -->
      <!-- ========================================================================= -->
      @if (currentStep() === 'project') {
        <div class="flex flex-col gap-4 py-1">
          <div>
            <h3 class="m-0 text-base font-semibold text-ink">
              {{ 'install.wizard.projectTitle' | transloco }}
            </h3>
            <p class="mt-1 text-xs text-muted">
              {{ 'install.wizard.projectDesc' | transloco }}
            </p>
          </div>

          @if (projects().length > 0) {
            <div class="rounded-xl border border-app-border bg-panel p-4">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                <mat-label>{{ 'install.project' | transloco }}</mat-label>
                <mat-select [value]="effectiveProjectKey()" (selectionChange)="projectKey.set($event.value)">
                  @for (p of projects(); track p.id) {
                    <mat-option [value]="p.key">{{ p.name }} ({{ p.key }})</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          } @else {
            <div class="rounded-xl border border-app-border bg-panel p-4">
              <p class="mt-0 mb-3 text-xs text-muted">
                {{ 'install.wizard.noProjects' | transloco }}
              </p>
              <div class="flex flex-col gap-3">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                  <mat-label>{{ 'install.wizard.projectName' | transloco }}</mat-label>
                  <input
                    matInput
                    [ngModel]="newProjectName()"
                    (ngModelChange)="onProjectNameChanged($event)"
                    placeholder="e.g. Acme Website"
                  />
                </mat-form-field>

                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                  <mat-label>{{ 'install.wizard.projectKey' | transloco }}</mat-label>
                  <input
                    matInput
                    [ngModel]="newProjectKey()"
                    (ngModelChange)="newProjectKey.set($event)"
                    placeholder="acme-website"
                  />
                </mat-form-field>

                @if (createError()) {
                  <p class="m-0 text-xs text-red-500">{{ createError() }}</p>
                }

                <div class="flex justify-end">
                  <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    [disabled]="!newProjectName().trim() || !newProjectKey().trim() || isCreatingProject()"
                    (click)="createFirstProject()"
                  >
                    @if (isCreatingProject()) {
                      {{ 'install.wizard.creating' | transloco }}
                    } @else {
                      {{ 'install.wizard.createProject' | transloco }}
                    }
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- ========================================================================= -->
      <!-- STEP 2: CHOOSE METHOD                                                     -->
      <!-- ========================================================================= -->
      @if (currentStep() === 'method') {
        <div class="flex flex-col gap-4 py-1">
          <div>
            <h3 class="m-0 text-base font-semibold text-ink">
              {{ 'install.wizard.methodTitle' | transloco }}
            </h3>
            <p class="mt-1 text-xs text-muted">
              {{ 'install.wizard.methodDesc' | transloco }}
            </p>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <!-- AI Agent Card -->
            <div
              class="cursor-pointer rounded-xl border p-4 transition-all"
              [class.border-brand]="selectedMethod() === 'agent'"
              [class.bg-brand-tint]="selectedMethod() === 'agent'"
              [class.border-app-border]="selectedMethod() !== 'agent'"
              [class.bg-panel]="selectedMethod() !== 'agent'"
              (click)="selectedMethod.set('agent')"
            >
              <div class="flex items-center justify-between">
                <mat-icon class="text-brand">terminal</mat-icon>
                <span class="rounded bg-brand/10 px-2 py-0.5 text-[0.65rem] font-bold text-brand uppercase">
                  {{ 'install.wizard.methodAgentBadge' | transloco }}
                </span>
              </div>
              <h4 class="mt-3 mb-1 text-sm font-bold text-ink">
                {{ 'install.wizard.methodAgentTitle' | transloco }}
              </h4>
              <p class="m-0 text-xs leading-relaxed text-muted">
                {{ 'install.wizard.methodAgentDesc' | transloco }}
              </p>
            </div>

            <!-- Code Snippet Card -->
            <div
              class="cursor-pointer rounded-xl border p-4 transition-all"
              [class.border-brand]="selectedMethod() === 'snippet'"
              [class.bg-brand-tint]="selectedMethod() === 'snippet'"
              [class.border-app-border]="selectedMethod() !== 'snippet'"
              [class.bg-panel]="selectedMethod() !== 'snippet'"
              (click)="selectedMethod.set('snippet')"
            >
              <mat-icon class="text-brand">code</mat-icon>
              <h4 class="mt-3 mb-1 text-sm font-bold text-ink">
                {{ 'install.wizard.methodSnippetTitle' | transloco }}
              </h4>
              <p class="m-0 text-xs leading-relaxed text-muted">
                {{ 'install.wizard.methodSnippetDesc' | transloco }}
              </p>
            </div>

            <!-- Extension Card -->
            <div
              class="cursor-pointer rounded-xl border p-4 transition-all"
              [class.border-brand]="selectedMethod() === 'extension'"
              [class.bg-brand-tint]="selectedMethod() === 'extension'"
              [class.border-app-border]="selectedMethod() !== 'extension'"
              [class.bg-panel]="selectedMethod() !== 'extension'"
              (click)="selectedMethod.set('extension')"
            >
              <mat-icon class="text-brand">extension</mat-icon>
              <h4 class="mt-3 mb-1 text-sm font-bold text-ink">
                {{ 'install.wizard.methodExtTitle' | transloco }}
              </h4>
              <p class="m-0 text-xs leading-relaxed text-muted">
                {{ 'install.wizard.methodExtDesc' | transloco }}
              </p>
            </div>
          </div>
        </div>
      }

      <!-- ========================================================================= -->
      <!-- STEP 3: ADD CODE TO PROJECT                                               -->
      <!-- ========================================================================= -->
      @if (currentStep() === 'install') {
        <div class="flex flex-col gap-4 py-1">
          <!-- AI Agent Mode -->
          @if (selectedMethod() === 'agent') {
            <div class="flex flex-col gap-3">
              <div class="rounded-xl border border-app-border bg-panel p-4">
                <div class="text-xs font-semibold text-ink">
                  {{ 'install.wizard.curlTitle' | transloco }}
                </div>
                <div class="mt-0.5 text-xs text-muted">
                  {{ 'install.wizard.curlHint' | transloco }}
                </div>
                <div class="mt-2 flex items-center gap-2">
                  <pre class="m-0 flex-1 overflow-x-auto rounded bg-app px-2.5 py-2 font-mono text-xs text-ink"><code>curl -fsSL {{ serverUrl() }}/install.sh | sh</code></pre>
                  <button mat-stroked-button class="border-app-border" type="button" (click)="copy('curl -fsSL ' + serverUrl() + '/install.sh | sh')">
                    <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                  </button>
                </div>
              </div>

              <div class="rounded-xl border border-app-border bg-panel p-4">
                <div class="text-xs font-semibold text-ink">
                  {{ 'install.wizard.credsTitle' | transloco }}
                </div>
                <div class="mt-0.5 text-xs text-muted">
                  {{ 'install.wizard.credsHint' | transloco }}
                </div>
                <div class="mt-2 flex items-start gap-2">
                  <pre class="m-0 flex-1 overflow-x-auto rounded bg-app px-2.5 py-2 font-mono text-xs text-ink"><code>{{ credentials() }}</code></pre>
                  <button mat-stroked-button class="border-app-border" type="button" (click)="copy(credentials())">
                    <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                  </button>
                </div>
              </div>

              <div class="rounded-xl border border-app-border bg-panel p-4">
                <div class="text-xs font-semibold text-ink">
                  {{ 'install.wizard.agentPromptTitle' | transloco }}
                </div>
                <div class="mt-0.5 text-xs text-muted">
                  {{ 'install.wizard.agentPromptHint' | transloco }}
                </div>
                <div class="mt-2 flex items-start gap-2">
                  <pre class="m-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded bg-app px-2.5 py-2 font-mono text-xs text-ink"><code>{{ agentPrompt() }}</code></pre>
                  <button mat-stroked-button class="border-app-border" type="button" (click)="copy(agentPrompt())">
                    <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Code Snippet Mode -->
          @if (selectedMethod() === 'snippet') {
            <div class="flex flex-col gap-3">
              <div class="flex flex-wrap gap-2">
                @for (tab of stackTabs; track tab.stack) {
                  <button
                    mat-stroked-button
                    type="button"
                    class="!h-8 !text-xs"
                    [class.!bg-brand]="selectedStack() === tab.stack"
                    [class.!text-white]="selectedStack() === tab.stack"
                    [class.border-app-border]="selectedStack() !== tab.stack"
                    (click)="selectedStack.set(tab.stack)"
                  >
                    {{ tab.labelKey | transloco }}
                  </button>
                }
              </div>

              <div class="rounded-xl border border-app-border bg-panel p-4">
                <div class="text-xs text-muted mb-2">
                  {{ 'install.wizard.snippetInstructions' | transloco }}
                </div>
                <div class="flex items-start gap-2">
                  <pre class="m-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded bg-app px-2.5 py-2 font-mono text-xs text-ink"><code>{{ currentStackSnippet() }}</code></pre>
                  <button mat-stroked-button class="border-app-border" type="button" (click)="copy(currentStackSnippet())">
                    <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Extension Mode -->
          @if (selectedMethod() === 'extension') {
            <ol class="m-0 flex list-none flex-col gap-3 p-0">
              @for (st of extensionSteps(); track st.titleKey; let i = $index) {
                <li class="rounded-xl border border-app-border bg-panel p-4">
                  <div class="text-xs font-semibold text-ink">
                    {{ i + 1 }}. {{ st.titleKey | transloco }}
                  </div>
                  <div class="mt-0.5 text-xs text-muted">{{ st.hintKey | transloco }}</div>
                  @if (st.downloadUrl; as url) {
                    <a mat-flat-button color="primary" class="mt-3" [href]="url" download>
                      <mat-icon>download</mat-icon> {{ 'install.extDownload' | transloco }}
                    </a>
                  } @else if (st.code; as code) {
                    <div class="mt-2 flex items-start gap-2">
                      <pre class="m-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded bg-app px-2.5 py-2 font-mono text-xs text-ink"><code>{{ code }}</code></pre>
                      <button mat-stroked-button class="border-app-border" type="button" (click)="copy(code)">
                        <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                      </button>
                    </div>
                  }
                </li>
              }
            </ol>
          }
        </div>
      }

      <!-- ========================================================================= -->
      <!-- STEP 4: LAUNCH & SEE IT LIVE                                              -->
      <!-- ========================================================================= -->
      @if (currentStep() === 'verify') {
        <div class="flex flex-col gap-4 py-1">
          <div>
            <h3 class="m-0 text-base font-semibold text-ink">
              {{ 'install.wizard.step4Title' | transloco }}
            </h3>
            <p class="mt-1 text-xs text-muted">
              {{ 'install.wizard.step4Hint' | transloco }}
            </p>
          </div>

          <!-- 4-step checklist -->
          <div class="flex flex-col gap-2.5">
            <div class="flex items-start gap-3 rounded-xl border border-app-border bg-panel p-3.5">
              <mat-icon class="text-brand mt-0.5">terminal</mat-icon>
              <div>
                <div class="text-xs font-semibold text-ink">
                  {{ 'install.wizard.runDevTitle' | transloco }}
                </div>
                <div class="text-xs text-muted">
                  {{ 'install.wizard.runDevHint' | transloco }}
                </div>
              </div>
            </div>

            <div class="flex items-start gap-3 rounded-xl border border-app-border bg-panel p-3.5">
              <mat-icon class="text-brand mt-0.5">open_in_browser</mat-icon>
              <div>
                <div class="text-xs font-semibold text-ink">
                  {{ 'install.wizard.openLocalTitle' | transloco }}
                </div>
                <div class="text-xs text-muted">
                  {{ 'install.wizard.openLocalHint' | transloco }}
                </div>
              </div>
            </div>

            <div class="flex items-start gap-3 rounded-xl border border-app-border bg-panel p-3.5">
              <mat-icon class="text-brand mt-0.5">push_pin</mat-icon>
              <div>
                <div class="text-xs font-semibold text-ink">
                  {{ 'install.wizard.spotWidgetTitle' | transloco }}
                </div>
                <div class="text-xs text-muted">
                  {{ 'install.wizard.spotWidgetHint' | transloco }}
                </div>
              </div>
            </div>

            <div class="flex items-start gap-3 rounded-xl border border-app-border bg-panel p-3.5">
              <mat-icon class="text-brand mt-0.5">chat_bubble</mat-icon>
              <div>
                <div class="text-xs font-semibold text-ink">
                  {{ 'install.wizard.dropCommentTitle' | transloco }}
                </div>
                <div class="text-xs text-muted">
                  {{ 'install.wizard.dropCommentHint' | transloco }}
                </div>
              </div>
            </div>
          </div>

          <!-- Connection Ping Tool -->
          <div class="rounded-xl border border-app-border bg-panel p-4">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-semibold text-ink">
                {{ 'install.wizard.checkConnection' | transloco }}
              </span>
              <button
                mat-stroked-button
                class="border-app-border !text-xs"
                type="button"
                [disabled]="connectionStatus() === 'checking'"
                (click)="verifyLocalConnection()"
              >
                <mat-icon [class.animate-spin]="connectionStatus() === 'checking'">refresh</mat-icon>
                {{
                  (connectionStatus() === 'checking'
                    ? 'install.wizard.checking'
                    : 'common.refresh') | transloco
                }}
              </button>
            </div>

            @if (connectionStatus() === 'active') {
              <div class="mt-2.5 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                <mat-icon class="!text-base">check_circle</mat-icon>
                <span>{{ 'install.wizard.connectionActive' | transloco }}</span>
              </div>
            }

            @if (connectionStatus() === 'inactive') {
              <div class="mt-2.5 flex items-center gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
                <mat-icon class="!text-base">info</mat-icon>
                <span>{{ 'install.wizard.connectionInactive' | transloco }}</span>
              </div>
            }
          </div>

          <!-- Celebratory Card if comments or connection confirmed -->
          @if (connectionStatus() === 'active' || hasCollectedComments()) {
            <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <mat-icon>celebration</mat-icon>
                <span class="text-sm font-bold">{{ 'install.wizard.celebrationTitle' | transloco }}</span>
              </div>
              <p class="mt-1 text-xs text-muted">
                {{ 'install.wizard.celebrationDesc' | transloco }}
              </p>
              <div class="mt-3">
                <a
                  mat-flat-button
                  color="primary"
                  routerLink="/projects"
                  (click)="closeDialog()"
                >
                  {{ 'install.wizard.viewComments' | transloco }}
                </a>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Wizard Navigation Footer -->
    <div class="flex items-center justify-between border-t border-app-border px-6 py-3.5">
      <mat-checkbox [checked]="suppressed()" (change)="setSuppressed($event.checked)">
        <span class="text-xs text-muted">{{ 'install.dontShowAgain' | transloco }}</span>
      </mat-checkbox>

      <div class="flex items-center gap-2">
        @if (currentStep() !== 'project') {
          <button mat-button type="button" (click)="goPrev()">
            {{ 'install.wizard.back' | transloco }}
          </button>
        }
        @if (currentStep() !== 'verify') {
          <button mat-flat-button color="primary" type="button" (click)="goNext()">
            {{ 'install.wizard.next' | transloco }}
          </button>
        } @else {
          <button mat-flat-button color="primary" type="button" (click)="closeDialog()">
            {{ 'install.wizard.finish' | transloco }}
          </button>
        }
      </div>
    </div>
  `,
})
export class InstallGuideComponent {
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private auth = inject(AuthService);
  private guide = inject(InstallGuideService);
  private projectsService = inject(ProjectsService);
  private router = inject(Router);
  private dialogRef = inject(MatDialogRef<InstallGuideComponent>, { optional: true });

  private readonly apiKeyResource = getApiMeApiKeyResource();
  private translationEvents = toSignal(this.transloco.events$, { initialValue: null });

  readonly demo = signal<DemoSession | null>(this.readDemoSession());
  readonly projects = computed(() => this.guide.projects().filter((p) => p.key));

  readonly projectKey = signal<string | null>(
    this.readDemoSession()?.projectKey ?? null,
  );

  readonly suppressed = signal(this.guide.isSuppressed(this.auth.user()?.id ?? null));

  // Wizard state
  readonly currentStep = signal<WizardStep>('project');
  readonly selectedMethod = signal<InstallMethod>('agent');
  readonly selectedStack = signal<FrameworkStack>('html');
  readonly connectionStatus = signal<ConnectionStatus>('idle');

  // Inline project creation
  readonly newProjectName = signal('');
  readonly newProjectKey = signal('');
  readonly isCreatingProject = signal(false);
  readonly createError = signal<string | null>(null);

  readonly wizardSteps: { key: WizardStep; labelKey: string }[] = [
    { key: 'project', labelKey: 'install.wizard.stepProject' },
    { key: 'method', labelKey: 'install.wizard.stepMethod' },
    { key: 'install', labelKey: 'install.wizard.stepInstall' },
    { key: 'verify', labelKey: 'install.wizard.stepVerify' },
  ];

  readonly stackTabs: { stack: FrameworkStack; labelKey: string }[] = [
    { stack: 'html', labelKey: 'install.wizard.stackHtml' },
    { stack: 'react', labelKey: 'install.wizard.stackReact' },
    { stack: 'vue', labelKey: 'install.wizard.stackVue' },
    { stack: 'angular', labelKey: 'install.wizard.stackAngular' },
  ];

  readonly serverUrl = computed(() => this.demo()?.serverUrl || environment.apiBase);

  readonly effectiveProjectKey = computed(() => {
    return this.projectKey() ?? this.projects()[0]?.key ?? PROJECT_KEY_PLACEHOLDER;
  });

  readonly hasCollectedComments = computed(() => {
    const key = this.effectiveProjectKey();
    const p = this.projects().find((proj) => proj.key === key);
    return (p?.commentsCount ?? 0) > 0;
  });

  private readonly stepsInput = () => ({
    server: this.serverUrl(),
    userEmail: this.auth.user()?.email ?? null,
    apiKey: this.apiKeyResource.value()?.apiKey ?? null,
    demo: this.demo(),
    credsEmailedText: this.translatedCredsEmailed(),
  });

  readonly steps = computed(() =>
    buildSteps({
      ...this.stepsInput(),
      projectKey: this.effectiveProjectKey(),
    }),
  );

  readonly extensionSteps = computed(() => buildExtensionSteps(this.stepsInput()));

  readonly credentials = computed(() => credentialsSnippet(this.stepsInput()));

  readonly agentPrompt = computed(() => {
    return `Add the Pointer feedback widget to this app using the pointer-init skill — project key: ${this.effectiveProjectKey()}, Pointer server URL: ${this.serverUrl()}, environment: local`;
  });

  readonly stackSnippets = computed<Record<FrameworkStack, string>>(() => {
    const server = this.serverUrl();
    const key = this.effectiveProjectKey();
    return {
      html: `<!-- Add before </body> or inside <head> -->\n<script src="${server}/pointer.js" defer></script>\n<pointer-feedback project="${key}" server="${server}"></pointer-feedback>`,
      react: `// In Next.js (app/layout.tsx):\nimport Script from 'next/script';\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        <Script src="${server}/pointer.js" strategy="afterInteractive" />\n        <pointer-feedback project="${key}" server="${server}" />\n      </body>\n    </html>\n  );\n}`,
      vue: `<!-- In Nuxt (app.vue) or Vue App -->\n<template>\n  <div>\n    <NuxtPage />\n    <pointer-feedback project="${key}" server="${server}"></pointer-feedback>\n  </div>\n</template>\n\n<script setup>\nuseHead({\n  script: [{ src: '${server}/pointer.js', defer: true }]\n});\n</script>`,
      angular: `<!-- In src/index.html -->\n<script src="${server}/pointer.js" defer></script>\n<pointer-feedback project="${key}" server="${server}"></pointer-feedback>`,
    };
  });

  readonly currentStackSnippet = computed(() => this.stackSnippets()[this.selectedStack()]);

  private readonly translatedCredsEmailed = computed(() => {
    this.translationEvents();
    return this.transloco.translate('demo.credsEmailed');
  });

  // Legacy tab signal compatibility for specs/external consumers
  readonly tab = signal<'code' | 'extension'>('code');

  constructor() {
    this.guide.markShown(this.auth.user()?.id ?? null);

    effect(() => {
      const t = this.tab();
      if (t === 'extension') {
        this.currentStep.set('install');
        this.selectedMethod.set('extension');
      }
    });
  }

  canNavigateToStep(target: WizardStep): boolean {
    const order: WizardStep[] = ['project', 'method', 'install', 'verify'];
    const currentIndex = order.indexOf(this.currentStep());
    const targetIndex = order.indexOf(target);
    return targetIndex <= currentIndex;
  }

  goNext(): void {
    const order: WizardStep[] = ['project', 'method', 'install', 'verify'];
    const idx = order.indexOf(this.currentStep());
    if (idx < order.length - 1) {
      this.currentStep.set(order[idx + 1]);
    }
  }

  goPrev(): void {
    const order: WizardStep[] = ['project', 'method', 'install', 'verify'];
    const idx = order.indexOf(this.currentStep());
    if (idx > 0) {
      this.currentStep.set(order[idx - 1]);
    }
  }

  onProjectNameChanged(name: string): void {
    this.newProjectName.set(name);
    this.newProjectKey.set(slugifyKey(name));
  }

  createFirstProject(): void {
    const name = this.newProjectName().trim();
    const key = this.newProjectKey().trim();
    if (!name || !key) return;

    this.isCreatingProject.set(true);
    this.createError.set(null);

    this.projectsService.postApiAdminProjects({ name, key }).subscribe({
      next: (project) => {
        this.isCreatingProject.set(false);
        this.projectKey.set(project.key ?? key);
        this.guide.projectsResource.reload();
        this.goNext();
      },
      error: (err) => {
        this.isCreatingProject.set(false);
        this.createError.set(err?.error?.message || 'Failed to create project');
      },
    });
  }

  async verifyLocalConnection(): Promise<void> {
    this.connectionStatus.set('checking');
    const active = await checkLocalhostWidgetStatus(this.serverUrl(), this.effectiveProjectKey());
    this.connectionStatus.set(active ? 'active' : 'inactive');
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

  closeDialog(): void {
    this.dialogRef?.close();
  }

  private readDemoSession(): DemoSession | null {
    try {
      return JSON.parse(sessionStorage.getItem(DEMO_SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }
}
