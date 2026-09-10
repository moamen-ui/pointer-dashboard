<script setup lang="ts">
import { cn } from '@/lib/utils';

const props = defineProps<{ class?: string }>();
</script>

<template>
  <th
    :class="
      cn(
        'px-3 text-[13px] font-medium text-muted-foreground text-start align-middle [&:has([role=checkbox])]:pe-0',
        props.class,
      )
    "
  >
    <slot />
  </th>
</template>
