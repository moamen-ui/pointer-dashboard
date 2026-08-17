<script setup lang="ts">
import { ref } from 'vue';
import { useVModel } from '@vueuse/core';
import { Eye, EyeOff } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  defaultValue?: string | number;
  modelValue?: string | number;
  class?: string;
}>();

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void;
}>();

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
});

const { t } = useI18n();
const visible = ref(false);
</script>

<template>
  <div class="relative">
    <Input
      v-bind="$attrs"
      v-model="modelValue"
      :type="visible ? 'text' : 'password'"
      :class="cn('pe-10', props.class)"
    />
    <button
      type="button"
      class="absolute end-0 top-0 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      :aria-label="visible ? t('common.hidePassword') : t('common.showPassword')"
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      <EyeOff v-if="visible" class="h-4 w-4" />
      <Eye v-else class="h-4 w-4" />
    </button>
  </div>
</template>
