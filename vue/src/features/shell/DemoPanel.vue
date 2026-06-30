<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Copy, Check, X, Sparkles } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { clearDemoSession, getDemoSession } from '@/lib/demoSession';

const { t } = useI18n();

const session = ref(getDemoSession());
const dismissed = ref(false);
const copiedStep = ref<1 | 2 | 3 | 4 | null>(null);

// Step 4: a fixed example prompt — intentionally NOT translated (same in all locales).
const examplePrompt = 'What are the new Pointer comments?';
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

// Step 1: script that defines <pointer-feedback> + the mounted element.
const embedSnippet = computed(() => {
  if (!session.value) return '';
  const srv = session.value.serverUrl;
  return `<script src="${srv}/pointer.js" defer><\/script>\n<pointer-feedback project="${session.value.projectKey}" server="${srv}"></pointer-feedback>`;
});

// Step 2: one-line installer — pulls the pointer-init + pointer-feedback skills.
const installCmd = computed(() => {
  if (!session.value) return '';
  return `curl -fsSL ${session.value.serverUrl}/install.sh | sh`;
});

// Step 3: paste into .pointer/credentials.env — pre-filled with this demo's widget login.
const credsBlock = computed(() => {
  if (!session.value) return '';
  return `POINTER_EMAIL=${session.value.email}\nPOINTER_PASSWORD=${session.value.password}`;
});

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

async function copyText(step: 1 | 2 | 3 | 4, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedStep.value = step;
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

        <div class="grid gap-3">
          <!-- Step 1: embed the widget (script import + element) -->
          <div class="space-y-1.5">
            <div class="text-xs font-semibold">{{ t('demo.step1Title') }}</div>
            <div class="text-xs text-muted-foreground">{{ t('demo.step1Hint') }}</div>
            <div class="flex items-start gap-2">
              <pre
                class="m-0 flex-1 overflow-x-auto rounded-md bg-background/70 px-3 py-2 font-mono text-xs"
              >{{ embedSnippet }}</pre>
              <Button
                variant="outline"
                size="sm"
                class="flex-shrink-0"
                @click="copyText(1, embedSnippet)"
              >
                <Check v-if="copiedStep === 1" class="h-4 w-4" />
                <Copy v-else class="h-4 w-4" />
                {{ copiedStep === 1 ? t('demo.copied') : t('demo.copy') }}
              </Button>
            </div>
          </div>

          <!-- Step 2: install the AI skills + credentials scaffold -->
          <div class="space-y-1.5">
            <div class="text-xs font-semibold">{{ t('demo.step2Title') }}</div>
            <div class="text-xs text-muted-foreground">{{ t('demo.step2Hint') }}</div>
            <div class="flex items-center gap-2">
              <code
                class="flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-background/70 px-3 py-2 font-mono text-xs"
              >{{ installCmd }}</code>
              <Button
                variant="outline"
                size="sm"
                class="flex-shrink-0"
                @click="copyText(2, installCmd)"
              >
                <Check v-if="copiedStep === 2" class="h-4 w-4" />
                <Copy v-else class="h-4 w-4" />
                {{ copiedStep === 2 ? t('demo.copied') : t('demo.copy') }}
              </Button>
            </div>
          </div>

          <!-- Step 3: fill .pointer/credentials.env with the widget login -->
          <div class="space-y-1.5">
            <div class="text-xs font-semibold">{{ t('demo.step3Title') }}</div>
            <div class="text-xs text-muted-foreground">{{ t('demo.step3Hint') }}</div>
            <div class="flex items-start gap-2">
              <pre
                class="m-0 flex-1 overflow-x-auto rounded-md bg-background/70 px-3 py-2 font-mono text-xs"
              >{{ credsBlock }}</pre>
              <Button
                variant="outline"
                size="sm"
                class="flex-shrink-0"
                @click="copyText(3, credsBlock)"
              >
                <Check v-if="copiedStep === 3" class="h-4 w-4" />
                <Copy v-else class="h-4 w-4" />
                {{ copiedStep === 3 ? t('demo.copied') : t('demo.copy') }}
              </Button>
            </div>
          </div>

          <!-- Step 4: apply the feedback with an AI tool -->
          <div class="space-y-1.5">
            <div class="text-xs font-semibold">{{ t('demo.step4Title') }}</div>
            <div class="text-xs text-muted-foreground">{{ t('demo.step4Hint') }}</div>
            <div class="flex items-center gap-2">
              <code
                class="flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-background/70 px-3 py-2 font-mono text-xs"
              >{{ examplePrompt }}</code>
              <Button
                variant="outline"
                size="sm"
                class="flex-shrink-0"
                @click="copyText(4, examplePrompt)"
              >
                <Check v-if="copiedStep === 4" class="h-4 w-4" />
                <Copy v-else class="h-4 w-4" />
                {{ copiedStep === 4 ? t('demo.copied') : t('demo.copy') }}
              </Button>
            </div>
          </div>
        </div>
      </div>

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
