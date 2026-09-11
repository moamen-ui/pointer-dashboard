<script setup lang="ts">
import { TabsList, type TabsListProps } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps<TabsListProps & { class?: string }>();
</script>

<template>
  <TabsList
    v-bind="props"
    :class="
      cn(
        'h-9 flex gap-4 border-b border-border overflow-x-auto',
        props.class,
      )
    "
  >
    <slot />
  </TabsList>
</template>
