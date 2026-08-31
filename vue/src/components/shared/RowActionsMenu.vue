<script setup lang="ts">
import { MoreVertical } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RowActionItem } from './types';

defineProps<{
  items: RowActionItem[];
  /** Accessible label for the trigger button — supplied (translated) by the caller. */
  ariaLabel: string;
}>();

// The single place severity maps to styling. Applied to the menu item; the icon
// inherits `currentColor`, so item and icon stay in sync from this one mapping.
function severityClass(severity?: RowActionItem['severity']): string {
  switch (severity) {
    case 'danger':
      return 'text-destructive focus:text-destructive';
    case 'success':
      return 'text-success focus:text-success';
    case 'warning':
      return 'text-warning focus:text-warning';
    // 'primary' and 'neutral' keep the default menu-item styling.
    default:
      return '';
  }
}
</script>

<template>
  <!-- No items (e.g. permissions gate said so) → render nothing at all. -->
  <DropdownMenu v-if="items.length > 0">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" :aria-label="ariaLabel">
        <MoreVertical class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <!-- Keyed by index: duplicate labels are plausible and must not crash. -->
      <DropdownMenuItem
        v-for="(item, index) in items"
        :key="index"
        :class="severityClass(item.severity)"
        :disabled="item.disabled"
        :title="item.disabled ? item.tooltip : undefined"
        @select="item.onClick()"
      >
        <component :is="item.icon" v-if="item.icon" class="h-4 w-4" />
        {{ item.label }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
