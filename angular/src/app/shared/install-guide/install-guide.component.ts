import {
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  getApiMeApiKeyResource,
  ProjectsService,
} from '@moamen-ui/pointer-angular';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { AppToastService } from '../ui/app-toast.service';
import { AppButtonDirective } from '../ui/app-button.directive';
import { AppInputDirective } from '../ui/app-input.directive';
import { AppSelectComponent, type SelectOption } from '../ui/app-select.component';
import { AppFormFieldComponent } from '../ui/app-form-field.component';
import { AppCheckboxComponent } from '../ui/app-checkbox.component';
import { AppIconComponent } from '../ui/app-icon.component';
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

export function initCommand(i: { server: string; apiKey: string | null; projectKey: string | null; environment?: 'local'|'staging'|'production' }): string {
  const parts = ['npx -y pointer-feedback init', `--server ${i.server}`];
  if (i.apiKey) parts.push(`--key ${i.apiKey}`);
  if (i.projectKey) parts.push(`--project ${i.projectKey}`);
  if (i.environment) parts.push(`--environment ${i.environment}`);
  return parts.join(' ');
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

  const primary: SetupStep[] = [
    { titleKey: 'install.stepInitTitle', hintKey: 'install.stepInitHint', code: initCommand({ server, apiKey: input.apiKey, projectKey: input.projectKey !== PROJECT_KEY_PLACEHOLDER ? input.projectKey : null }) },
  ];

  if (!input.apiKey && demo) {
    primary.push({ titleKey: 'demo.step4Title', hintKey: 'demo.step4Hint', code: credentials });
  }

  primary.push(
    {
      titleKey: 'install.stepAgentTitle',
      hintKey: 'install.stepAgentHint',
      code: `Add the Pointer feedback widget to this app using the pointer-init skill — project key: ${projectKey}, Pointer server URL: ${server}, environment: local`,
    },
    { titleKey: 'demo.step5Title', hintKey: 'demo.step5Hint' },
    { titleKey: 'demo.step6Title', hintKey: 'demo.step6Hint', code: 'What are the new Pointer comments?' }
  );

  return {
    primary,
    manual: [
      { titleKey: 'demo.step1Title', hintKey: 'demo.step1Hint', code: `<script src="${server}/pointer.js" defer></script>` },
      { titleKey: 'demo.step2Title', hintKey: 'demo.step2Hint', code: `<pointer-feedback project="${projectKey}" server="${server}"></pointer-feedback>` },
      { titleKey: 'install.stepCurlTitle', hintKey: 'install.stepCurlHint', code: `curl -fsSL ${server}/install.sh | sh` }
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
    FormsModule,
    RouterLink,
    TranslocoModule,
    AppButtonDirective,
    AppInputDirective,
    AppSelectComponent,
    AppFormFieldComponent,
    AppCheckboxComponent,
    AppIconComponent,
  ],
  template: `
    <div class="flex items-center justify-between border-b border-border px-5 pt-5 pb-3">
      <h2 class="m-0 flex items-center gap-2 text-base font-semibold text-foreground">
        <app-icon name="rocket" [size]="20" class="text-brand"></app-icon>
        {{ 'install.title' | transloco }}
      </h2>
      <button appButton variant="ghost" size="icon" type="button" (click)="closeDialog()">
        <app-icon name="x" [size]="16"></app-icon>
      </button>
    </div>

    <div class="max-h-[calc(88vh-140px)] overflow-y-auto px-5 py-4 space-y-4">
      <!-- Underline tabs stepper -->
      <div class="h-9 flex gap-4 border-b border-border -mx-5 px-5 overflow-x-auto">
        @for (step of wizardSteps; track step.key) {
          <button
            type="button"
            (click)="canNavigateToStep(step.key) && currentStep.set(step.key)"
            [class.text-foreground]="currentStep() === step.key"
            [class.text-muted-foreground]="currentStep() !== step.key"
            [class.font-medium]="currentStep() === step.key"
            [class.border-brand]="currentStep() === step.key"
            [class.border-transparent]="currentStep() !== step.key"
            class="pb-2 border-b-2 -mb-px text-[14px] transition-colors hover:text-foreground whitespace-nowrap"
          >
            {{ step.labelKey | transloco }}
          </button>
        }
      </div>

      <!-- ========================================================================= -->
      <!-- STEP 1: PROJECT SETUP                                                     -->
      <!-- ========================================================================= -->
      @if (currentStep() === 'project') {
        <div class="flex flex-col gap-4">
          <div>
            <h3 class="text-[16px] font-semibold leading-6">
              {{ 'install.wizard.createProjectTitle' | transloco }}
            </h3>
            <p class="mt-1 text-[14px] text-muted-foreground">
              {{ 'install.wizard.createProjectDesc' | transloco }}
            </p>
          </div>

          @if (projects().length > 0 && !isCreatingInline()) {
            <div class="rounded-md border border-border bg-background p-4">
              <app-form-field label="{{ 'install.project' | transloco }}">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div class="flex-1">
                    <app-select
                      [options]="(projectSelectOptions() || [])"
                      [value]="effectiveProjectKey()"
                      (valueChange)="projectKey.set($event)"
                    ></app-select>
                  </div>
                  @if (auth.isAdmin() && !auth.isSuperAdmin()) {
                    <button appButton variant="secondary" size="sm" type="button" class="shrink-0" (click)="isCreatingInline.set(true)">
                      <app-icon name="folder-plus" [size]="16"></app-icon>
                      {{ 'install.wizard.createNewProject' | transloco }}
                    </button>
                  }
                </div>
              </app-form-field>
            </div>
          } @else {
            <div class="rounded-md border border-border bg-background p-4 space-y-4">
              <p class="text-[14px] text-muted-foreground">
                {{ 'install.noProjects' | transloco }}
              </p>
              <app-form-field label="{{ 'install.wizard.projectName' | transloco }}">
                <input
                  appInput
                  [ngModel]="newProjectName()"
                  (ngModelChange)="onProjectNameChanged($event)"
                  placeholder="e.g. Acme Website"
                  type="text"
                />
              </app-form-field>

              <app-form-field label="{{ 'install.wizard.projectKey' | transloco }}">
                <input
                  appInput
                  [ngModel]="newProjectKey()"
                  (ngModelChange)="newProjectKey.set($event)"
                  placeholder="acme-website"
                  type="text"
                />
              </app-form-field>

              @if (createError()) {
                <p class="text-[12px] text-state-danger flex items-center gap-1">
                  <app-icon name="circle-alert" [size]="12"></app-icon>
                  {{ createError() }}
                </p>
              }

              <div class="flex items-center justify-between">
                @if (projects().length > 0) {
                  <button appButton variant="ghost" size="sm" type="button" (click)="isCreatingInline.set(false)">
                    {{ 'install.wizard.back' | transloco }}
                  </button>
                } @else {
                  <span></span>
                }
                <button
                  appButton
                  variant="primary"
                  type="button"
                  [disabled]="!newProjectName().trim() || !newProjectKey().trim() || isCreatingProject()"
                  (click)="createFirstProject()"
                >
                  @if (isCreatingProject()) {
                    {{ 'install.wizard.creating' | transloco }}
                  } @else {
                    {{ 'install.wizard.createAndContinue' | transloco }}
                  }
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- ========================================================================= -->
      <!-- STEP 2: CHOOSE METHOD                                                     -->
      <!-- ========================================================================= -->
      @if (currentStep() === 'method') {
        <div class="flex flex-col gap-4">
          <div>
            <h3 class="text-[16px] font-semibold leading-6">
              {{ 'install.wizard.methodTitle' | transloco }}
            </h3>
            <p class="mt-1 text-[14px] text-muted-foreground">
              {{ 'install.wizard.methodDesc' | transloco }}
            </p>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <!-- AI Agent Card -->
            <button
              type="button"
              class="relative flex flex-col items-start gap-2 rounded-md border p-4 text-start transition-all hover:border-brand"
              [class.border-brand]="selectedMethod() === 'agent'"
              [class.bg-brand-tint]="selectedMethod() === 'agent'"
              [class.border-border]="selectedMethod() !== 'agent'"
              [class.bg-background]="selectedMethod() !== 'agent'"
              (click)="selectedMethod.set('agent')"
            >
              <span class="absolute top-2 end-2 rounded-full px-2 py-0.5 text-[0.65rem] font-bold text-brand bg-brand-tint border border-brand/30">
                {{ 'install.wizard.methodAgentBadge' | transloco }}
              </span>
              <div class="flex h-8 w-8 items-center justify-center rounded-md bg-brand-tint text-brand">
                <app-icon name="bot" [size]="16"></app-icon>
              </div>
              <h4 class="text-[14px] font-medium text-foreground">
                {{ 'install.wizard.methodAgentTitle' | transloco }}
              </h4>
              <p class="m-0 text-[13px] leading-5 text-muted-foreground">
                {{ 'install.wizard.methodAgentDesc' | transloco }}
              </p>
            </button>

            <!-- Code Snippet Card -->
            <button
              type="button"
              class="flex flex-col items-start gap-2 rounded-md border p-4 text-start transition-all hover:border-brand"
              [class.border-brand]="selectedMethod() === 'snippet'"
              [class.bg-brand-tint]="selectedMethod() === 'snippet'"
              [class.border-border]="selectedMethod() !== 'snippet'"
              [class.bg-background]="selectedMethod() !== 'snippet'"
              (click)="selectedMethod.set('snippet')"
            >
              <div class="flex h-8 w-8 items-center justify-center rounded-md bg-brand-tint text-brand">
                <app-icon name="pencil" [size]="16"></app-icon>
              </div>
              <h4 class="text-[14px] font-medium text-foreground">
                {{ 'install.wizard.methodSnippetTitle' | transloco }}
              </h4>
              <p class="m-0 text-[13px] leading-5 text-muted-foreground">
                {{ 'install.wizard.methodSnippetDesc' | transloco }}
              </p>
            </button>

            <!-- Extension Card -->
            <button
              type="button"
              class="flex flex-col items-start gap-2 rounded-md border p-4 text-start transition-all hover:border-brand"
              [class.border-brand]="selectedMethod() === 'extension'"
              [class.bg-brand-tint]="selectedMethod() === 'extension'"
              [class.border-border]="selectedMethod() !== 'extension'"
              [class.bg-background]="selectedMethod() !== 'extension'"
              (click)="selectedMethod.set('extension')"
            >
              <div class="flex h-8 w-8 items-center justify-center rounded-md bg-brand-tint text-brand">
                <app-icon name="globe" [size]="16"></app-icon>
              </div>
              <h4 class="text-[14px] font-medium text-foreground">
                {{ 'install.wizard.methodExtTitle' | transloco }}
              </h4>
              <p class="m-0 text-[13px] leading-5 text-muted-foreground">
                {{ 'install.wizard.methodExtDesc' | transloco }}
              </p>
            </button>
          </div>
        </div>
      }

      <!-- ========================================================================= -->
      <!-- STEP 3: ADD CODE TO PROJECT                                               -->
      <!-- ========================================================================= -->
      @if (currentStep() === 'install') {
        <div class="flex flex-col gap-4">
          <!-- AI Agent Mode -->
          @if (selectedMethod() === 'agent') {
            <div class="flex flex-col gap-4">
              <div class="space-y-2">
                <div class="text-[13px] font-medium text-foreground">
                  {{ 'install.stepInitTitle' | transloco }}
                </div>
                <div class="text-[12px] text-muted-foreground">
                  {{ initHintKey() | transloco }}
                </div>
                <div class="relative rounded-md border border-border bg-gutter font-mono text-[13px] p-3 pe-24 overflow-x-auto">
                  <pre class="m-0"><code>{{ maskedInitCommandSnippet() }}</code></pre>
                  
                  <div class="absolute top-3 end-3 flex gap-1">
                    @if (apiKeyResource.value()?.apiKey) {
                      <button
                        appButton
                        variant="ghost"
                        size="sm"
                        type="button"
                        (click)="revealKey.set(!revealKey())"
                        class="text-muted-foreground hover:text-foreground"
                      >
                        {{ revealKey() ? ('install.wizard.hide' | transloco) : ('install.wizard.reveal' | transloco) }}
                      </button>
                    }
                    <button
                      appButton
                      variant="ghost"
                      size="sm"
                      type="button"
                      (click)="copy(initCommandSnippet())"
                    >
                      <app-icon name="copy" [size]="16"></app-icon>
                    </button>
                  </div>
                </div>
                
                <div class="mt-4 border-t border-border pt-3">
                  <button type="button" class="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1" (click)="showCurl.set(!showCurl())">
                    <app-icon [name]="showCurl() ? 'chevron-down' : 'chevron-right'" [size]="14"></app-icon>
                    {{ 'install.stepCurlTitle' | transloco }}
                  </button>
                  
                  @if (showCurl()) {
                    <div class="mt-2 space-y-2">
                      <div class="text-[12px] text-muted-foreground">
                        {{ 'install.stepCurlHint' | transloco }}
                      </div>
                      <div class="relative rounded-md border border-border bg-gutter font-mono text-[13px] p-3 pe-12 overflow-x-auto">
                        <pre class="m-0"><code>curl -fsSL {{ serverUrl() }}/install.sh | sh</code></pre>
                        <button appButton variant="ghost" size="sm" type="button" (click)="copy('curl -fsSL ' + serverUrl() + '/install.sh | sh')" class="absolute top-3 end-3">
                          <app-icon name="copy" [size]="16"></app-icon>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div class="space-y-2">
                <div class="text-[13px] font-medium text-foreground">
                  {{ 'install.wizard.credsTitle' | transloco }}
                </div>
                <div class="text-[12px] text-muted-foreground">
                  {{ 'install.wizard.credsHint' | transloco }}
                </div>
                <div class="relative rounded-md border border-border bg-gutter font-mono text-[13px] p-3 pe-12 overflow-x-auto">
                  <pre class="m-0"><code>{{ credentials() }}</code></pre>
                  <button
                    appButton
                    variant="ghost"
                    size="sm"
                    type="button"
                    (click)="copy(credentials())"
                    class="absolute top-3 end-3"
                  >
                    <app-icon name="copy" [size]="16"></app-icon>
                  </button>
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                  <app-icon name="bot" [size]="16" class="text-brand"></app-icon>
                  {{ 'install.wizard.agentPromptTitle' | transloco }}
                </div>
                <div class="text-[12px] text-muted-foreground">
                  {{ 'install.wizard.agentPromptHint' | transloco }}
                </div>
                <div class="relative rounded-md border border-border bg-gutter font-mono text-[13px] p-3 pe-12 overflow-x-auto whitespace-pre-wrap">
                  <pre class="m-0"><code>{{ agentPrompt() }}</code></pre>
                  <button
                    appButton
                    variant="ghost"
                    size="sm"
                    type="button"
                    (click)="copy(agentPrompt())"
                    class="absolute top-3 end-3"
                  >
                    <app-icon name="copy" [size]="16"></app-icon>
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Code Snippet Mode -->
          @if (selectedMethod() === 'snippet') {
            <div class="flex flex-col gap-3">
              <div class="text-[12px] text-muted-foreground">
                {{ 'install.wizard.snippetInstructions' | transloco }}
              </div>

              <div class="h-9 flex gap-2 border-b border-border -mx-5 px-5">
                @for (tab of stackTabs; track tab.stack) {
                  <button
                    type="button"
                    [class.text-foreground]="selectedStack() === tab.stack"
                    [class.text-muted-foreground]="selectedStack() !== tab.stack"
                    [class.font-medium]="selectedStack() === tab.stack"
                    [class.border-brand]="selectedStack() === tab.stack"
                    [class.border-transparent]="selectedStack() !== tab.stack"
                    class="pb-2 border-b-2 -mb-px text-[14px] transition-colors hover:text-foreground whitespace-nowrap"
                    (click)="selectedStack.set(tab.stack)"
                  >
                    {{ tab.labelKey | transloco }}
                  </button>
                }
              </div>

              <div class="relative rounded-md border border-border bg-gutter font-mono text-[13px] p-3 pe-12 overflow-x-auto whitespace-pre-wrap">
                <pre class="m-0"><code>{{ currentStackSnippet() }}</code></pre>
                <button
                  appButton
                  variant="ghost"
                  size="sm"
                  type="button"
                  (click)="copy(currentStackSnippet())"
                  class="absolute top-3 end-3"
                >
                  <app-icon name="copy" [size]="16"></app-icon>
                </button>
              </div>
            </div>
          }

          <!-- Extension Mode -->
          @if (selectedMethod() === 'extension') {
            <ol class="m-0 flex list-none flex-col gap-3 p-0">
              @for (st of extensionSteps(); track st.titleKey; let i = $index) {
                <li class="rounded-md border border-border bg-background p-4 space-y-2">
                  <div class="text-[13px] font-medium text-foreground">
                    {{ i + 1 }}. {{ st.titleKey | transloco }}
                  </div>
                  <div class="text-[12px] text-muted-foreground">{{ st.hintKey | transloco }}</div>
                  @if (st.downloadUrl; as url) {
                    <a appButton variant="primary" size="sm" class="inline-flex mt-2" [href]="url" download>
                      <app-icon name="download" [size]="16"></app-icon>
                      {{ 'install.extDownload' | transloco }}
                    </a>
                  } @else if (st.code; as code) {
                    <div class="relative rounded-md border border-border bg-gutter font-mono text-[13px] p-3 overflow-x-auto whitespace-pre-wrap mt-2">
                      <pre class="m-0"><code>{{ code }}</code></pre>
                      <button
                        appButton
                        variant="ghost"
                        size="sm"
                        type="button"
                        (click)="copy(code)"
                        class="absolute top-3 end-3"
                      >
                        <app-icon name="copy" [size]="16"></app-icon>
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
      <!-- STEP 4: LAUNCH & SEE IT LIVE!                                             -->
      <!-- ========================================================================= -->
      @if (currentStep() === 'verify') {
        <div class="flex flex-col gap-4">
          <div>
            <h3 class="text-[16px] font-semibold leading-6">
              {{ 'install.wizard.step4Title' | transloco }}
            </h3>
            <p class="mt-1 text-[14px] text-muted-foreground">
              {{ 'install.wizard.step4Hint' | transloco }}
            </p>
          </div>

          <!-- 4-step checklist -->
          <div class="flex flex-col gap-2.5">
            <div class="flex items-start gap-3 rounded-md border border-border bg-background p-3">
              <app-icon name="wrench" [size]="16" class="text-brand mt-0.5 flex-shrink-0"></app-icon>
              <div>
                <div class="text-[13px] font-medium text-foreground">
                  {{ 'install.wizard.runDevTitle' | transloco }}
                </div>
                <div class="text-[12px] text-muted-foreground">
                  {{ 'install.wizard.runDevHint' | transloco }}
                </div>
              </div>
            </div>

            <div class="flex items-start gap-3 rounded-md border border-border bg-background p-3">
              <app-icon name="external-link" [size]="16" class="text-brand mt-0.5 flex-shrink-0"></app-icon>
              <div>
                <div class="text-[13px] font-medium text-foreground">
                  {{ 'install.wizard.openLocalTitle' | transloco }}
                </div>
                <div class="text-[12px] text-muted-foreground">
                  {{ 'install.wizard.openLocalHint' | transloco }}
                </div>
              </div>
            </div>

            <div class="flex items-start gap-3 rounded-md border border-border bg-background p-3">
              <app-icon name="pin" [size]="16" class="text-brand mt-0.5 flex-shrink-0"></app-icon>
              <div>
                <div class="text-[13px] font-medium text-foreground">
                  {{ 'install.wizard.spotWidgetTitle' | transloco }}
                </div>
                <div class="text-[12px] text-muted-foreground">
                  {{ 'install.wizard.spotWidgetHint' | transloco }}
                </div>
              </div>
            </div>

            <div class="flex items-start gap-3 rounded-md border border-border bg-background p-3">
              <app-icon name="message-square" [size]="16" class="text-brand mt-0.5 flex-shrink-0"></app-icon>
              <div>
                <div class="text-[13px] font-medium text-foreground">
                  {{ 'install.wizard.dropCommentTitle' | transloco }}
                </div>
                <div class="text-[12px] text-muted-foreground">
                  {{ 'install.wizard.dropCommentHint' | transloco }}
                </div>
              </div>
            </div>
          </div>

          <!-- Connection Ping Tool -->
          <div class="rounded-md border border-border bg-background p-4">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[13px] font-medium text-foreground">
                {{ 'install.wizard.checkConnection' | transloco }}
              </span>
              <button
                appButton
                variant="secondary"
                size="sm"
                type="button"
                [disabled]="connectionStatus() === 'checking'"
                (click)="verifyLocalConnection()"
              >
                <app-icon
                  name="refresh-cw"
                  [size]="14"
                  [class.animate-spin]="connectionStatus() === 'checking'"
                ></app-icon>
                {{
                  (connectionStatus() === 'checking'
                    ? 'install.wizard.checking'
                    : 'common.refresh') | transloco
                }}
              </button>
            </div>

            @if (connectionStatus() === 'active') {
              <div class="mt-2.5 flex items-center gap-2 rounded-md bg-state-completed-tint p-2 text-[12px] text-state-completed font-medium">
                <app-icon name="circle-check" [size]="14"></app-icon>
                <span>{{ 'install.wizard.connectionActive' | transloco }}</span>
              </div>
            }

            @if (connectionStatus() === 'inactive') {
              <div class="mt-2.5 flex items-center gap-2 rounded-md bg-state-ready-tint p-2 text-[12px] text-state-ready font-medium">
                <app-icon name="circle-alert" [size]="14"></app-icon>
                <span>{{ 'install.wizard.connectionInactive' | transloco }}</span>
              </div>
            }
          </div>

          <!-- Celebratory Card if comments or connection confirmed -->
          @if (connectionStatus() === 'active' || hasCollectedComments()) {
            <div class="rounded-md border border-brand/30 bg-brand-tint p-4">
              <div class="flex items-start gap-3">
                <app-icon name="sparkles" [size]="20" class="text-brand mt-0.5 shrink-0"></app-icon>
                <div>
                  <div class="text-[14px] font-medium text-foreground">
                    {{ 'install.wizard.celebrationTitle' | transloco }}
                  </div>
                  <p class="mt-1 text-[12px] text-muted-foreground">
                    {{ 'install.wizard.celebrationDesc' | transloco }}
                  </p>
                  <button
                    appButton
                    variant="primary"
                    size="sm"
                    routerLink="/projects"
                    (click)="closeDialog()"
                    class="mt-3"
                  >
                    {{ 'install.wizard.viewComments' | transloco }}
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Footer -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 pb-5 pt-3">
      <!-- React/Vue expose "don't show again" on the final step only; keep the three in step. -->
      @if (currentStep() === 'verify') {
        <label class="flex cursor-pointer items-center gap-2">
          <app-checkbox
            [checked]="suppressed()"
            (checkedChange)="setSuppressed($event)"
          ></app-checkbox>
          <span class="text-[14px] text-muted-foreground">{{ 'install.dontShowAgain' | transloco }}</span>
        </label>
      } @else {
        <span></span>
      }

      <div class="flex items-center gap-2">
        @if (currentStep() !== 'project') {
          <button appButton variant="secondary" size="sm" type="button" (click)="goPrev()">
            {{ 'install.wizard.back' | transloco }}
          </button>
        }
        @if (currentStep() !== 'verify') {
          <button appButton variant="primary" size="sm" type="button" (click)="goNext()">
            {{ 'install.wizard.next' | transloco }}
          </button>
        } @else {
          <button appButton variant="primary" size="sm" type="button" (click)="closeDialog()">
            {{ 'install.wizard.finish' | transloco }}
          </button>
        }
      </div>
    </div>
  `,
})
export class InstallGuideComponent {
  private toast = inject(AppToastService);
  private transloco = inject(TranslocoService);
  readonly auth = inject(AuthService);
  private guide = inject(InstallGuideService);
  private projectsService = inject(ProjectsService);
  private router = inject(Router);

