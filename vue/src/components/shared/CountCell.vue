<script setup lang="ts">
import { watch, ref, computed } from 'vue';
import { Circle, Clock, CheckCircle2, Archive, XCircle } from 'lucide-vue-next';

interface Props {
  count: number;
  severity?: 'open' | 'ready' | 'pending' | 'warning' | 'completed' | 'success' | 'archived' | 'neutral' | 'danger' | 'rejected';
  showGlyph?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  severity: 'open',
  showGlyph: true,
});

const cellRef = ref<HTMLElement | null>(null);

const glyphMap = {
  open: Circle,
  ready: Clock,
  pending: Clock,
  warning: Clock,
  completed: CheckCircle2,
  success: CheckCircle2,
  archived: Archive,
  neutral: null,
  danger: XCircle,
  rejected: XCircle,
} as Record<string, any>;

const stateColorMap = {
  open: 'text-state-open',
  ready: 'text-state-ready',
  pending: 'text-state-ready',
  warning: 'text-state-ready',
  completed: 'text-state-completed',
  success: 'text-state-completed',
  archived: 'text-state-archived',
  neutral: 'text-state-archived',
  danger: 'text-state-danger',
  rejected: 'text-state-danger',
} as Record<string, string>;

const flashTintMap = {
  open: '--flash-tint: var(--state-open-tint)',
  ready: '--flash-tint: var(--state-ready-tint)',
  pending: '--flash-tint: var(--state-ready-tint)',
  warning: '--flash-tint: var(--state-ready-tint)',
  completed: '--flash-tint: var(--state-completed-tint)',
  success: '--flash-tint: var(--state-completed-tint)',
  archived: '--flash-tint: var(--state-archived-tint)',
  neutral: '--flash-tint: var(--state-archived-tint)',
  danger: '--flash-tint: var(--state-danger-tint)',
  rejected: '--flash-tint: var(--state-danger-tint)',
} as Record<string, string>;

const Glyph = computed(() => glyphMap[props.severity] || null);
const stateColor = computed(() => stateColorMap[props.severity] || 'text-state-open');
const flashTint = computed(() => flashTintMap[props.severity]);

// Trigger flash animation when count changes
watch(
  () => props.count,
  () => {
    if (cellRef.value) {
      cellRef.value.classList.remove('ds-flash');
      // Trigger reflow to restart animation
      void cellRef.value.offsetWidth;
      cellRef.value.classList.add('ds-flash');
    }
  },
);
</script>

<template>
  <span
    ref="cellRef"
    :class="['font-mono tabular-nums text-[14px]', props.count > 0 ? stateColor : 'text-faint-foreground']"
    :style="props.count > 0 ? flashTint : ''"
  >
    <component
      v-if="props.count > 0 && Glyph && props.showGlyph"
      :is="Glyph"
      class="inline w-3 h-3 me-1"
    />
    {{ props.count }}
  </span>
</template>
