<script setup lang="ts">
import { cn } from '@/lib/utils';

const props = defineProps<{ class?: string }>();
</script>

<template>
  <thead :class="cn('[&_tr]:h-10 [&_tr]:bg-gutter [&_tr]:hover:bg-gutter', props.class)">
    <slot />
  </thead>
</template>