  readonly apiKeyResource = getApiMeApiKeyResource();
  private translationEvents = toSignal(this.transloco.events$, { initialValue: null });

  readonly demo = signal<DemoSession | null>(this.readDemoSession());
  readonly projects = computed(() => this.guide.projects().filter((p) => p.key));

  readonly projectKey = signal<string | null>(
    this.readDemoSession()?.projectKey ?? null,
  );

  /** Step 1 shows the picker by default; this switches to the inline create form. */
  readonly isCreatingInline = signal(false);

  readonly initHintKey = computed(() => this.apiKeyResource.value()?.apiKey ? 'install.stepInitHint' : 'install.stepInitHintNoKey');
  readonly revealKey = signal(false);
  readonly showCurl = signal(false);
  
  readonly initCommandSnippet = computed(() => initCommand({ 
    server: this.serverUrl(), 
    apiKey: this.apiKeyResource.value()?.apiKey ?? null, 
    projectKey: this.effectiveProjectKey() !== PROJECT_KEY_PLACEHOLDER ? this.effectiveProjectKey() : null 
  }));
  
  readonly maskedInitCommandSnippet = computed(() => {
    const cmd = this.initCommandSnippet();
    const key = this.apiKeyResource.value()?.apiKey;
    if (!key || this.revealKey()) return cmd;
    return cmd.replace(key, 'ptr_••••••••');
  });

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

  readonly projectSelectOptions = computed<SelectOption<string>[]>(() => {
    return this.projects().map((p) => ({
      label: `${p.name} (${p.key})`,
      value: p.key!,
    }));
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
      () => this.toast.show(this.transloco.translate('demo.copied'), 'success'),
      () => this.toast.show(this.transloco.translate('demo.copyFailed'), 'danger'),
    );
  }

  closeDialog(): void {
    // Emitter to the dialog service will close
    window.dispatchEvent(new CustomEvent('closeInstallGuide'));
  }

  private readDemoSession(): DemoSession | null {
    try {
      return JSON.parse(sessionStorage.getItem(DEMO_SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }
}
