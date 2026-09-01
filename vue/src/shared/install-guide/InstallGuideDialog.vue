<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Copy, Download, Rocket } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TabsContent } from '@/components/ui/tabs';
import AppTabs from '@/components/shared/Tabs.vue';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProjectResponse } from '@moamen-ui/pointer-vue';
import { useAuth } from '@/composables/useAuth';
import { toast } from '@/composables/useToast';
import { getDemoSession, type DemoSession } from '@/lib/demoSession';
import { buildSteps } from './buildSteps';
import { isSuppressed, markShown, suppress, unsuppress, useInstallGuide } from './useInstallGuide';

const { t } = useI18n();
const { user } = useAuth();
const { guideOpen, projects: allProjects } = useInstallGuide();

// Read once — the session only changes through a full navigation anyway.
const demo = ref<DemoSession | null>(getDemoSession());

/** Projects with a key, for the picker. */
const projects = computed(() =>
  allProjects.value.filter((p): p is ProjectResponse & { key: string } => !!p.key),
);

/** Selected project key; defaults to the demo project, else the first one. */
const projectKey = ref<string | null>(demo.value?.projectKey ?? null);
watch(
  projects,
  (list) => {
    if (!projectKey.value && list.length > 0) projectKey.value = list[0]?.key ?? null;
  },
  { immediate: true },
);

const suppressed = ref(isSuppressed(user.value?.id ?? null));

/** Active guide tab. Deliberately not persisted — every open starts on Code. */
const activeTab = ref<string>('code');

const steps = computed(() =>
  buildSteps({
    server: demo.value?.serverUrl || import.meta.env.VITE_API_BASE,
    projectKey: projectKey.value ?? projects.value[0]?.key ?? null,
    userEmail: user.value?.email ?? null,
    demo: demo.value,
    credsEmailedText: t('demo.credsEmailed'),
  }),
);

// Opening it counts as seen, however it was opened.
watch(
  guideOpen,
  (openNow) => {
    if (openNow) markShown(user.value?.id ?? null);
  },
  { immediate: true },
);

// The open flag is module-level (shared with the banner + auto-open); leaving
// the authenticated shell (logout) must not leave it dangling for next login.
onUnmounted(() => {
  guideOpen.value = false;
});

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
</script>

<template>
  <Dialog v-model:open="guideOpen">
    <DialogContent class="max-h-[85vh] max-w-[680px] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Rocket class="h-5 w-5 text-brand" />
          {{ t('install.title') }}
        </DialogTitle>
      </DialogHeader>

      <p class="text-sm text-muted-foreground">{{ t('install.intro') }}</p>

      <AppTabs
        v-model="activeTab"
        :tabs="[
          { value: 'code', label: t('install.tabCode') },
          { value: 'extension', label: t('install.tabExtension') },
        ]"
      >
        <TabsContent value="code">
          <!-- Which project the snippet points at -->
          <div v-if="projects.length > 0" class="flex flex-col gap-1.5">
            <Select v-model="projectKey">
              <SelectTrigger :aria-label="t('install.project')">
                <SelectValue :placeholder="t('install.project')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in projects" :key="p.key" :value="p.key">
                  {{ p.name }} ({{ p.key }})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p v-else-if="!demo" class="rounded-lg border border-border bg-app/40 p-3 text-sm">
            {{ t('install.noProjects') }}
            <RouterLink to="/projects" class="text-brand underline" @click="guideOpen = false">
              {{ t('nav.projects') }}
            </RouterLink>
          </p>

          <!-- The recommended path: install the skills, then let the agent wire the widget -->
          <ol class="m-0 flex list-none flex-col gap-3 p-0">
            <li
              v-for="(st, i) in steps.primary"
              :key="st.titleKey"
              class="rounded-lg border border-border bg-app/40 p-3"
            >
              <div class="text-sm font-semibold">{{ i + 1 }}. {{ t(st.titleKey) }}</div>
              <div class="mt-0.5 text-xs text-muted-foreground">{{ t(st.hintKey) }}</div>
              <div v-if="st.code" class="mt-2 flex items-start gap-2">
                <pre
                  class="m-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-background/70 px-3 py-2 font-mono text-xs"
                >{{ st.code }}</pre>
                <Button
                  variant="outline"
                  size="sm"
                  class="flex-shrink-0"
                  type="button"
                  @click="copy(st.code!)"
                >
                  <Copy class="h-4 w-4" />
                  {{ t('demo.copy') }}
                </Button>
              </div>
            </li>
          </ol>

          <!-- Hand-wiring, for anyone not using an agent. Collapsed: the prompt above
               does this per-stack, so these snippets are the fallback, not the path. -->
          <details class="rounded-lg border border-border p-3">
            <summary class="cursor-pointer text-sm font-semibold">{{ t('install.manualTitle') }}</summary>
            <p class="mb-2 mt-1 text-xs text-muted-foreground">{{ t('install.manualHint') }}</p>
            <div class="flex flex-col gap-3">
              <div v-for="st in steps.manual" :key="st.titleKey">
                <div class="text-xs font-medium">{{ t(st.titleKey) }}</div>
                <div class="mt-0.5 text-xs text-muted-foreground">{{ t(st.hintKey) }}</div>
                <div v-if="st.code" class="mt-1.5 flex items-start gap-2">
                  <pre
                    class="m-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-background/70 px-3 py-2 font-mono text-xs"
                  >{{ st.code }}</pre>
                  <Button
                    variant="outline"
                    size="sm"
                    class="flex-shrink-0"
                    type="button"
                    @click="copy(st.code!)"
                  >
                    <Copy class="h-4 w-4" />
                    {{ t('demo.copy') }}
                  </Button>
                </div>
              </div>
            </div>
          </details>
        </TabsContent>

        <TabsContent value="extension">
          <!-- Chrome-extension path: same step rendering, but step 1 is a real download -->
          <ol class="m-0 flex list-none flex-col gap-3 p-0">
            <li
              v-for="(st, i) in steps.extension"
              :key="st.titleKey"
              class="rounded-lg border border-border bg-app/40 p-3"
            >
              <div class="text-sm font-semibold">{{ i + 1 }}. {{ t(st.titleKey) }}</div>
              <div class="mt-0.5 text-xs text-muted-foreground">{{ t(st.hintKey) }}</div>
              <Button v-if="st.downloadUrl" as-child variant="outline" size="sm" class="mt-2">
                <a :href="st.downloadUrl" download>
                  <Download class="h-4 w-4" />
                  {{ t('install.extDownload') }}
                </a>
              </Button>
              <div v-else-if="st.code" class="mt-2 flex items-start gap-2">
                <pre
                  class="m-0 flex-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-background/70 px-3 py-2 font-mono text-xs"
                >{{ st.code }}</pre>
                <Button
                  variant="outline"
                  size="sm"
                  class="flex-shrink-0"
                  type="button"
                  @click="copy(st.code!)"
                >
                  <Copy class="h-4 w-4" />
                  {{ t('demo.copy') }}
                </Button>
              </div>
            </li>
          </ol>
        </TabsContent>
      </AppTabs>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <label class="flex cursor-pointer items-center gap-2 text-xs">
          <Checkbox :model-value="suppressed" @update:model-value="setSuppressed" />
          {{ t('install.dontShowAgain') }}
        </label>
        <Button type="button" @click="guideOpen = false">{{ t('install.done') }}</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
