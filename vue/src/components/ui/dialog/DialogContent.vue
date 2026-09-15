<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  type DialogContentEmits,
  type DialogContentProps,
  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits,
} from 'reka-ui';
import { X } from 'lucide-vue-next';
import { cn } from '@/lib/utils';

const props = defineProps<DialogContentProps & { class?: string }>();
const emits = defineEmits<DialogContentEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogContent
      v-bind="forwarded"
      :class="
        cn(
          'fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-card p-6 shadow-dialog duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          // Below md: a bottom-anchored full-width sheet instead of a centered
          // box. inset-x-0/bottom-0/top-auto/translate-none are a distinct
          // variant group from the centered classes above, so they win at
          // this breakpoint without touching the desktop values (a per-page
          // `class` override — e.g. a narrower max-w-[440px] — is also a
          // different group and keeps applying at md and up). The sheet
          // itself scrolls as one region (header/footer float via their own
          // sticky classes below) so long forms never get clipped.
          'max-md:inset-x-0 max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:top-auto max-md:w-full max-md:max-w-full max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-xl max-md:max-h-[85dvh] max-md:overflow-y-auto max-md:data-[state=closed]:slide-out-to-bottom max-md:data-[state=open]:slide-in-from-bottom',
          props.class,
        )
      "
    >
      <slot />

      <DialogClose
        class="absolute end-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
      >
        <X class="h-4 w-4" />
        <span class="sr-only">Close</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
