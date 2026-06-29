<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiAdminSettings,
  usePutApiAdminSettings,
  getGetApiAdminSettingsQueryKey,
} from '@moamen-ui/pointer-vue';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { extractMessage } from '@/lib/error';
import { toast } from '@/composables/useToast';

const { t } = useI18n();
const queryClient = useQueryClient();

const { data, isError } = useGetApiAdminSettings();
const settings = computed(() => data.value);

const updateSettings = usePutApiAdminSettings();

// Local reactive copy so the toggle is instant.
const signupEnabled = ref(false);

watch(
  settings,
  (s) => {
    if (s) signupEnabled.value = s.scopedAdminSignupEnabled ?? false;
  },
  { immediate: true },
);

async function toggleSignup(val: boolean) {
  signupEnabled.value = val;
  try {
    await updateSettings.mutateAsync({ data: { scopedAdminSignupEnabled: val } });
    toast(t('settings.saved'));
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminSettingsQueryKey() });
  } catch (e) {
    // Revert on error
    signupEnabled.value = !val;
    toast(extractMessage(e));
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.title') }}</h2>

    <p v-if="isError" class="text-sm text-destructive">{{ t('settings.loadError') }}</p>

    <Card v-if="settings || !isError">
      <CardContent class="flex flex-col gap-6 p-6">
        <!-- Signup toggle -->
        <div class="flex items-center justify-between gap-4">
          <div class="flex flex-col gap-1">
            <Label class="text-sm font-medium">{{ t('settings.signupEnabled') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.signupEnabledDesc') }}</p>
          </div>
          <Switch
            :model-value="signupEnabled"
            :disabled="updateSettings.isPending.value"
            @update:model-value="(v: boolean) => toggleSignup(v)"
          />
        </div>
      </CardContent>
    </Card>
  </div>
</template>
