<script setup lang="ts">
import { cn } from '@/lib/utils';

const props = defineProps<{ class?: string; colspan?: number }>();
</script>

<template>
  <td
    :colspan="colspan"
    :class="cn('p-2 align-middle [&:has([role=checkbox])]:pe-0', props.class)"
  >
    <slot />
  </td>
</template>
