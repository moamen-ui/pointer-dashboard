<script setup lang="ts">
import { TabsTrigger, type TabsTriggerProps } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps<TabsTriggerProps & { class?: string }>();
</script>

<template>
  <TabsTrigger
    v-bind="props"
    :class="
      cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap pb-2 border-b-2 -mb-px text-[14px] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-muted-foreground border-transparent data-[state=active]:border-brand data-[state=active]:text-foreground data-[state=active]:font-medium',
        props.class,
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
