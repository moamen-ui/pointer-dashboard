<script setup lang="ts">
import { cn } from '@/lib/utils';

const props = defineProps<{ class?: string; colspan?: number }>();
</script>

<template>
  <td
    :colspan="colspan"
    :class="cn('px-3 py-1.5 text-[14px] align-middle [&:has([role=checkbox])]:pe-0', props.class)"
  >
    <slot />
  </td>
</template>
