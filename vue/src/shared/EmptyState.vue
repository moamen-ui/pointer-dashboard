<script setup lang="ts">
import { computed, defineAsyncComponent, ref, shallowRef, watchEffect } from 'vue';
import type { Component } from 'vue';
import { useI18n } from 'vue-i18n';

// Both the player and the per-variant JSON are loaded lazily, on demand, so the
// ~600 KB lottie-web runtime + all three animation payloads never land in the
// initial bundle — only whichever variant actually renders fetches its data,
// and the player chunk loads in parallel with it the first time any
// EmptyState mounts.
const LottieAnimation = defineAsyncComponent(() => import('lottie-web-vue'));

type Variant = 'empty' | 'no-results' | 'error';

const animationLoaders: Record<Variant, () => Promise<{ default: Record<string, unknown> }>> = {
  empty: () => import('@/assets/lottie/empty.json'),
  'no-results': () => import('@/assets/lottie/no-results.json'),
  error: () => import('@/assets/lottie/error.json'),
};

/**
 * The one empty state every table and section uses: an inlined illustration
 * (picked by `variant`), a message + optional hint beside it, and a trailing
 * slot for the action that fills the gap ("Add role", "Clear search", "Try
 * again", …).
 *
 * `message`/`hint` are OPTIONAL — a caller-supplied value always wins; when
 * omitted, `variant="empty"` falls back to `table.emptyDefault` (no hint) and
 * `variant="error"` falls back to `table.error` + `table.errorHint`.
 * `variant="no-results"` has no fallback — the caller always passes the
 * query-aware string (e.g. `table.noResultsFor`).
 *
 *   <EmptyState :message="t('roles.empty')" :hint="t('roles.emptyHint')">
 *     <Button @click="openAdd()">Add role</Button>
 *   </EmptyState>
 *
 *   <EmptyState variant="error" :message="error" @retry rendered via slot>
 *     <Button @click="retry">{{ t('table.retry') }}</Button>
 *   </EmptyState>
 */
const props = withDefaults(
  defineProps<{
    variant?: 'empty' | 'no-results' | 'error';
    message?: string;
    hint?: string;
    /** Back-compat no-op: older call sites passed a lucide icon for the abandoned
     *  icon-in-circle layout. The illustration is now picked by `variant` alone. */
    icon?: Component;
  }>(),
  { variant: 'empty' },
);

const { t } = useI18n();

// null while the variant's JSON is (still) loading — the placeholder box stays
// the same size either way, so nothing reflows once it resolves.
const animationData = shallowRef<Record<string, unknown> | null>(null);

watchEffect((onCleanup) => {
  const variant = props.variant;
  let cancelled = false;
  onCleanup(() => {
    cancelled = true;
  });
  animationData.value = null;
  animationLoaders[variant]().then((mod) => {
    if (!cancelled) animationData.value = mod.default;
  });
});

// Lottie ignores the CSS-level prefers-reduced-motion rule that covered the old
// SVGs, so the loop/autoplay have to be gated here: reduced motion renders the
// animation stopped on its first frame instead of looping.
const prefersReducedMotion = ref(
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false,
);

const resolvedMessage = computed(() => {
  if (props.message) return props.message;
  if (props.variant === 'error') return t('table.error');
  if (props.variant === 'empty') return t('table.emptyDefault');
  return '';
});

const resolvedHint = computed(() => {
  if (props.hint) return props.hint;
  return props.variant === 'error' ? t('table.errorHint') : '';
});
</script>

<template>
  <!-- Comment #193: the illustration leads, big, with the copy stacked underneath it and the
       action last — never side-by-side. The animations are square (256², 320², 75²), so the box
       is square too; the old 120x72 letterboxed them down to an effective 72px. -->
  <div class="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
    <div class="lottie-illus shrink-0" aria-hidden="true">
      <component
        :is="LottieAnimation"
        v-if="animationData"
        :animation-data="animationData"
        :loop="!prefersReducedMotion"
        :auto-play="!prefersReducedMotion"
      />
    </div>

    <div class="min-w-0 max-w-sm" :role="variant === 'error' ? 'alert' : undefined">
      <p class="text-[14px] text-muted-foreground">{{ resolvedMessage }}</p>
      <p v-if="resolvedHint" class="mt-1 text-[13px] leading-relaxed text-faint-foreground">
        {{ resolvedHint }}
      </p>
    </div>

    <div class="shrink-0 empty:hidden"><slot /></div>
  </div>
</template>

<style scoped>
/* Same footprint the inline SVG illustrations used to occupy (was `.ds-illus`
 * in foundation.css) — kept local since the Lottie player replaces that
 * markup only in this component, not the shared stylesheet. */
.lottie-illus {
  display: block;
  width: 160px;
  height: 160px;
  flex: none;
  overflow: visible;
}

.lottie-illus :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
