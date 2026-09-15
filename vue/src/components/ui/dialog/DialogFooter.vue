<script setup lang="ts">
import { cn } from '@/lib/utils';

const props = defineProps<{ class?: string }>();
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        // Sticky at the bottom of the sheet below md so the actions stay
        // reachable without hunting through a long scrolled form; each
        // action stretches full width at min-h-11 per the mobile touch
        // target rule.
        'max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-6 max-md:-mb-6 max-md:mt-1 max-md:border-t max-md:border-border max-md:bg-card max-md:px-6 max-md:pb-6 max-md:pt-3 max-md:[&>*]:w-full max-md:[&>*]:min-h-11',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
