<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiAiRulesProjectKey,
  getGetApiAiRulesProjectKeyQueryKey,
  usePostApiAdminAiRules,
  usePutApiAdminAiRulesId,
  useDeleteApiAdminAiRulesId,
  usePostApiAiRulesMy,
  usePutApiAiRulesMyId,
  useDeleteApiAiRulesMyId,
  type ProjectResponse,
  type ProjectAiRulesResponse,
  type AiRuleResponse,
} from '@moamen-ui/pointer-vue';
import { PlusCircle, Trash2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import FormField from '@/components/shared/FormField.vue';
import { extractMessage } from '@/lib/error';
import { confirm } from '@/composables/useConfirm';
import { toast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';

type ProjectAiRulesProps = {
  project: ProjectResponse;
  canEdit?: boolean;
};

const props = withDefaults(defineProps<ProjectAiRulesProps>(), {
  canEdit: false,
});

const { t } = useI18n();
const queryClient = useQueryClient();
const { isAdmin } = useAuth();

const projectKey = computed(() => props.project.key ?? '');
const { data: rulesData, isLoading } = useGetApiAiRulesProjectKey(projectKey);

const projectAiRules = computed<ProjectAiRulesResponse | undefined>(
  () => rulesData.value as unknown as ProjectAiRulesResponse | undefined,
);

const rawAdminRules = computed<AiRuleResponse[]>(() => projectAiRules.value?.adminRules ?? []);
const rawMyRules = computed<AiRuleResponse[]>(() => projectAiRules.value?.myRules ?? []);

type EditableRuleItem = {
  id?: number;
  projectId?: number | null;
  title: string;
  prompt: string;
  isActive: boolean;
  isInherited?: boolean;
  isPersonal?: boolean;
  dirty?: boolean;
  saving?: boolean;
};

const adminRulesSeeded = ref(false);
const editableAdminRules = ref<EditableRuleItem[]>([]);

const myRulesSeeded = ref(false);
const editableMyRules = ref<EditableRuleItem[]>([]);

watch(
  rawAdminRules,
  (rules) => {
    if (!adminRulesSeeded.value) {
      editableAdminRules.value = rules.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        title: r.title ?? '',
        prompt: r.prompt ?? '',
        isActive: r.isActive ?? true,
        isInherited: r.isTenantWide ?? false,
        dirty: false,
        saving: false,
      }));
    }
  },
  { immediate: true },
);

watch(
  rawMyRules,
  (rules) => {
    if (!myRulesSeeded.value) {
      editableMyRules.value = rules.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        title: r.title ?? '',
        prompt: r.prompt ?? '',
        isActive: r.isActive ?? true,
        isPersonal: true,
        dirty: false,
        saving: false,
      }));
    }
  },
  { immediate: true },
);

function markAdminRuleDirty(rule: EditableRuleItem, field: 'title' | 'prompt' | 'isActive', val: any) {
  (rule as any)[field] = val;
  rule.dirty = true;
  adminRulesSeeded.value = true;
}

function markMyRuleDirty(rule: EditableRuleItem, field: 'title' | 'prompt' | 'isActive', val: any) {
  (rule as any)[field] = val;
  rule.dirty = true;
  myRulesSeeded.value = true;
}

// ── Admin Rules Mutations ─────────────────────────────────────────────
const updateAdminRuleMutation = usePutApiAdminAiRulesId();
const deleteAdminRuleMutation = useDeleteApiAdminAiRulesId();
const createAdminRuleMutation = usePostApiAdminAiRules();

async function saveProjectAdminRule(rule: EditableRuleItem) {
  if (!rule.id) return;
  rule.saving = true;
  try {
    await updateAdminRuleMutation.mutateAsync({
      id: rule.id,
      data: {
        title: rule.title,
        prompt: rule.prompt,
        isActive: rule.isActive,
      },
    });
    rule.dirty = false;
    rule.saving = false;
    adminRulesSeeded.value = false;
    void queryClient.invalidateQueries({ queryKey: getGetApiAiRulesProjectKeyQueryKey(projectKey.value) });
  } catch (e) {
    rule.saving = false;
    toast(extractMessage(e), 'danger');
  }
}

