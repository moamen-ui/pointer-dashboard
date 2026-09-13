<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'reka-ui';
import { LoaderCircle } from 'lucide-vue-next';
import { cn } from '@/lib/utils';
import { buttonVariants, type ButtonVariants } from '.';

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant'];
  size?: ButtonVariants['size'];
  class?: string;
  /** Replaces the leading icon with a 16px spinner and sets aria-busy (DESIGN.md's Buttons
   *  spec). Purely visual — the caller still controls `disabled` explicitly. No-op with asChild. */
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  loading: false,
});
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), props.class)"
    :aria-busy="loading || undefined"
  >
    <LoaderCircle v-if="loading && !asChild" class="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
    <slot />
  </Primitive>
</template>
