<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiAdminSettings,
  usePutApiAdminSettings,
  getGetApiAdminSettingsQueryKey,
  useGetApiAdminPredefinedActions,
  usePostApiAdminPredefinedActions,
  usePatchApiAdminPredefinedActionsId,
  useDeleteApiAdminPredefinedActionsId,
  getGetApiAdminPredefinedActionsQueryKey,
  type SettingsResponse,
  type PredefinedActionResponse,
} from '@moamen-ui/pointer-vue';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2 } from 'lucide-vue-next';
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

// ── Predefined actions (tenant-wide) ──────────────────────────────────
const predefinedActionsQuery = useGetApiAdminPredefinedActions();
const tenantActions = computed<PredefinedActionResponse[]>(
  () => (predefinedActionsQuery.data.value ?? []).filter((a: PredefinedActionResponse) => a.projectId == null),
);

interface EditableAction {
  id?: number;
  text: string;
  prompt: string;
  isNew?: boolean;
}
const editableActions = ref<EditableAction[]>([]);

watch(
  tenantActions,
  (actions) => {
    editableActions.value = actions.map((a) => ({
      id: a.id,
      text: a.text ?? '',
      prompt: a.prompt ?? '',
    }));
  },
  { immediate: true },
);

const createPredefined = usePostApiAdminPredefinedActions();
const updatePredefined = usePatchApiAdminPredefinedActionsId();
const deletePredefined = useDeleteApiAdminPredefinedActionsId();

function reloadPredefined() {
  void queryClient.invalidateQueries({ queryKey: getGetApiAdminPredefinedActionsQueryKey() });
}

function addTenantAction() {
  editableActions.value.push({ text: '', prompt: '', isNew: true });
}

async function saveTenantAction(action: EditableAction, index: number) {
  try {
    if (action.isNew || action.id == null) {
      await createPredefined.mutateAsync({
        data: {
          text: action.text,
          prompt: action.prompt,
          isActive: true,
          sortOrder: index,
        },
      });
    } else {
      await updatePredefined.mutateAsync({
        id: action.id,
        data: {
          text: action.text,
          prompt: action.prompt,
        },
      });
    }
    reloadPredefined();
  } catch (e) {
    toast(extractMessage(e));
  }
}

async function deleteTenantAction(action: EditableAction, index: number) {
  if (action.isNew || action.id == null) {
    editableActions.value.splice(index, 1);
    return;
  }
  try {
    await deletePredefined.mutateAsync({ id: action.id });
    reloadPredefined();
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

      <!-- Section: Predefined actions -->
      <Card>
        <CardContent class="flex flex-col gap-4 p-6">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">{{ t('predefined.section') }}</h3>
            <Button type="button" variant="outline" size="sm" @click="addTenantAction">
              <PlusCircle class="h-4 w-4" /> {{ t('predefined.add') }}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">{{ t('predefined.tenantHelp') }}</p>
          <p v-if="editableActions.length === 0" class="text-sm text-muted-foreground italic">
            {{ t('predefined.empty') }}
          </p>
          <div
            v-for="(action, idx) in editableActions"
            :key="idx"
            class="flex flex-col gap-2 rounded-md border p-3"
          >
            <div class="flex flex-col gap-1">
              <Label :for="'pa-text-' + idx">{{ t('predefined.text') }}</Label>
              <Input :id="'pa-text-' + idx" v-model="action.text" />
            </div>
            <div class="flex flex-col gap-1">
              <Label :for="'pa-prompt-' + idx">{{ t('predefined.prompt') }}</Label>
              <textarea
                :id="'pa-prompt-' + idx"
                v-model="action.prompt"
                rows="2"
                class="flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm resize-none"
              />
            </div>
            <div class="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                @click="deleteTenantAction(action, idx)"
              >
                <Trash2 class="h-4 w-4 text-destructive" />
                {{ t('common.delete') }}
              </Button>
              <Button
                type="button"
                size="sm"
                @click="saveTenantAction(action, idx)"
              >
                {{ t('common.save') }}
              </Button>
            </div>
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
