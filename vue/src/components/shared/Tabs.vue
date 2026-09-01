<script setup lang="ts">
// Thin convenience wrapper around the shadcn-vue Tabs primitives: pass `tabs` for the
// header strip, use the real `<TabsContent value="...">` from `@/components/ui/tabs` as
// slotted content for each tab's body. Reka UI's Tabs provide/inject correctly propagates
// through any nesting depth, so — unlike Angular's `mat-tab-group` (whose own content-child
// detection can't see a `<mat-tab>` merely projected in through a wrapper, see the Angular
// `TabsComponent` doc comment) — there's no need for an escape-hatch mechanism here.
import { computed } from 'vue';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TabItem } from './types';

const props = defineProps<{
  tabs: TabItem[];
  modelValue: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const active = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v),
});
</script>

<template>
  <Tabs v-model="active">
    <TabsList
      class="grid w-full"
      :style="{ gridTemplateColumns: `repeat(${props.tabs.length}, minmax(0, 1fr))` }"
    >
      <TabsTrigger v-for="t in props.tabs" :key="t.value" :value="t.value">
        {{ t.label }}
      </TabsTrigger>
    </TabsList>
    <slot />
  </Tabs>
</template>
