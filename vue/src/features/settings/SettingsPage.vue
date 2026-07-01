<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiAdminSettings,
  usePutApiAdminSettings,
  getGetApiAdminSettingsQueryKey,
  type SettingsResponse,
} from '@moamen-ui/pointer-vue';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { extractMessage } from '@/lib/error';
import { toast } from '@/composables/useToast';

const { t } = useI18n();
const queryClient = useQueryClient();

const { data, isError } = useGetApiAdminSettings();
// The interceptor unwraps the envelope at runtime; data.value IS SettingsResponse.
// Bridge the TS type mismatch with a cast (mirrors the React dashboard pattern).
const settings = computed(() => data.value as unknown as SettingsResponse | undefined);

const updateSettings = usePutApiAdminSettings();

// Local reactive form state seeded from server data.
const signupEnabled = ref(false);
const emailEnabled = ref(false);
const emailFromEmail = ref('');
const emailFromName = ref('');
const emailDailyCap = ref<number>(300);
const demoMaxActive = ref<number>(10);
const demoTtlHours = ref<number>(48);
const demoPerEmailPerDay = ref<number>(3);
const demoCommentCap = ref<number>(20);

watch(
  settings,
  (s) => {
    if (!s) return;
    signupEnabled.value = (s as any).scopedAdminSignupEnabled ?? false;
    emailEnabled.value = (s as any).emailEnabled ?? false;
    emailFromEmail.value = (s as any).emailFromEmail ?? '';
    emailFromName.value = (s as any).emailFromName ?? '';
    emailDailyCap.value = (s as any).emailDailyCap ?? 300;
    demoMaxActive.value = (s as any).demoMaxActive ?? 10;
    demoTtlHours.value = (s as any).demoTtlHours ?? 48;
    demoPerEmailPerDay.value = (s as any).demoPerEmailPerDay ?? 3;
    demoCommentCap.value = (s as any).demoCommentCap ?? 20;
  },
  { immediate: true },
);

async function saveSettings() {
  try {
    await updateSettings.mutateAsync({
      data: {
        scopedAdminSignupEnabled: signupEnabled.value,
        emailEnabled: emailEnabled.value,
        emailFromEmail: emailFromEmail.value,
        emailFromName: emailFromName.value,
        emailDailyCap: emailDailyCap.value,
        demoMaxActive: demoMaxActive.value,
        demoTtlHours: demoTtlHours.value,
        demoPerEmailPerDay: demoPerEmailPerDay.value,
        demoCommentCap: demoCommentCap.value,
      } as any,
    });
    toast(t('settings.saved'));
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminSettingsQueryKey() });
  } catch (e) {
    toast(extractMessage(e));
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.title') }}</h2>

    <p v-if="isError" class="text-sm text-destructive">{{ t('settings.loadError') }}</p>

    <template v-if="settings || !isError">
      <!-- Section: Access -->
      <Card>
        <CardContent class="flex flex-col gap-6 p-6">
          <h3 class="text-sm font-semibold">{{ t('settings.accessSection') }}</h3>
          <!-- Signup toggle -->
          <div class="flex items-center justify-between gap-4">
            <div class="flex flex-col gap-1">
              <Label class="text-sm font-medium">{{ t('settings.signupEnabled') }}</Label>
              <p class="text-xs text-muted-foreground">{{ t('settings.signupEnabledDesc') }}</p>
            </div>
            <Switch
              :model-value="signupEnabled"
              :disabled="updateSettings.isPending.value"
              @update:model-value="(v: boolean) => { signupEnabled = v; }"
            />
          </div>
        </CardContent>
      </Card>

      <!-- Section: Email -->
      <Card>
        <CardContent class="flex flex-col gap-6 p-6">
          <h3 class="text-sm font-semibold">{{ t('settings.emailSection') }}</h3>

          <!-- emailEnabled -->
          <div class="flex items-center justify-between gap-4">
            <div class="flex flex-col gap-1">
              <Label class="text-sm font-medium">{{ t('settings.emailEnabled') }}</Label>
              <p class="text-xs text-muted-foreground">{{ t('settings.emailEnabledHint') }}</p>
            </div>
            <Switch
              :model-value="emailEnabled"
              :disabled="updateSettings.isPending.value"
              @update:model-value="(v: boolean) => { emailEnabled = v; }"
            />
          </div>

          <!-- emailFromEmail -->
          <div class="flex flex-col gap-2">
            <Label for="email-from" class="text-sm font-medium">{{ t('settings.emailFrom') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.emailFromHint') }}</p>
            <Input id="email-from" v-model="emailFromEmail" type="email" />
          </div>

          <!-- emailFromName -->
          <div class="flex flex-col gap-2">
            <Label for="email-from-name" class="text-sm font-medium">{{ t('settings.emailFromName') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.emailFromNameHint') }}</p>
            <Input id="email-from-name" v-model="emailFromName" />
          </div>

          <!-- emailDailyCap -->
          <div class="flex flex-col gap-2">
            <Label for="email-daily-cap" class="text-sm font-medium">{{ t('settings.emailDailyCap') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.emailDailyCapHint') }}</p>
            <Input id="email-daily-cap" v-model.number="emailDailyCap" type="number" :min="1" />
          </div>

          <!-- API key status (read-only) -->
          <div class="flex flex-col gap-1">
            <Label class="text-sm font-medium">{{ t('settings.emailApiKey') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.emailApiKeyHint') }}</p>
            <p class="text-sm mt-1">
              <span v-if="(settings as any)?.emailApiKeyConfigured" class="text-green-600 font-medium">
                ✓ {{ t('settings.emailApiKeyConfigured') }}
              </span>
              <span v-else class="text-destructive font-medium">
                ✗ {{ t('settings.emailApiKeyMissing') }}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- Section: Demo -->
      <Card>
        <CardContent class="flex flex-col gap-6 p-6">
          <h3 class="text-sm font-semibold">{{ t('settings.demoSection') }}</h3>

          <!-- demoMaxActive -->
          <div class="flex flex-col gap-2">
            <Label for="demo-max-active" class="text-sm font-medium">{{ t('settings.demoMaxActive') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.demoMaxActiveHint') }}</p>
            <Input id="demo-max-active" v-model.number="demoMaxActive" type="number" :min="1" />
          </div>

          <!-- demoTtlHours -->
          <div class="flex flex-col gap-2">
            <Label for="demo-ttl-hours" class="text-sm font-medium">{{ t('settings.demoTtlHours') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.demoTtlHoursHint') }}</p>
            <Input id="demo-ttl-hours" v-model.number="demoTtlHours" type="number" :min="1" />
          </div>

          <!-- demoPerEmailPerDay -->
          <div class="flex flex-col gap-2">
            <Label for="demo-per-email" class="text-sm font-medium">{{ t('settings.demoPerEmailPerDay') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.demoPerEmailPerDayHint') }}</p>
            <Input id="demo-per-email" v-model.number="demoPerEmailPerDay" type="number" :min="1" />
          </div>

          <!-- demoCommentCap -->
          <div class="flex flex-col gap-2">
            <Label for="demo-comment-cap" class="text-sm font-medium">{{ t('settings.demoCommentCap') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.demoCommentCapHint') }}</p>
            <Input id="demo-comment-cap" v-model.number="demoCommentCap" type="number" :min="1" />
          </div>
        </CardContent>
      </Card>

      <!-- Save button -->
      <div class="flex justify-end">
        <Button :disabled="updateSettings.isPending.value" @click="saveSettings">
          {{ t('settings.save') }}
        </Button>
      </div>
    </template>
  </div>
</template>
