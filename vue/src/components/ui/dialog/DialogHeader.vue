<script setup lang="ts">
import { cn } from '@/lib/utils';

const props = defineProps<{ class?: string }>();
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col gap-1.5 text-center sm:text-start',
        // Sticky at the top of the sheet's own scroll region below md, bled
        // to the full width with the dialog's own padding re-applied so it
        // reads as a fixed title bar while the body scrolls under it.
        'max-md:sticky max-md:top-0 max-md:z-10 max-md:-mx-6 max-md:-mt-6 max-md:rounded-t-xl max-md:bg-card max-md:px-6 max-md:pb-3 max-md:pt-6',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