async function deleteProjectAdminRule(rule: EditableRuleItem) {
  if (!rule.id) return;
  const ok = await confirm({
    message: `${t('aiRules.delete')}?`,
    confirmLabel: t('common.delete'),
    confirmVariant: 'destructive',
  });
  if (!ok) return;
  try {
    await deleteAdminRuleMutation.mutateAsync({ id: rule.id });
    adminRulesSeeded.value = false;
    void queryClient.invalidateQueries({ queryKey: getGetApiAiRulesProjectKeyQueryKey(projectKey.value) });
  } catch (e) {
    toast(extractMessage(e), 'danger');
  }
}

const newAdminRuleTitle = ref('');
const newAdminRulePrompt = ref('');
const newAdminRuleBusy = ref(false);

async function createProjectAdminRule() {
  if (!props.project.id || !newAdminRuleTitle.value.trim() || !newAdminRulePrompt.value.trim()) return;
  newAdminRuleBusy.value = true;
  try {
    await createAdminRuleMutation.mutateAsync({
      data: {
        projectId: props.project.id,
        title: newAdminRuleTitle.value.trim(),
        prompt: newAdminRulePrompt.value.trim(),
        sortOrder: rawAdminRules.value.length,
      },
    });
    newAdminRuleBusy.value = false;
    newAdminRuleTitle.value = '';
    newAdminRulePrompt.value = '';
    adminRulesSeeded.value = false;
    void queryClient.invalidateQueries({ queryKey: getGetApiAiRulesProjectKeyQueryKey(projectKey.value) });
  } catch (e) {
    newAdminRuleBusy.value = false;
    toast(extractMessage(e), 'danger');
  }
}

// ── Personal Rules Mutations ──────────────────────────────────────────
const updateMyRuleMutation = usePutApiAiRulesMyId();
const deleteMyRuleMutation = useDeleteApiAiRulesMyId();
const createMyRuleMutation = usePostApiAiRulesMy();

async function savePersonalRule(rule: EditableRuleItem) {
  if (!rule.id) return;
  rule.saving = true;
  try {
    await updateMyRuleMutation.mutateAsync({
      id: rule.id,
      data: {
        title: rule.title,
        prompt: rule.prompt,
        isActive: rule.isActive,
      },
    });
    rule.dirty = false;
    rule.saving = false;
    myRulesSeeded.value = false;
    void queryClient.invalidateQueries({ queryKey: getGetApiAiRulesProjectKeyQueryKey(projectKey.value) });
  } catch (e) {
    rule.saving = false;
    toast(extractMessage(e), 'danger');
  }
}

async function deletePersonalRule(rule: EditableRuleItem) {
  if (!rule.id) return;
  const ok = await confirm({
    message: `${t('aiRules.delete')}?`,
    confirmLabel: t('common.delete'),
    confirmVariant: 'destructive',
  });
  if (!ok) return;
  try {
    await deleteMyRuleMutation.mutateAsync({ id: rule.id });
    myRulesSeeded.value = false;
    void queryClient.invalidateQueries({ queryKey: getGetApiAiRulesProjectKeyQueryKey(projectKey.value) });
  } catch (e) {
    toast(extractMessage(e), 'danger');
  }
}

const newPersonalRuleTitle = ref('');
const newPersonalRulePrompt = ref('');
const newPersonalRuleBusy = ref(false);

