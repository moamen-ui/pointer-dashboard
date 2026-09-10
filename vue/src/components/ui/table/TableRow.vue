<script setup lang="ts">
import { cn } from '@/lib/utils';

const props = defineProps<{ class?: string }>();
</script>

<template>
  <tr
    :class="
      cn(
        'h-11 border-t border-border-muted transition-colors hover:bg-gutter/60 data-[state=selected]:bg-gutter',
        props.class,
      )
    "
  >
    <slot />
  </tr>
</template>
