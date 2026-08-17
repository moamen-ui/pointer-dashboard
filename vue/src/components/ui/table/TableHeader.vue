<script setup lang="ts">
import { cn } from '@/lib/utils';

const props = defineProps<{ class?: string }>();
</script>

<template>
  <thead :class="cn('[&_tr]:border-b [&_tr]:bg-muted/60 [&_tr]:hover:bg-muted/60', props.class)">
    <slot />
  </thead>
</template>
