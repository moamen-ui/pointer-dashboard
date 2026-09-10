<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  Rocket,
  Copy,
  Download,
  Bot,
  Code2,
  Chrome,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  PartyPopper,
  RefreshCw,
  FolderPlus,
  Laptop,
  ExternalLink,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import AppTabs from '@/components/shared/Tabs.vue';
import { useQueryClient } from '@tanstack/vue-query';
import {
  usePostApiAdminProjects,
  getGetApiAdminProjectsQueryKey,
  type ProjectResponse,
} from '@moamen-ui/pointer-vue';
import { useAuth } from '@/composables/useAuth';
import { toast } from '@/composables/useToast';
import { getDemoSession, type DemoSession } from '@/lib/demoSession';
import { slugifyKey, keyErrorFor } from '@/lib/projectUtils';
import {
  EXTENSION_ZIP_URL,
  checkLocalhostWidgetStatus,
  type WizardStep,
  type InstallMethod,
  type FrameworkStack,
} from './buildSteps';
import {
  isSuppressed,
  markShown,
  suppress,
  unsuppress,
  useInstallGuide,
} from './useInstallGuide';

const { t, locale } = useI18n();
const isRtl = computed(() => locale.value === 'ar');
const router = useRouter();
const queryClient = useQueryClient();
const { user, isAdmin } = useAuth();
const { guideOpen, projects: allProjects } = useInstallGuide();

const demo = ref<DemoSession | null>(getDemoSession());

const projects = computed(() =>
  allProjects.value.filter((p): p is ProjectResponse & { key: string } => !!p.key),
);

// Wizard State
const currentStep = ref<WizardStep>('project');
const selectedMethod = ref<InstallMethod>('agent');
const selectedStack = ref<FrameworkStack>('html');

// Project Selection / Inline Creation
const projectKey = ref<string | null>(demo.value?.projectKey ?? null);
const isCreatingInline = ref(false);
// True only while the operator explicitly asked for the create form, so the watcher below
// can undo the empty-list default without fighting them.
const createRequested = ref(false);
const newProjectName = ref('');
const newProjectKey = ref('');
const keyEdited = ref(false);

watch(
  projects,
  (list) => {
    if (!projectKey.value && list.length > 0) {
      projectKey.value = list[0]?.key ?? null;
    }
    // The first run sees an empty, still-loading list; without the else the create form
    // stayed latched even once projects arrived, so step 1 never showed the picker.
    if (list.length === 0) {
      isCreatingInline.value = true;
    } else if (!createRequested.value) {
      isCreatingInline.value = false;
    }
  },
  { immediate: true },
);

// Localhost Verification State
const checkStatus = ref<'idle' | 'checking' | 'active' | 'inactive'>('idle');
const suppressed = ref(isSuppressed(user.value?.id ?? null));

const server = demo.value?.serverUrl || import.meta.env.VITE_API_BASE;
const effectiveKey = computed(
  () => projectKey.value ?? projects.value[0]?.key ?? '<your-project-key>',
);

const keyError = computed(() =>
  keyErrorFor(newProjectKey.value, projects.value.map((p) => p.key)),
);
const canCreate = computed(() => !keyError.value && Boolean(newProjectName.value.trim()));

const createProjectMut = usePostApiAdminProjects({
  mutation: {
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: getGetApiAdminProjectsQueryKey() });
      projectKey.value = created.key ?? newProjectKey.value.trim();
      isCreatingInline.value = false;
      currentStep.value = 'method';
      toast(t('projects.saved'), 2000);
    },
    onError: () => {
      toast(t('common.error'), 3000);
    },
  },
});

function handleCreateInline() {
  if (!canCreate.value) return;
  createProjectMut.mutate({
    data: {
      name: newProjectName.value.trim(),
      key: newProjectKey.value.trim(),
    },
  });
}

