<script setup lang="ts">
import { Label } from '@/components/ui/label';

// Centralizes the app's hand-rolled field convention (Label + input + error/hint
// paragraph) so a page can no longer forget the error display. Matches the exact
// markup pages used to roll by hand: <p class="text-sm text-destructive"> for
// errors, <p class="text-sm text-muted-foreground"> for hints; error wins when
// both are set. The input itself is the default slot, so PasswordInput's
// self-contained show/hide toggle needs no extra wiring.
//
// Validation state stays in the page (ref + computed): pass the resolved error
// string in — this component never owns validators. Angular parity note: the
// cross-field password-mismatch message deliberately stays OUT of this wrapper
// (it belongs to a field pair, not one field) — pages render it as a separate
// paragraph below both FormFields.
defineProps<{
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
}>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <Label :for="htmlFor">{{ label }}</Label>
    <slot />
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    <p v-else-if="hint" class="text-sm text-muted-foreground">{{ hint }}</p>
  </div>
</template>
