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
  useGetApiAdminPredefinedActionSuggestions,
  getGetApiAdminPredefinedActionSuggestionsQueryKey,
  usePostApiAdminPredefinedActionSuggestionsIdApprove,
  usePostApiAdminPredefinedActionSuggestionsIdReject,
  useGetApiAdminAiRulesTenant,
  usePostApiAdminAiRules,
  usePutApiAdminAiRulesId,
  useDeleteApiAdminAiRulesId,
  getGetApiAdminAiRulesTenantQueryKey,
  SuggestionStatus,
  type SettingsResponse,
  type PredefinedActionResponse,
  type SuggestionResponse,
  type AiRuleResponse,
} from '@moamen-ui/pointer-vue';
import { useAuth } from '@/composables/useAuth';
import { AccordionSection } from '@/components/ui/accordion-section';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import FormField from '@/components/shared/FormField.vue';
import { PlusCircle, Trash2 } from 'lucide-vue-next';
import { extractMessage } from '@/lib/error';
import { toast } from '@/composables/useToast';
import { confirm } from '@/composables/useConfirm';

const { t } = useI18n();
const queryClient = useQueryClient();
const { isAdmin, isSuperAdmin } = useAuth();

// Instance-wide settings (Access/Email/Demo) are super-admin only on the backend
// (SettingsController is Policies.SuperAdmin) — skip the fetch entirely for a tenant admin,
// who only reaches this page for the tenant-scoped sections below.
const { data, isError } = useGetApiAdminSettings({ query: { enabled: isSuperAdmin } });
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
const extensionStoreUrl = ref('');
const extensionZipUrl = ref('');

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
    extensionStoreUrl.value = (s as any).extensionStoreUrl ?? '';
    extensionZipUrl.value = (s as any).extensionZipUrl ?? '';
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
        extensionStoreUrl: extensionStoreUrl.value,
        extensionZipUrl: extensionZipUrl.value,
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

type EditableAction = {
  id?: number;
  text: string;
  prompt: string;
  isNew?: boolean;
};
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

// ── Suggestions review (admin-only) ───────────────────────────────────
const suggestionsQuery = useGetApiAdminPredefinedActionSuggestions();
const pendingSuggestions = computed<SuggestionResponse[]>(
  () => ((suggestionsQuery.data.value ?? []) as SuggestionResponse[]).filter(
    (s: SuggestionResponse) => s.status === SuggestionStatus.NUMBER_1,
  ),
);

const approveSuggestion = usePostApiAdminPredefinedActionSuggestionsIdApprove();
const rejectSuggestion = usePostApiAdminPredefinedActionSuggestionsIdReject();

function reloadSuggestions() {
  void queryClient.invalidateQueries({
    queryKey: getGetApiAdminPredefinedActionSuggestionsQueryKey(),
  });
}

async function onApproveSuggestion(s: SuggestionResponse) {
  try {
    await approveSuggestion.mutateAsync({ id: s.id! });
    toast(t('suggestions.approved'));
    reloadSuggestions();
  } catch (e) {
    toast(extractMessage(e));
  }
}

async function onRejectSuggestion(s: SuggestionResponse) {
  try {
    await rejectSuggestion.mutateAsync({ id: s.id! });
    toast(t('suggestions.rejected'));
    reloadSuggestions();
  } catch (e) {
    toast(extractMessage(e));
  }
}

// ── Workspace AI Rules (tenant-wide, admins/deputies only) ─────────────
type EditableTenantAiRule = {
  id?: number;
  title: string;
  prompt: string;
  isActive: boolean;
  dirty?: boolean;
  saving?: boolean;
};

const tenantRulesQuery = useGetApiAdminAiRulesTenant({
  query: { enabled: computed(() => !isSuperAdmin.value) },
});
const tenantRules = computed<AiRuleResponse[]>(() => tenantRulesQuery.data.value ?? []);
const editableTenantRules = ref<EditableTenantAiRule[]>([]);
const rulesSeeded = ref(false);

watch(
  tenantRules,
  (rules) => {
    if (!rulesSeeded.value) {
      editableTenantRules.value = rules.map((r) => ({
        id: r.id,
        title: r.title ?? '',
        prompt: r.prompt ?? '',
        isActive: r.isActive ?? true,
        dirty: false,
        saving: false,
      }));
    }
  },
  { immediate: true },
);