async function createPersonalRule() {
  if (!props.project.id || !newPersonalRuleTitle.value.trim() || !newPersonalRulePrompt.value.trim()) return;
  newPersonalRuleBusy.value = true;
  try {
    await createMyRuleMutation.mutateAsync({
      data: {
        projectId: props.project.id,
        title: newPersonalRuleTitle.value.trim(),
        prompt: newPersonalRulePrompt.value.trim(),
        sortOrder: rawMyRules.value.length,
      },
    });
    newPersonalRuleBusy.value = false;
    newPersonalRuleTitle.value = '';
    newPersonalRulePrompt.value = '';
    myRulesSeeded.value = false;
    void queryClient.invalidateQueries({ queryKey: getGetApiAiRulesProjectKeyQueryKey(projectKey.value) });
  } catch (e) {
    newPersonalRuleBusy.value = false;
    toast(extractMessage(e), 'danger');
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <p class="text-xs text-muted-foreground">{{ t('aiRules.projectHelp') }}</p>

    <div v-if="isLoading" class="text-sm text-muted-foreground">…</div>

    <!-- Section 1: Workspace & Project Admin Rules -->
    <div class="flex flex-col gap-3">
      <div>
        <div class="text-sm font-semibold">{{ t('aiRules.adminRulesTitle') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('aiRules.adminRulesSubtitle') }}</div>
      </div>

      <div class="flex flex-col gap-3">
        <div
          v-for="(rule, idx) in editableAdminRules"
          :key="rule.id ?? idx"
          class="flex flex-col gap-2 rounded-md border p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex flex-1 items-center gap-2">
              <Badge :variant="rule.isInherited ? 'default' : 'warning'">
                {{ t(rule.isInherited ? 'aiRules.inheritedBadge' : 'aiRules.projectBadge') }}
              </Badge>
              <div v-if="!rule.isInherited && (canEdit || isAdmin)" class="flex-1">
                <Input
                  :model-value="rule.title"
                  placeholder="Rule title"
                  class="h-8 text-sm"
                  @update:model-value="(val) => markAdminRuleDirty(rule, 'title', String(val))"
                />
              </div>
              <span v-else class="text-sm font-medium">{{ rule.title }}</span>
            </div>

            <div v-if="!rule.isInherited && (canEdit || isAdmin)" class="flex items-center gap-1.5">
              <span class="text-xs text-muted-foreground">
                {{ t(rule.isActive ? 'common.active' : 'common.disabled') }}
              </span>
              <Switch
                :checked="rule.isActive"
                @update:checked="(val: boolean) => markAdminRuleDirty(rule, 'isActive', val)"
              />
            </div>
          </div>

          <template v-if="!rule.isInherited && (canEdit || isAdmin)">
            <textarea
              :value="rule.prompt"
              rows="2"
              class="flex w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-xs shadow-sm resize-none font-mono"
              @input="(e) => markAdminRuleDirty(rule, 'prompt', (e.target as HTMLTextAreaElement).value)"
            />
            <div class="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                :disabled="rule.saving"
                @click="deleteProjectAdminRule(rule)"
              >
                <Trash2 class="h-4 w-4 text-destructive" />
                {{ t('common.delete') }}
              </Button>
              <Button
                type="button"
                size="sm"
                :disabled="!rule.dirty || rule.saving"
                @click="saveProjectAdminRule(rule)"
              >
                {{ t('common.save') }}
              </Button>
            </div>
          </template>
          <div
            v-else
            class="rounded bg-muted/50 p-2 text-xs font-mono text-muted-foreground whitespace-pre-wrap"
          >
            {{ rule.prompt }}
          </div>
        </div>

        <p v-if="editableAdminRules.length === 0 && !isLoading" class="text-xs text-muted-foreground italic">
          {{ t('aiRules.empty') }}
        </p>

        <!-- Form to Add Project Admin Rule -->
        <div
          v-if="canEdit || isAdmin"
          class="flex flex-col gap-3 rounded-md border border-dashed p-3"
        >
          <span class="text-xs font-semibold text-muted-foreground">{{ t('aiRules.addRule') }}</span>
          <FormField :label="t('aiRules.titleLabel')" html-for="new-ar-title">
            <Input
              id="new-ar-title"
              v-model="newAdminRuleTitle"
              :placeholder="t('aiRules.titlePlaceholder')"
            />
          </FormField>
          <FormField :label="t('aiRules.promptLabel')" html-for="new-ar-prompt">
            <textarea
              id="new-ar-prompt"
              v-model="newAdminRulePrompt"
              rows="2"
              :placeholder="t('aiRules.promptPlaceholder')"
              class="flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm resize-none"
            />
          </FormField>
          <div class="flex justify-end">
            <Button
              type="button"
              size="sm"
              :disabled="newAdminRuleBusy || !newAdminRuleTitle.trim() || !newAdminRulePrompt.trim()"
              @click="createProjectAdminRule"
            >
              <PlusCircle class="h-4 w-4" /> {{ t('aiRules.addRule') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 2: My Personal Rules -->
    <div class="flex flex-col gap-3 border-t pt-4">
      <div>
        <div class="text-sm font-semibold">{{ t('aiRules.myRulesTitle') }}</div>
        <div class="text-xs text-muted-foreground">{{ t('aiRules.myRulesSubtitle') }}</div>
      </div>

      <div class="flex flex-col gap-3">
        <div
          v-for="(rule, idx) in editableMyRules"
          :key="rule.id ?? idx"
          class="flex flex-col gap-2 rounded-md border p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex flex-1 items-center gap-2">
              <Badge variant="neutral">
                {{ t('aiRules.personalBadge') }}
              </Badge>
              <div class="flex-1">
                <Input
                  :model-value="rule.title"
                  placeholder="Rule title"
                  class="h-8 text-sm"
                  @update:model-value="(val) => markMyRuleDirty(rule, 'title', String(val))"
                />
              </div>
            </div>

            <div class="flex items-center gap-1.5">
              <span class="text-xs text-muted-foreground">
                {{ t(rule.isActive ? 'common.active' : 'common.disabled') }}
              </span>
              <Switch
                :checked="rule.isActive"
                @update:checked="(val: boolean) => markMyRuleDirty(rule, 'isActive', val)"
              />
            </div>
          </div>

          <textarea
            :value="rule.prompt"
            rows="2"
            class="flex w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-xs shadow-sm resize-none font-mono"
            @input="(e) => markMyRuleDirty(rule, 'prompt', (e.target as HTMLTextAreaElement).value)"
          />
          <div class="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              :disabled="rule.saving"
              @click="deletePersonalRule(rule)"
            >
              <Trash2 class="h-4 w-4 text-destructive" />
              {{ t('common.delete') }}
            </Button>
            <Button
              type="button"
              size="sm"
              :disabled="!rule.dirty || rule.saving"
              @click="savePersonalRule(rule)"
            >
              {{ t('common.save') }}
            </Button>
          </div>
        </div>

        <p v-if="editableMyRules.length === 0 && !isLoading" class="text-xs text-muted-foreground italic">
          {{ t('aiRules.noPersonalRules') }}
        </p>

        <!-- Form to Add Personal Rule -->
        <div class="flex flex-col gap-3 rounded-md border border-dashed p-3">
          <span class="text-xs font-semibold text-muted-foreground">{{ t('aiRules.addPersonalRule') }}</span>
          <FormField :label="t('aiRules.titleLabel')" html-for="new-pr-title">
            <Input
              id="new-pr-title"
              v-model="newPersonalRuleTitle"
              :placeholder="t('aiRules.titlePlaceholder')"
            />
          </FormField>
          <FormField :label="t('aiRules.promptLabel')" html-for="new-pr-prompt">
            <textarea
              id="new-pr-prompt"
              v-model="newPersonalRulePrompt"
              rows="2"
              :placeholder="t('aiRules.promptPlaceholder')"
              class="flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm resize-none"
            />
          </FormField>
          <div class="flex justify-end">
            <Button
              type="button"
              size="sm"
              :disabled="newPersonalRuleBusy || !newPersonalRuleTitle.trim() || !newPersonalRulePrompt.trim()"
              @click="createPersonalRule"
            >
              <PlusCircle class="h-4 w-4" /> {{ t('aiRules.addPersonalRule') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
