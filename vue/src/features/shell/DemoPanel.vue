<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Copy, Check, X, Sparkles } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { clearDemoSession, getDemoSession } from '@/lib/demoSession';

const { t } = useI18n();

const session = ref(getDemoSession());
const dismissed = ref(false);
const copied = ref(false);
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

const snippet = computed(() =>
  session.value
    ? `<pointer-feedback project="${session.value.projectKey}" server="${session.value.serverUrl}"></pointer-feedback>`
    : '',
);

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

async function copySnippet() {
  try {
    await navigator.clipboard.writeText(snippet.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
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

        <div class="space-y-1.5">
          <span class="text-xs text-muted-foreground">{{ t('demo.snippetLabel') }}</span>
          <div class="flex items-stretch gap-2">
            <code
              class="flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-background/70 px-3 py-2 font-mono text-xs"
              >{{ snippet }}</code
            >
            <Button variant="outline" size="sm" class="flex-shrink-0" @click="copySnippet">
              <Check v-if="copied" class="h-4 w-4" />
              <Copy v-else class="h-4 w-4" />
              {{ copied ? t('demo.copied') : t('demo.copy') }}
            </Button>
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
