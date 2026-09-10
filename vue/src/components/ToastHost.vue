<script setup lang="ts">
import { CircleAlert, CircleCheck, CircleHelp, Clock, X } from 'lucide-vue-next';
import { dismissToast, toastState, type ToastTone } from '@/composables/useToast';
import { cn } from '@/lib/utils';

// A toast is a floating layer, so it keeps the canvas-and-menu-shadow grammar; the state hue lands
// on the glyph and the hairline rather than filling the surface. Rarity gives it force.
const TONES: Record<Exclude<ToastTone, 'error'>, { border: string; icon: string; glyph: unknown }> = {
  default: { border: 'border-border', icon: '', glyph: null },
  info: { border: 'border-state-open/40', icon: 'text-state-open', glyph: CircleHelp },
  success: { border: 'border-state-completed/40', icon: 'text-state-completed', glyph: CircleCheck },
  warning: { border: 'border-state-ready/40', icon: 'text-state-ready', glyph: Clock },
  danger: { border: 'border-state-danger/40', icon: 'text-state-danger', glyph: CircleAlert },
};

function toneOf(tone: ToastTone) {
  return TONES[tone === 'error' ? 'danger' : tone];
}
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 end-4 z-[100] flex w-[min(360px,92vw)] flex-col gap-2">
    <div
      v-for="item in toastState.items"
      :key="item.id"
      role="status"
      aria-live="polite"
      :class="
        cn(
          'pointer-events-auto flex items-start gap-2 rounded-md border bg-card px-4 py-3 text-[14px] text-card-foreground shadow-menu',
          toneOf(item.tone).border,
        )
      "
    >
      <component
        :is="toneOf(item.tone).glyph"
        v-if="toneOf(item.tone).glyph"
        :class="cn('mt-0.5 h-4 w-4 shrink-0', toneOf(item.tone).icon)"
      />
      <span class="flex-1">{{ item.message }}</span>
      <button
        type="button"
        class="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        :aria-label="'Dismiss'"
        @click="dismissToast(item.id)"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
