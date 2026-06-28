<script setup lang="ts">
import { toastState } from '@/composables/useToast';
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 end-4 z-[100] flex flex-col gap-2">
    <div
      v-for="item in toastState.items"
      :key="item.id"
      class="pointer-events-auto max-w-sm rounded-md border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg"
    >
      {{ item.message }}
    </div>
  </div>
</template>