function markTenantRuleDirty(rule: EditableTenantAiRule, field: 'title' | 'prompt' | 'isActive', val: any) {
  (rule as any)[field] = val;
  rule.dirty = true;
  rulesSeeded.value = true;
}

const updateTenantRuleMutation = usePutApiAdminAiRulesId();
const deleteTenantRuleMutation = useDeleteApiAdminAiRulesId();
const createTenantRuleMutation = usePostApiAdminAiRules();

async function saveTenantRule(rule: EditableTenantAiRule) {
  if (!rule.id) return;
  rule.saving = true;
  try {
    await updateTenantRuleMutation.mutateAsync({
      id: rule.id,
      data: {
        title: rule.title,
        prompt: rule.prompt,
        isActive: rule.isActive,
      },
    });
    rule.dirty = false;
    rule.saving = false;
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminAiRulesTenantQueryKey() });
  } catch (e) {
    rule.saving = false;
    toast(extractMessage(e));
  }
}

async function deleteTenantRule(rule: EditableTenantAiRule) {
  if (!rule.id) return;
  const ok = await confirm({
    message: `${t('aiRules.delete')}?`,
    confirmLabel: t('common.delete'),
    confirmVariant: 'destructive',
  });
  if (!ok) return;
  try {
    await deleteTenantRuleMutation.mutateAsync({ id: rule.id });
    rulesSeeded.value = false;
    editableTenantRules.value = editableTenantRules.value.filter((r) => r.id !== rule.id);
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminAiRulesTenantQueryKey() });
  } catch (e) {
    toast(extractMessage(e));
  }
}

const newTenantRuleTitle = ref('');
const newTenantRulePrompt = ref('');
const newTenantRuleBusy = ref(false);

