<script setup lang="ts">
import { CircleAlert } from 'lucide-vue-next';
import { Label } from '@/components/ui/label';

// Centralizes the app's field convention (Label + input + error/hint paragraph) so a page can no
// longer forget the error display. The input itself is the default slot, so PasswordInput's
// self-contained show/hide toggle needs no extra wiring.
//
// Validation state stays in the page (ref + computed): pass the resolved error
// string in — this component never owns validators. Angular parity note: the
// cross-field password-mismatch message deliberately stays OUT of this wrapper
// (it belongs to a field pair, not one field) — pages render it as a separate
// paragraph below both FormFields.
//
// `gap-2` (8px) on the flex column is the ONE place that sets the label-to-input gap and the
// input-to-hint/error gap in this app — it matches React's FormField.tsx and Angular's
// AppFormFieldComponent exactly. Change it here (and mirror in the other two) to move the gap
// everywhere a field uses this wrapper; never add a per-field margin override in a page.
//
// Error/hint typography matches DESIGN.md's Inputs/Fields spec exactly (and Angular's
// AppFormFieldComponent): 12px hint in muted-foreground, 12px error in state-danger (the fixed
// diff hue, not the `destructive` button token — they are different hexes) with a 12px alert
// glyph. Every field of every control type routes through this wrapper; a hand-rolled label next
// to a control is a bug, not a customization.
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
    <p v-if="error" class="text-[12px] text-state-danger flex items-center gap-1">
      <CircleAlert class="h-3 w-3 shrink-0" aria-hidden="true" />
      {{ error }}
    </p>
    <p v-else-if="hint" class="text-[12px] text-muted-foreground">{{ hint }}</p>
  </div>
</template>
