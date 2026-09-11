<script setup lang="ts">
import { computed } from 'vue';
import { Circle, Clock, CheckCircle2, Archive, XCircle } from 'lucide-vue-next';
import { cn } from '@/lib/utils';
import { badgeVariants, type BadgeVariants } from '.';

interface Props {
  variant?: BadgeVariants['variant'];
  class?: string;
}

const props = defineProps<Props>();

const glyphMap: Record<string, any> = {
  open: Circle,
  ready: Clock,
  pending: Clock,
  warning: Clock,
  completed: CheckCircle2,
  success: CheckCircle2,
  active: CheckCircle2,
  archived: Archive,
  disabled: XCircle,
  rejected: XCircle,
  danger: XCircle,
  destructive: XCircle,
};

const Glyph = computed(() => glyphMap[props.variant || 'default'] || null);
</script>

<template>
  <span :class="cn(badgeVariants({ variant }), props.class)">
    <component
      v-if="Glyph"
      :is="Glyph"
      class="h-3 w-3"
    />
    <slot />
  </span>
</template>