async function createTenantRule() {
  const title = newTenantRuleTitle.value.trim();
  const prompt = newTenantRulePrompt.value.trim();
  if (!title || !prompt) return;
  newTenantRuleBusy.value = true;
  try {
    await createTenantRuleMutation.mutateAsync({
      data: {
        title,
        prompt,
        sortOrder: tenantRules.value.length,
      },
    });
    newTenantRuleBusy.value = false;
    newTenantRuleTitle.value = '';
    newTenantRulePrompt.value = '';
    rulesSeeded.value = false;
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminAiRulesTenantQueryKey() });
  } catch (e) {
    newTenantRuleBusy.value = false;
    toast(extractMessage(e));
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em] mb-2">
      {{ t('settings.title') }}
    </h1>

    <p v-if="isSuperAdmin && isError" class="text-[14px] text-state-danger">
      {{ t('settings.loadError') }}
    </p>

    <template v-if="settings || !isError">
      <!-- Instance-wide settings (Access/Email/Demo) are super-admin only on the backend
           (SettingsController is Policies.SuperAdmin) — hidden for a tenant admin, who only
           reaches this page for the tenant-scoped sections below. -->
    <template v-if="isSuperAdmin">
      <!-- Section: Access -->
      <AccordionSection :title="t('settings.accessSection')" default-open>
        <template #default>
          <div class="space-y-4 border-t border-border-muted pt-4">
            <!-- Signup toggle -->
            <div class="flex items-center justify-between gap-4">
              <div class="flex flex-col gap-1.5">
                <Label class="text-[13px] font-medium text-foreground">{{ t('settings.signupEnabled') }}</Label>
                <p class="text-[12px] text-muted-foreground max-w-[72ch]">{{ t('settings.signupEnabledDesc') }}</p>
              </div>
              <Switch
                :model-value="signupEnabled"
                :disabled="updateSettings.isPending.value"
                @update:model-value="(v: boolean) => { signupEnabled = v; }"
              />
            </div>
          </div>
          <div class="mt-4 flex justify-end border-t border-border-muted pt-4">
            <Button :disabled="updateSettings.isPending.value" @click="saveSettings">
              {{ t('settings.save') }}
            </Button>
          </div>
        </template>
      </AccordionSection>

      <!-- Section: Email -->
      <AccordionSection :title="t('settings.emailSection')">
        <template #default>
          <div class="space-y-4 border-t border-border-muted pt-4">
            <!-- emailEnabled -->
            <div class="flex items-center justify-between gap-4">
              <div class="flex flex-col gap-1.5">
                <Label class="text-[13px] font-medium text-foreground">{{ t('settings.emailEnabled') }}</Label>
                <p class="text-[12px] text-muted-foreground max-w-[72ch]">{{ t('settings.emailEnabledHint') }}</p>
              </div>
              <Switch
                :model-value="emailEnabled"
                :disabled="updateSettings.isPending.value"
                @update:model-value="(v: boolean) => { emailEnabled = v; }"
              />
            </div>

            <!-- emailFromEmail -->
            <FormField :label="t('settings.emailFrom')" html-for="email-from" :hint="t('settings.emailFromHint')">
              <Input id="email-from" v-model="emailFromEmail" type="email" />
            </FormField>

            <!-- emailFromName -->
            <FormField :label="t('settings.emailFromName')" html-for="email-from-name" :hint="t('settings.emailFromNameHint')">
              <Input id="email-from-name" v-model="emailFromName" />
            </FormField>

            <!-- emailDailyCap -->
            <FormField :label="t('settings.emailDailyCap')" html-for="email-daily-cap" :hint="t('settings.emailDailyCapHint')">
              <Input id="email-daily-cap" v-model.number="emailDailyCap" type="number" :min="1" />
            </FormField>

            <!-- API key status (read-only) -->
            <div class="flex flex-col gap-1.5">
              <Label class="text-[13px] font-medium text-foreground">{{ t('settings.emailApiKey') }}</Label>
              <p class="text-[12px] text-muted-foreground max-w-[72ch]">{{ t('settings.emailApiKeyHint') }}</p>
              <p class="text-[14px] mt-1.5">
                <span v-if="(settings as any)?.emailApiKeyConfigured" class="text-state-completed font-medium">
                  ✓ {{ t('settings.emailApiKeyConfigured') }}
                </span>
                <span v-else class="text-state-danger font-medium">
                  ✗ {{ t('settings.emailApiKeyMissing') }}
                </span>
              </p>
            </div>
          </div>
          <div class="mt-4 flex justify-end border-t border-border-muted pt-4">
            <Button :disabled="updateSettings.isPending.value" @click="saveSettings">
              {{ t('settings.save') }}
            </Button>
          </div>
        </template>
      </AccordionSection>

      <!-- Section: Demo -->
      <AccordionSection :title="t('settings.demoSection')">
        <template #default>
          <div class="space-y-4 border-t border-border-muted pt-4">
            <!-- demoMaxActive -->
            <FormField :label="t('settings.demoMaxActive')" html-for="demo-max-active" :hint="t('settings.demoMaxActiveHint')">
              <Input id="demo-max-active" v-model.number="demoMaxActive" type="number" :min="1" />
            </FormField>

            <!-- demoTtlHours -->
            <FormField :label="t('settings.demoTtlHours')" html-for="demo-ttl-hours" :hint="t('settings.demoTtlHoursHint')">
              <Input id="demo-ttl-hours" v-model.number="demoTtlHours" type="number" :min="1" />
            </FormField>

            <!-- demoPerEmailPerDay -->
            <FormField :label="t('settings.demoPerEmailPerDay')" html-for="demo-per-email" :hint="t('settings.demoPerEmailPerDayHint')">
              <Input id="demo-per-email" v-model.number="demoPerEmailPerDay" type="number" :min="1" />
            </FormField>

            <!-- demoCommentCap -->
            <FormField :label="t('settings.demoCommentCap')" html-for="demo-comment-cap" :hint="t('settings.demoCommentCapHint')">
              <Input id="demo-comment-cap" v-model.number="demoCommentCap" type="number" :min="1" />
            </FormField>
          </div>
          <div class="mt-4 flex justify-end border-t border-border-muted pt-4">
            <Button :disabled="updateSettings.isPending.value" @click="saveSettings">
              {{ t('settings.save') }}
            </Button>
          </div>
        </template>
      </AccordionSection>

      <!-- Section: Extension -->
      <AccordionSection :title="t('settings.extensionSection')">
        <template #default>
          <div class="space-y-4 border-t border-border-muted pt-4">
            <!-- extensionStoreUrl -->
            <FormField :label="t('settings.extensionStoreUrl')" html-for="extension-store-url" :hint="t('settings.extensionStoreUrlHint')">
              <Input id="extension-store-url" v-model="extensionStoreUrl" />
            </FormField>

            <!-- extensionZipUrl -->
            <FormField :label="t('settings.extensionZipUrl')" html-for="extension-zip-url" :hint="t('settings.extensionZipUrlHint')">
              <Input id="extension-zip-url" v-model="extensionZipUrl" />
            </FormField>
          </div>
          <div class="mt-4 flex justify-end border-t border-border-muted pt-4">
            <Button :disabled="updateSettings.isPending.value" @click="saveSettings">
              {{ t('settings.save') }}
            </Button>
          </div>
        </template>
      </AccordionSection>
    </template>

      <!-- Section: Predefined actions -->
      <AccordionSection>
        <template #title>{{ t('predefined.section') }}</template>
        <template #default>
          <div class="space-y-4 border-t border-border-muted pt-4">
            <div class="flex items-center justify-between gap-4">
              <p class="text-[12px] text-muted-foreground max-w-[72ch]">{{ t('predefined.tenantHelp') }}</p>
              <Button type="button" variant="secondary" size="sm" @click="addTenantAction">
                <PlusCircle class="h-4 w-4" />
                {{ t('predefined.add') }}
              </Button>
            </div>

            <p v-if="editableActions.length === 0" class="text-[14px] text-muted-foreground italic">
              {{ t('predefined.empty') }}
            </p>

            <div v-if="editableActions.length > 0" class="rounded-md border border-border overflow-hidden">
              <div
                v-for="(action, idx) in editableActions"
                :key="idx"
                class="space-y-3 border-t border-border-muted first:border-t-0 px-4 py-4"
              >
                <FormField :label="t('predefined.text')" :html-for="'pa-text-' + idx">
                  <Input :id="'pa-text-' + idx" v-model="action.text" />
                </FormField>
                <FormField :label="t('predefined.prompt')" :html-for="'pa-prompt-' + idx">
                  <textarea
                    :id="'pa-prompt-' + idx"
                    v-model="action.prompt"
                    rows="2"
                    class="flex w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] font-sans resize-none"
                  />
                </FormField>
                <div class="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    @click="deleteTenantAction(action, idx)"
                  >
                    <Trash2 class="h-4 w-4" />
                    {{ t('common.delete') }}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    @click="saveTenantAction(action, idx)"
                  >
                    {{ t('common.save') }}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </AccordionSection>

      <!-- Section: Prompt suggestions review (admin-only) -->
      <AccordionSection v-if="isAdmin">
        <!-- Pending count stays in the header so it is visible while collapsed. -->
        <template #title>
          {{ t('suggestions.section') }}
          <span
            v-if="pendingSuggestions.length > 0"
            class="ms-2 inline-flex h-6 items-center gap-1 rounded-full bg-state-ready px-2 text-[12px] font-medium leading-none text-state-ready"
          >
            {{ pendingSuggestions.length }}
          </span>
        </template>
        <template #default>
          <div class="border-t border-border-muted pt-4">
            <p v-if="suggestionsQuery.isLoading.value" class="text-[14px] text-muted-foreground">…</p>
            <p v-else-if="pendingSuggestions.length === 0" class="text-[14px] text-muted-foreground italic">
              {{ t('suggestions.empty') }}
            </p>
            <div v-else class="rounded-md border border-border overflow-hidden">
              <div
                v-for="s in pendingSuggestions"
                :key="s.id"
                class="space-y-3 border-t border-border-muted first:border-t-0 px-4 py-4"
              >
                <div class="flex flex-wrap items-center gap-1 text-[12px] text-muted-foreground">
                  <span>{{ t('suggestions.project') }}: <span class="font-medium text-foreground">{{ s.projectName ?? s.projectKey }}</span></span>
                  <span class="text-faint-foreground">·</span>
                  <span>{{ t('suggestions.by') }}: <span class="font-medium text-foreground">{{ s.suggestedByName }}</span></span>
                </div>
                <div class="flex flex-col gap-1">
                  <p class="text-[14px] font-medium">{{ s.text }}</p>
                  <p class="text-[13px] text-muted-foreground whitespace-pre-wrap">{{ s.prompt }}</p>
                </div>
                <div class="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    :disabled="rejectSuggestion.isPending.value"
                    @click="onRejectSuggestion(s)"
                  >
                    {{ t('suggestions.reject') }}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    :disabled="approveSuggestion.isPending.value"
                    @click="onApproveSuggestion(s)"
                  >
                    {{ t('suggestions.approve') }}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </AccordionSection>

      <!-- Section: AI Roles & Rules (tenant-wide, workspace admins/deputies only) -->
      <AccordionSection v-if="!isSuperAdmin">
        <template #title>
          <span>{{ t('aiRules.section') }}</span>
        </template>
        <template #default>
          <div class="space-y-4 border-t border-border-muted pt-4">
            <p class="text-[12px] text-muted-foreground max-w-[72ch]">{{ t('aiRules.tenantHelp') }}</p>

            <p v-if="tenantRulesQuery.isLoading.value" class="text-[14px] text-muted-foreground">…</p>
            <p v-else-if="editableTenantRules.length === 0" class="text-[14px] text-muted-foreground italic">
              {{ t('aiRules.empty') }}
            </p>

            <div v-if="editableTenantRules.length > 0" class="rounded-md border border-border overflow-hidden">
              <div
                v-for="(rule, idx) in editableTenantRules"
                :key="rule.id ?? idx"
                class="space-y-3 border-t border-border-muted first:border-t-0 px-4 py-4"
              >
                <FormField :label="t('aiRules.titleLabel')" :html-for="'tr-title-' + (rule.id ?? idx)">
                  <Input
                    :id="'tr-title-' + (rule.id ?? idx)"
                    :model-value="rule.title"
                    @update:model-value="(val) => markTenantRuleDirty(rule, 'title', String(val))"
                  />
                </FormField>

                <FormField :label="t('aiRules.promptLabel')" :html-for="'tr-prompt-' + (rule.id ?? idx)">
                  <textarea
                    :id="'tr-prompt-' + (rule.id ?? idx)"
                    :value="rule.prompt"
                    rows="2"
                    class="flex w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] font-sans resize-none"
                    @input="(e) => markTenantRuleDirty(rule, 'prompt', (e.target as HTMLTextAreaElement).value)"
                  />
                </FormField>

                <div class="flex items-center justify-between gap-4 pt-2">
                  <div class="flex items-center gap-3">
                    <Label :for="'tr-active-' + (rule.id ?? idx)" class="text-[12px] text-muted-foreground">
                      {{ t(rule.isActive ? 'common.active' : 'common.disabled') }}
                    </Label>
                    <Switch
                      :id="'tr-active-' + (rule.id ?? idx)"
                      :checked="rule.isActive"
                      @update:checked="(val: boolean) => markTenantRuleDirty(rule, 'isActive', val)"
                    />
                  </div>
                  <div class="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      :disabled="rule.saving"
                      @click="deleteTenantRule(rule)"
                    >
                      <Trash2 class="h-4 w-4" />
                      {{ t('common.delete') }}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      :disabled="!rule.dirty || rule.saving"
                      @click="saveTenantRule(rule)"
                    >
                      {{ t('common.save') }}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Add new rule inline form -->
            <div class="mt-4 space-y-3 rounded-md border border-border bg-background p-4">
              <span class="text-[13px] font-medium text-foreground">{{ t('aiRules.addRule') }}</span>
              <FormField :label="t('aiRules.titleLabel')" html-for="new-tr-title">
                <Input
                  id="new-tr-title"
                  v-model="newTenantRuleTitle"
                  :placeholder="t('aiRules.titlePlaceholder')"
                />
              </FormField>
              <FormField :label="t('aiRules.promptLabel')" html-for="new-tr-prompt">
                <textarea
                  id="new-tr-prompt"
                  v-model="newTenantRulePrompt"
                  rows="2"
                  :placeholder="t('aiRules.promptPlaceholder')"
                  class="flex w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] font-sans resize-none"
                />
              </FormField>
              <div class="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  :disabled="newTenantRuleBusy || !newTenantRuleTitle.trim() || !newTenantRulePrompt.trim()"
                  @click="createTenantRule"
                >
                  <PlusCircle class="h-4 w-4" />
                  {{ t('aiRules.addRule') }}
                </Button>
              </div>
            </div>
          </div>
        </template>
      </AccordionSection>
    </template>
  </div>
</template>
