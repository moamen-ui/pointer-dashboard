<script setup lang="ts">
import { cn } from '@/lib/utils';

const props = defineProps<{ class?: string; colspan?: number }>();
</script>

<template>
  <tr>
    <td
      :colspan="colspan ?? 1"
      :class="cn('p-4 whitespace-nowrap text-center align-middle text-sm text-muted-foreground', props.class)"
    >
      <slot />
    </td>
  </tr>
</template>
