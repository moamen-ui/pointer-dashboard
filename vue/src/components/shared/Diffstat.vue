<script setup lang="ts">
import { Lock } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

type Severity = 'open' | 'ready' | 'pending' | 'warning' | 'completed' | 'success' | 'archived' | 'neutral' | 'danger' | 'rejected';

interface Item {
  count: number;
  label: string;
  severity?: Severity;
}

interface Props {
  items: Item[];
  privateComments?: number;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  privateComments: 0,
});

const { t } = useI18n();

// Mirrors React `DiffstatLine` / Angular `app-diffstat`: the hue names the state, not the
// magnitude, so a zero keeps its hue; unstated items read in ink.
const toneClass: Record<Severity, string> = {
  open: 'text-state-open',
  ready: 'text-state-ready',
  pending: 'text-state-ready',
  warning: 'text-state-ready',
  completed: 'text-state-completed',
  success: 'text-state-completed',
  archived: 'text-state-archived',
  neutral: 'text-foreground',
  danger: 'text-state-danger',
  rejected: 'text-state-danger',
};
</script>

<template>
  <div :class="['text-[14px] flex flex-wrap gap-2 text-muted-foreground', props.class]">
    <template v-for="(item, index) in props.items" :key="`item-${index}`">
      <span v-if="index > 0" class="text-faint-foreground" aria-hidden="true">·</span>
      <span class="inline-flex items-center gap-1">
        <span :class="['font-mono tabular-nums', toneClass[item.severity ?? 'neutral']]">{{ item.count }}</span>
        <span>{{ item.label }}</span>
      </span>
    </template>
    <template v-if="props.privateComments > 0">
      <span class="text-faint-foreground" aria-hidden="true">·</span>
      <span class="inline-flex items-center gap-1">
        <Lock class="h-3 w-3" />
        <span class="font-mono tabular-nums text-foreground">{{ props.privateComments }}</span>
        <span>{{ t('overview.private') }}</span>
      </span>
    </template>
  </div>
</template>
