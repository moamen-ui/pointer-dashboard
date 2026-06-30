<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Copy, Check, X, Sparkles, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { clearDemoSession, getDemoSession } from '@/lib/demoSession';

const { t } = useI18n();

const session = ref(getDemoSession());
const dismissed = ref(false);
const copiedStep = ref<number | null>(null);

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

interface SetupStep {
  titleKey: string;
  hintKey: string;
  code?: string;
}

// Data-driven setup guide — 6 entries derived from the demo session.
const steps = computed<SetupStep[]>(() => {
  const s = session.value;
  if (!s) return [];
  const srv = s.serverUrl ?? '';
  return [
    {
      titleKey: 'demo.step1Title',
      hintKey: 'demo.step1Hint',
      // Split the closing </script> tag so Vue/JS parsers don't choke on it.
      code: `<script src="${srv}/pointer.js" defer><` + `/script>`,
    },
    {
      titleKey: 'demo.step2Title',
      hintKey: 'demo.step2Hint',
      code: `<pointer-feedback project="${s.projectKey ?? ''}" server="${srv}"></pointer-feedback>`,
    },
    {
      titleKey: 'demo.step3Title',
      hintKey: 'demo.step3Hint',
      code: `curl -fsSL ${srv}/install.sh | sh`,
    },
    {
      titleKey: 'demo.step4Title',
      hintKey: 'demo.step4Hint',
      code: `POINTER_EMAIL=${s.email ?? ''}\nPOINTER_PASSWORD=${s.password ?? ''}`,
    },
    {
      titleKey: 'demo.step5Title',
      hintKey: 'demo.step5Hint',
      // instruction-only step — no code block
    },
    {
      titleKey: 'demo.step6Title',
      hintKey: 'demo.step6Hint',
      // Fixed English literal — NOT translated so the AI skill triggers on it.
      code: 'What are the new Pointer comments?',
    },
  ];
});

// 1-based current step index.
const step = ref(1);

const current = computed<SetupStep | undefined>(() => steps.value[step.value - 1]);

function prev() {
  step.value = Math.max(1, step.value - 1);
}

function next() {
  step.value = Math.min(steps.value.length, step.value + 1);
}

const remainingMs = computed(() => {
  if (!session.value?.expiresAt) return 0;
  return new Date(session.value.expiresAt).getTime() - now.value;
});

const expired = computed(() => remainingMs.value <= 0);

const countdown = computed(() => {
  const ms = Math.max(0, remainingMs.value);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
});

async function copyCode(index: number, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedStep.value = index;
    setTimeout(() => (copiedStep.value = null), 1500);
  } catch {
    /* clipboard unavailable — ignore */
  }
}

function dismiss() {
  dismissed.value = true;
  clearDemoSession();
}
</script>

<template>
  <div
    v-if="session && !dismissed"
    class="m-4 mb-0 rounded-xl border border-brand/30 bg-brand-tint/60 p-4 text-sm"
  >
    <div class="flex items-start gap-3">
      <Sparkles class="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" />
      <div class="flex-1 space-y-3">
        <!-- Header row: title + countdown -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="font-semibold text-brand">{{ t('demo.bannerTitle') }}</span>
          <span class="text-muted-foreground">{{ t('demo.bannerDesc') }}</span>
          <span
            class="ms-auto rounded-md bg-background/70 px-2 py-0.5 font-mono text-xs"
            :class="expired ? 'text-destructive' : 'text-foreground'"
          >
            {{ expired ? t('demo.expired') : t('demo.expiresIn', { time: countdown }) }}
          </span>
        </div>

        <!-- Project key + widget login (always visible) -->
        <div class="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span>
            <span class="text-muted-foreground">{{ t('demo.projectKey') }}:</span>
            <span class="ms-1 font-mono">{{ session.projectKey }}</span>
          </span>
          <span>
            <span class="text-muted-foreground">{{ t('demo.widgetLogin') }}:</span>
            <span class="ms-1 font-mono">{{ session.email }}</span>
            <span class="mx-1 text-muted-foreground">/</span>
            <span class="font-mono">{{ session.password }}</span>
          </span>
        </div>

        <!-- Setup guide slider (one step at a time) -->
        <div class="rounded-lg border border-border bg-background/40 p-3">
          <template v-if="current">
            <div class="text-xs font-semibold">{{ t(current.titleKey) }}</div>
            <div class="mt-0.5 text-xs text-muted-foreground">{{ t(current.hintKey) }}</div>
            <div v-if="current.code" class="mt-2 flex items-start gap-2">
              <pre
                class="m-0 flex-1 overflow-x-auto rounded-md bg-background/70 px-3 py-2 font-mono text-xs"
              >{{ current.code }}</pre>
              <Button
                variant="outline"
                size="sm"
                class="flex-shrink-0"
                type="button"
                @click="copyCode(step, current.code!)"
              >
                <Check v-if="copiedStep === step" class="h-4 w-4" />
                <Copy v-else class="h-4 w-4" />
                {{ copiedStep === step ? t('demo.copied') : t('demo.copy') }}
              </Button>
            </div>
          </template>

          <!-- Nav row: Back — counter — Next -->
          <div class="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              :disabled="step === 1"
              @click="prev"
            >
              <ChevronLeft class="h-4 w-4" />
              {{ t('demo.back') }}
            </Button>
            <span class="text-xs text-muted-foreground">{{ step }} / {{ steps.length }}</span>
            <Button
              variant="outline"
              size="sm"
              type="button"
              class="ms-auto"
              :disabled="step === steps.length"
              @click="next"
            >
              {{ t('demo.next') }}
              <ChevronRight class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <!-- Dismiss button (always visible) -->
      <Button
        variant="ghost"
        size="icon"
        class="flex-shrink-0"
        :aria-label="t('demo.dismiss')"
        @click="dismiss"
      >
        <X class="h-4 w-4" />
      </Button>
    </div>
  </div>
</template>