function onNameInput(event: Event) {
  const val = (event.target as HTMLInputElement).value;
  newProjectName.value = val;
  if (!keyEdited.value) {
    newProjectKey.value = slugifyKey(val);
  }
}

function onKeyInput(event: Event) {
  keyEdited.value = true;
  newProjectKey.value = (event.target as HTMLInputElement).value.toLowerCase().trim();
}

async function handleVerifyLocalhost() {
  if (!projectKey.value) return;
  checkStatus.value = 'checking';
  const isActive = await checkLocalhostWidgetStatus(server, projectKey.value);
  checkStatus.value = isActive ? 'active' : 'inactive';
}

function setSuppressed(checked: boolean | 'indeterminate'): void {
  const value = checked === true;
  suppressed.value = value;
  const userId = user.value?.id ?? null;
  if (value) suppress(userId);
  else unsuppress(userId);
}

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(t('demo.copied'), 2000);
  } catch {
    toast(t('demo.copyFailed'), 3000);
  }
}

// Mark seen on open
watch(
  guideOpen,
  (openNow) => {
    if (openNow) markShown(user.value?.id ?? null);
  },
  { immediate: true },
);

onUnmounted(() => {
  guideOpen.value = false;
});

const stepsList = computed(() => [
  { id: 'project' as const, label: t('install.wizard.stepProject') },
  { id: 'method' as const, label: t('install.wizard.stepMethod') },
  { id: 'install' as const, label: t('install.wizard.stepInstall') },
  { id: 'verify' as const, label: t('install.wizard.stepVerify') },
]);

const currentStepIdx = computed(() =>
  stepsList.value.findIndex((s) => s.id === currentStep.value),
);

const agentPrompt = computed(
  () =>
    `Add the Pointer feedback widget to this app using the pointer-init skill — project key: ${effectiveKey.value}, Pointer server URL: ${server}, environment: local`,
);

const credentialsSnippet = computed(() =>
  demo.value
    ? demo.value.emailSent
      ? t('demo.credsEmailed')
      : `POINTER_EMAIL=${demo.value.email ?? ''}\nPOINTER_PASSWORD=${demo.value.password ?? ''}`
    : `POINTER_EMAIL=${user.value?.email ?? ''}\nPOINTER_PASSWORD=<your password>`,
);

const stackSnippets = computed<Record<FrameworkStack, string>>(() => ({
  html: `<!-- Add before </body> or inside <head> -->\n<script src="${server}/pointer.js" defer><\/script>\n<pointer-feedback project="${effectiveKey.value}" server="${server}"><\/pointer-feedback>`,
  react: `// In Next.js (app/layout.tsx):\nimport Script from 'next/script';\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        <Script src="${server}/pointer.js" strategy="afterInteractive" />\n        <pointer-feedback project="${effectiveKey.value}" server="${server}" />\n      </body>\n    </html>\n  );\n}`,
  vue: `<!-- In Nuxt (app.vue) or Vue App -->\n<template>\n  <div>\n    <NuxtPage />\n    <pointer-feedback project="${effectiveKey.value}" server="${server}"><\/pointer-feedback>\n  </div>\n<\/template>\n\n<script setup>\nuseHead({\n  script: [{ src: '${server}/pointer.js', defer: true }]\n});\n<\/script>`,
  angular: `<!-- In src/index.html -->\n<script src="${server}/pointer.js" defer><\/script>\n<pointer-feedback project="${effectiveKey.value}" server="${server}"><\/pointer-feedback>`,
}));
</script>

