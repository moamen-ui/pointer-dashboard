<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowRight, ArrowLeft, X } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,

  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTour } from '@/lib/tour';

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const { t, locale } = useI18n();
const isRtl = computed(() => locale.value === 'ar');

const {
  isOpen,
  promptOpen,
  currentStep,
  currentStepIndex,
  totalSteps,
  nextStep,
  prevStep,
  endTour,
  startTour,
  dismissPrompt,
} = useTour();

const rect = ref<TargetRect | null>(null);

function updateRect() {
  if (!isOpen.value || !currentStep.value) {
    rect.value = null;
    return;
  }

  const el = document.querySelector(currentStep.value.targetSelector);
  if (!el) {
    setTimeout(() => {
      const retryEl = document.querySelector(currentStep.value?.targetSelector ?? '');
      if (retryEl) {
        retryEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const r = retryEl.getBoundingClientRect();
        rect.value = { top: r.top, left: r.left, width: r.width, height: r.height };
      }
    }, 300);
    return;
  }

  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const r = el.getBoundingClientRect();
  rect.value = { top: r.top, left: r.left, width: r.width, height: r.height };
}

watch([isOpen, currentStep], () => {
  updateRect();
});

onMounted(() => {
  window.addEventListener('resize', updateRect);
  window.addEventListener('scroll', updateRect, true);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateRect);
  window.removeEventListener('scroll', updateRect, true);
});

const isLastStep = computed(() => currentStepIndex.value === totalSteps - 1);
const pad = 6;

const cardStyle = computed(() => {
  if (!rect.value) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  const padSize = 12;
  const cardWidth = 360;
  const cardHeight = 220;

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  let top = rect.value.top + rect.value.height + padSize;
  let left = rect.value.left;

  if (top + cardHeight > viewportH - 20) {
    top = Math.max(20, rect.value.top - cardHeight - padSize);
  }

  if (left + cardWidth > viewportW - 20) {
    left = Math.max(20, viewportW - cardWidth - 20);
  }
  if (left < 20) left = 20;

  return {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
  };
});
</script>

<template>
  <!-- Welcome Prompt Dialog -->
  <Dialog :open="promptOpen" @update:open="(val) => !val && dismissPrompt()">
    <DialogContent class="w-[min(520px,calc(100vw-32px))]">
      <DialogHeader>
        <DialogTitle class="text-[16px] font-semibold leading-6">
          {{ t('tour.welcomePromptTitle') }}
        </DialogTitle>
        <div class="pt-3 text-[14px] leading-5 text-muted-foreground">
          {{ t('tour.welcomePromptDesc') }}
        </div>
      </DialogHeader>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" @click="dismissPrompt">
          {{ t('tour.skipTour') }}
        </Button>
        <Button @click="startTour">
          {{ t('tour.startTour') }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Interactive Spotlight Tour Overlay -->
  <div v-if="isOpen && currentStep" class="fixed inset-0 z-50 overflow-hidden">
    <!-- SVG Dimming Mask -->
    <svg class="absolute inset-0 h-full w-full pointer-events-auto">
      <defs>
        <mask id="vue-tour-spotlight-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect
            v-if="rect"
            :x="rect.left - pad"
            :y="rect.top - pad"
            :width="rect.width + pad * 2"
            :height="rect.height + pad * 2"
            rx="8"
            fill="black"
          />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.72)"
        mask="url(#vue-tour-spotlight-mask)"
      />
    </svg>

    <!-- Highlight ring around target element -->
    <div
      v-if="rect"
      class="pointer-events-none absolute rounded-lg border-2 border-brand shadow-[0_0_15px_rgba(var(--brand-rgb,59,130,246),0.5)] transition-all duration-300"
      :style="{
        top: `${rect.top - pad}px`,
        left: `${rect.left - pad}px`,
        width: `${rect.width + pad * 2}px`,
        height: `${rect.height + pad * 2}px`,
      }"
    />

    <!-- Floating Popover Step Card -->
    <div
      class="absolute z-50 w-[360px] max-w-[calc(100vw-40px)] rounded-xl border border-border bg-card p-4 shadow-2xl transition-all duration-200"
      :style="cardStyle"
    >
      <div class="flex items-center justify-end pb-2 border-b border-border/60">
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          :aria-label="t('tour.skipTour')"
          @click="endTour"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="mt-3">
        <h4 class="text-sm font-semibold text-foreground">
          {{ t(currentStep.titleKey) }}
        </h4>
        <p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {{ t(currentStep.descriptionKey) }}
        </p>
      </div>

      <div class="mt-4 flex items-center justify-between pt-2">
        <span class="text-[12px] font-mono text-muted-foreground">
          {{ t('tour.stepOf', { current: currentStepIndex + 1, total: totalSteps }) }}
        </span>

        <div class="flex items-center gap-2">
          <Button
            v-if="currentStepIndex > 0"
            variant="secondary"
            size="sm"
            class="h-8 text-xs"
            @click="prevStep"
          >
            <ArrowRight v-if="isRtl" class="h-3.5 w-3.5" />
            <ArrowLeft v-else class="h-3.5 w-3.5" />
            {{ t('tour.back') }}
          </Button>

          <Button size="sm" class="h-8 gap-1.5 text-xs" @click="nextStep">
            <span>{{ isLastStep ? t('tour.finish') : t('tour.next') }}</span>
            <template v-if="!isLastStep">
              <ArrowLeft v-if="isRtl" class="h-3.5 w-3.5" />
              <ArrowRight v-else class="h-3.5 w-3.5" />
            </template>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
