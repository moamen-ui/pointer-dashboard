<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';
import { cn } from '@/lib/utils';

/**
 * A collapsible settings section: the card header is the click target and the body
 * expands under it. Built on native <details>/<summary> so keyboard support, focus
 * and the open/closed semantics come from the platform — no dependency, and no
 * state to keep in sync. The header accepts a slot so it can carry a badge.
 */
const props = defineProps<{ title?: string; defaultOpen?: boolean; class?: string }>();
</script>

<template>
  <details
    :open="props.defaultOpen"
    :class="cn('group rounded-lg border border-border bg-card', props.class)"
  >
    <summary
      class="flex cursor-pointer list-none items-center gap-2 px-6 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden"
    >
      <span class="flex flex-1 items-center gap-2">
        <slot name="title">{{ props.title }}</slot>
      </span>
      <ChevronDown
        class="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        aria-hidden="true"
      />
    </summary>
    <div class="flex flex-col gap-4 border-t border-border px-6 py-4">
      <slot />
    </div>
  </details>
</template>