<template>
  <Dialog v-model:open="guideOpen">
    <DialogContent class="max-h-[88vh] max-w-2xl overflow-y-auto p-0">
      <!-- Header with Rocket Icon -->
      <DialogHeader class="border-b border-border px-5 pt-5 pb-3">
        <DialogTitle class="flex items-center gap-2 text-base font-semibold">
          <Rocket class="h-5 w-5 text-brand" />
          {{ t('install.title') }}
        </DialogTitle>
      </DialogHeader>

      <!-- Underline tabs stepper -->
      <div class="flex h-9 gap-4 overflow-x-auto border-b border-border px-5">
        <button
          v-for="(stepItem, idx) in stepsList"
          :key="stepItem.id"
          type="button"
          :disabled="!(idx <= currentStepIdx || (stepItem.id === 'method' && projectKey))"
          class="whitespace-nowrap text-[14px] pb-2 border-b-2 border-transparent -mb-px transition-colors"
          :class="[
            idx === currentStepIdx
              ? 'text-foreground border-brand font-medium'
              : 'text-muted-foreground hover:text-foreground'
          ]"
          @click="
            if (idx <= currentStepIdx || (stepItem.id === 'method' && projectKey)) {
              currentStep = stepItem.id;
            }
          "
        >
          {{ stepItem.label }}
        </button>
      </div>

      <!-- ========================================================================= -->
      <!-- STEP 1: PROJECT SETUP & INLINE CREATION                                   -->
      <!-- ========================================================================= -->
      <div v-if="currentStep === 'project'" class="flex flex-col gap-4 px-5 py-4">
        <div>
          <h3 class="text-sm font-semibold">{{ t('install.wizard.createProjectTitle') }}</h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ t('install.wizard.createProjectDesc') }}
          </p>
        </div>

        <div v-if="projects.length > 0 && !isCreatingInline" class="rounded-lg border border-border bg-background p-4">
          <label class="text-xs font-medium text-foreground">
            {{ t('install.wizard.selectProjectPrompt') }}
          </label>
          <div class="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div class="flex-1">
              <Select v-model="projectKey">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="p in projects" :key="p.key" :value="p.key">
                    {{ p.name }} ({{ p.key }})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              v-if="isAdmin"
              variant="secondary"
              size="sm"
              class="gap-1.5 shrink-0"
              @click="createRequested = true; isCreatingInline = true"
            >
              <FolderPlus class="h-4 w-4" />
              {{ t('install.wizard.createNewProject') }}
            </Button>
          </div>

          <div class="mt-4 flex justify-end">
            <Button
              :disabled="!projectKey"
              class="gap-1.5"
              @click="currentStep = 'method'"
            >
              <span>{{ t('install.wizard.next') }}</span>
              <ArrowLeft v-if="isRtl" class="h-4 w-4" />
              <ArrowRight v-else class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <!-- Inline Creation Form -->
        <div v-else class="rounded-lg border border-border bg-background p-4">
          <div class="flex flex-col gap-3">
            <div>
              <Label for="wiz-vue-name" class="text-xs">{{ t('install.wizard.projectName') }}</Label>
              <Input
                id="wiz-vue-name"
                :value="newProjectName"
                :placeholder="t('install.wizard.projectNamePlaceholder')"
                class="mt-1"
                autofocus
                @input="onNameInput"
              />
            </div>

            <div>
              <Label for="wiz-vue-key" class="text-xs">{{ t('install.wizard.projectKey') }}</Label>
              <Input
                id="wiz-vue-key"
                :value="newProjectKey"
                class="mt-1 font-mono text-xs"
                @input="onKeyInput"
              />
              <p class="mt-1 text-[0.7rem] text-muted-foreground">
                {{ t('install.wizard.projectKeyHint') }}
              </p>
            </div>

            <div class="mt-2 flex items-center justify-between pt-2">
              <Button
                v-if="projects.length > 0"
                variant="ghost"
                size="sm"
                @click="createRequested = false; isCreatingInline = false"
              >
                {{ t('install.wizard.back') }}
              </Button>
              <span v-else />

              <Button
                :disabled="!canCreate || createProjectMut.isPending.value"
                class="gap-1.5"
                @click="handleCreateInline"
              >
                <span>{{ t('install.wizard.createAndContinue') }}</span>
                <ArrowLeft v-if="isRtl" class="h-4 w-4" />
                <ArrowRight v-else class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- STEP 2: CHOOSE METHOD                                                     -->
      <!-- ========================================================================= -->
      <div v-if="currentStep === 'method'" class="flex flex-col gap-4 px-5 py-4">
        <div>
          <h3 class="text-sm font-semibold">{{ t('install.wizard.methodTitle') }}</h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ t('install.wizard.methodDesc') }}
          </p>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            class="relative flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-all hover:border-brand"
            :class="selectedMethod === 'agent' ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-border bg-background'"
            @click="selectedMethod = 'agent'; currentStep = 'install'"
          >
            <Badge variant="default" class="absolute top-2.5 end-2.5 text-[0.65rem]">
              {{ t('install.wizard.methodAgentBadge') }}
            </Badge>
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Bot class="h-5 w-5" />
            </div>
            <div class="font-semibold text-sm">{{ t('install.wizard.methodAgentTitle') }}</div>
            <div class="text-xs text-muted-foreground leading-relaxed">
              {{ t('install.wizard.methodAgentDesc') }}
            </div>
          </button>

          <button
            type="button"
            class="flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-all hover:border-brand"
            :class="selectedMethod === 'snippet' ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-border bg-background'"
            @click="selectedMethod = 'snippet'; currentStep = 'install'"
          >
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Code2 class="h-5 w-5" />
            </div>
            <div class="font-semibold text-sm">{{ t('install.wizard.methodSnippetTitle') }}</div>
            <div class="text-xs text-muted-foreground leading-relaxed">
              {{ t('install.wizard.methodSnippetDesc') }}
            </div>
          </button>

          <button
            type="button"
            class="flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-all hover:border-brand"
            :class="selectedMethod === 'extension' ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-border bg-background'"
            @click="selectedMethod = 'extension'; currentStep = 'install'"
          >
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-state-ready-tint text-state-ready">
              <Chrome class="h-5 w-5" />
            </div>
            <div class="font-semibold text-sm">{{ t('install.wizard.methodExtTitle') }}</div>
            <div class="text-xs text-muted-foreground leading-relaxed">
              {{ t('install.wizard.methodExtDesc') }}
            </div>
          </button>
        </div>

        <div class="mt-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" @click="currentStep = 'project'">
            {{ t('install.wizard.back') }}
          </Button>
          <Button class="gap-1.5" @click="currentStep = 'install'">
            <span>{{ t('install.wizard.next') }}</span>
            <ArrowLeft v-if="isRtl" class="h-4 w-4" />
            <ArrowRight v-else class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- STEP 3: ADD CODE TO PROJECT                                               -->
      <!-- ========================================================================= -->
      <div v-if="currentStep === 'install'" class="flex flex-col gap-4 px-5 py-4">
        <!-- AI Agent -->
        <div v-if="selectedMethod === 'agent'" class="flex flex-col gap-3">
          <div>
            <div class="text-xs font-semibold text-foreground">{{ t('install.wizard.curlTitle') }}</div>
            <div class="mt-0.5 text-xs text-muted-foreground">{{ t('install.wizard.curlHint') }}</div>
            <div class="relative mt-2 rounded-md border border-border bg-gutter p-3 pe-12 overflow-x-auto">
              <pre class="m-0 font-mono text-[13px]"><code>{{ `curl -fsSL ${server}/install.sh | sh` }}</code></pre>
              <Button variant="ghost" size="sm" @click="copy(`curl -fsSL ${server}/install.sh | sh`)" class="absolute top-3 end-3">
                <Copy class="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <div class="text-xs font-semibold text-foreground">{{ t('install.wizard.credsTitle') }}</div>
            <div class="mt-0.5 text-xs text-muted-foreground">{{ t('install.wizard.credsHint') }}</div>
            <div class="relative mt-2 rounded-md border border-border bg-gutter p-3 pe-12 overflow-x-auto">
              <pre class="m-0 font-mono text-[13px]"><code>{{ credentialsSnippet }}</code></pre>
              <Button variant="ghost" size="sm" @click="copy(credentialsSnippet)" class="absolute top-3 end-3">
                <Copy class="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Bot class="h-4 w-4 text-brand" />
              {{ t('install.wizard.agentPromptTitle') }}
            </div>
            <div class="mt-0.5 text-xs text-muted-foreground">{{ t('install.wizard.agentPromptHint') }}</div>
            <div class="relative mt-2 rounded-md border border-border bg-gutter p-3 pe-12 overflow-x-auto">
              <pre class="m-0 font-mono text-[13px] whitespace-pre-wrap"><code>{{ agentPrompt }}</code></pre>
              <Button variant="ghost" size="sm" @click="copy(agentPrompt)" class="absolute top-3 end-3">
                <Copy class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Code Snippet -->
        <div v-if="selectedMethod === 'snippet'" class="flex flex-col gap-3">
          <div class="text-xs text-muted-foreground">{{ t('install.wizard.snippetInstructions') }}</div>

          <AppTabs
            v-model="selectedStack"
            :tabs="[
              { value: 'html', label: t('install.wizard.stackHtml') },
              { value: 'react', label: t('install.wizard.stackReact') },
              { value: 'vue', label: t('install.wizard.stackVue') },
              { value: 'angular', label: t('install.wizard.stackAngular') },
            ]"
          >
            <TabsContent v-for="stack in (['html', 'react', 'vue', 'angular'] as const)" :key="stack" :value="stack">
              <div class="relative mt-2 rounded-md border border-border bg-gutter p-3 pe-12 overflow-x-auto">
                <pre class="m-0 font-mono text-[13px] whitespace-pre-wrap"><code>{{ stackSnippets[stack] }}</code></pre>
                <Button variant="ghost" size="sm" @click="copy(stackSnippets[stack])" class="absolute top-3 end-3">
                  <Copy class="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
          </AppTabs>
        </div>

        <!-- Chrome Extension -->
        <div v-if="selectedMethod === 'extension'" class="flex flex-col gap-3">
          <div>
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-semibold">{{ t('install.extDownloadTitle') }}</div>
                <div class="text-xs text-muted-foreground">{{ t('install.extDownloadHint') }}</div>
              </div>
              <Button as-child size="sm">
                <a :href="EXTENSION_ZIP_URL" download>
                  <Download class="h-4 w-4" />
                  {{ t('install.extDownloadButton') }}
                </a>
              </Button>
            </div>

            <ol class="mt-4 flex list-none flex-col gap-3 p-0 text-xs">
              <li>
                <span class="font-semibold">1. {{ t('install.extUnzipTitle') }}</span>: {{ t('install.extUnzipHint') }}
              </li>
              <li>
                <span class="font-semibold">2. {{ t('install.extLoadTitle') }}</span>: {{ t('install.extLoadHint') }}
              </li>
              <li>
                <span class="font-semibold">3. {{ t('install.extSignInTitle') }}</span>: {{ t('install.extSignInHint') }}
              </li>
            </ol>
          </div>
        </div>

        <div class="mt-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" @click="currentStep = 'method'">
            {{ t('install.wizard.back') }}
          </Button>
          <Button class="gap-1.5" @click="currentStep = 'verify'">
            <span>{{ t('install.wizard.next') }}</span>
            <ArrowLeft v-if="isRtl" class="h-4 w-4" />
            <ArrowRight v-else class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- STEP 4: LAUNCH & SEE IT LIVE                                              -->
      <!-- ========================================================================= -->
      <div v-if="currentStep === 'verify'" class="flex flex-col gap-4 px-5 py-4">
        <div>
          <h3 class="text-sm font-semibold">{{ t('install.wizard.step4Title') }}</h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ t('install.wizard.step4Hint') }}
          </p>
        </div>

        <!-- Checklist items -->
        <div class="flex flex-col gap-2.5">
          <div class="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
            <Laptop class="mt-0.5 h-4 w-4 text-brand shrink-0" />
            <div class="text-xs">
              <div class="font-semibold">{{ t('install.wizard.runDevTitle') }}</div>
              <div class="text-muted-foreground">{{ t('install.wizard.runDevHint') }}</div>
            </div>
          </div>

          <div class="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
            <ExternalLink class="mt-0.5 h-4 w-4 text-brand shrink-0" />
            <div class="text-xs">
              <div class="font-semibold">{{ t('install.wizard.openLocalTitle') }}</div>
              <div class="text-muted-foreground">{{ t('install.wizard.openLocalHint') }}</div>
            </div>
          </div>

          <div class="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
            <Rocket class="mt-0.5 h-4 w-4 text-brand shrink-0" />
            <div class="text-xs">
              <div class="font-semibold">{{ t('install.wizard.spotWidgetTitle') }}</div>
              <div class="text-muted-foreground">{{ t('install.wizard.spotWidgetHint') }}</div>
            </div>
          </div>

          <div class="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
            <CheckCircle2 class="mt-0.5 h-4 w-4 text-brand shrink-0" />
            <div class="text-xs">
              <div class="font-semibold">{{ t('install.wizard.dropCommentTitle') }}</div>
              <div class="text-muted-foreground">{{ t('install.wizard.dropCommentHint') }}</div>
            </div>
          </div>
        </div>

        <!-- Localhost Connection Checker -->
        <div class="rounded-xl border border-border bg-background p-4">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="text-xs">
              <div class="font-semibold">{{ t('install.wizard.checkConnection') }}</div>
              <div class="text-muted-foreground">
                Project: <span class="font-mono text-foreground">{{ effectiveKey }}</span> (http://localhost:3000)
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              :disabled="checkStatus === 'checking'"
              class="gap-1.5 shrink-0"
              @click="handleVerifyLocalhost"
            >
              <RefreshCw class="h-3.5 w-3.5" :class="checkStatus === 'checking' ? 'animate-spin' : ''" />
              {{ checkStatus === 'checking' ? t('install.wizard.checking') : t('install.wizard.checkConnection') }}
            </Button>
          </div>

          <div v-if="checkStatus === 'active'" class="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2 text-xs text-emerald-600 font-medium">
            <CheckCircle2 class="h-4 w-4" />
            {{ t('install.wizard.connectionActive') }}
          </div>

          <div v-if="checkStatus === 'inactive'" class="mt-3 flex items-center gap-2 rounded-lg bg-state-ready-tint p-2 text-xs text-state-ready font-medium">
            <AlertCircle class="h-4 w-4" />
            {{ t('install.wizard.connectionInactive') }}
          </div>
        </div>

        <!-- Celebration Card (if comments exist) -->
        <div v-if="projects.some((p) => (p.commentsCount ?? 0) > 0)" class="flex flex-col gap-3 rounded-md border border-brand/50 bg-brand-tint p-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start gap-3">
            <PartyPopper class="h-6 w-6 shrink-0 text-brand" />
            <div>
              <div class="text-sm font-bold text-foreground">
                {{ t('install.wizard.celebrationTitle') }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ t('install.wizard.celebrationDesc') }}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            class="shrink-0 self-start sm:self-auto"
            @click="
              guideOpen = false;
              router.push('/projects');
            "
          >
            {{ t('install.wizard.viewComments') }}
          </Button>
        </div>

        <!-- Footer -->
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              class="h-4 w-4"
              :checked="suppressed"
              @change="(e) => setSuppressed((e.target as HTMLInputElement).checked)"
            />
            <span class="text-[14px] text-muted-foreground">{{ t('install.dontShowAgain') }}</span>
          </label>

          <div class="flex items-center gap-2">
            <Button variant="secondary" size="sm" @click="currentStep = 'install'">
              {{ t('install.wizard.back') }}
            </Button>
            <Button size="sm" @click="guideOpen = false">{{ t('install.wizard.finish') }}</Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
