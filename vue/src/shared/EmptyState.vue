<script setup lang="ts">
import type { Component } from 'vue';
import { Inbox } from 'lucide-vue-next';

/**
 * The one empty state every table and list uses: a tinted icon, a short message
 * and an optional hint, with a slot for the action that fills the table
 * ("Add role", …).
 *
 *   <EmptyState :icon="UserCog" :message="t('roles.empty')" :hint="t('roles.emptyHint')">
 *     <Button (click)="openAdd()">…</Button>
 *   </EmptyState>
 */
withDefaults(
  defineProps<{
    /** Icon component (lucide). Pick one that matches the table's subject. */
    icon?: Component;
    message: string;
    hint?: string;
  }>(),
  { icon: Inbox },
);
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
    <div class="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint">
      <component :is="icon" class="h-7 w-7 text-brand" />
    </div>
    <p class="text-[0.95rem] font-semibold text-ink">{{ message }}</p>
    <p v-if="hint" class="max-w-sm text-[0.82rem] leading-relaxed text-muted-foreground">
      {{ hint }}
    </p>
    <div class="mt-2 empty:hidden"><slot /></div>
  </div>
</template>
