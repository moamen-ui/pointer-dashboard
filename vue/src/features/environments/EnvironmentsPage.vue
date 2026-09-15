<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import type { ColumnDef } from '@tanstack/vue-table';
import {
  useGetApiAdminEnvironments,
  usePostApiAdminEnvironments,
  usePatchApiAdminEnvironmentsId,
  useDeleteApiAdminEnvironmentsId,
  getGetApiAdminEnvironmentsQueryKey,
  type AppEnvironmentResponse,
} from '@moamen-ui/pointer-vue';
import { Plus, Pencil, Trash2, Globe } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import FormField from '@/components/shared/FormField.vue';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable, dataTableFeatures } from '@/components/shared/data-table';
import type { RowActionItem } from '@/components/shared/types';
import { extractMessage } from '@/lib/error';
import { confirm } from '@/composables/useConfirm';
import { toast } from '@/composables/useToast';

/**
 * A super-admin-seeded global catalog ("default", "prod", "staging", …) every
 * tenant sees, plus each tenant's own custom environments layered on top —
 * same own-plus-global shape as the Roles page. A project can have one AppUrl
 * per environment (see the Projects page).
 *
 * First Vue page built on the shared DataTable/Badge/RowActionsMenu library.
 */
const { t } = useI18n();
const queryClient = useQueryClient();

const { data, isLoading } = useGetApiAdminEnvironments();
// Sort: active (enabled/not retired) first, then retired/disabled last
const environments = computed<AppEnvironmentResponse[]>(() => {
  const all = data.value ?? [];
  return all.sort((a, b) => {
    const aRetired = a.isRetired ? 1 : 0;
    const bRetired = b.isRetired ? 1 : 0;
    return aRetired - bRetired;
  });
});

// #191: environment names must be unique per tenant (case-insensitive, trimmed). No such guard
// exists in the API today (a DB/API-level uniqueness constraint is a separate-repo concern — see
// poitner-api) — this is a CLIENT-SIDE guard only, blocking obviously-doomed submits and surfacing
// a friendly inline error instead of a raw 409 toast when the guard is bypassed by a race.
function duplicateNameMessage(): string {
  return t('environments.nameTaken');
}

function isDuplicateName(name: string, excludeId?: number | null): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return environments.value.some(
    (env) => env.id !== excludeId && (env.name ?? '').trim().toLowerCase() === normalized,
  );
}

function isConflictError(e: unknown): boolean {
  const status = (e as { response?: { status?: number } } | undefined)?.response?.status;
  return status === 409;
}

// Track which environment ID is currently being saved
const savingEnvironmentId = ref<number | null>(null);

const createEnvironment = usePostApiAdminEnvironments();
const updateEnvironment = usePatchApiAdminEnvironmentsId();
const removeEnvironment = useDeleteApiAdminEnvironmentsId();

function reload() {
  void queryClient.invalidateQueries({ queryKey: getGetApiAdminEnvironmentsQueryKey() });
}
function fail(e: unknown) {
  toast(extractMessage(e), 'danger');
}

// A computed so headers follow live language switches (Angular re-evaluates
// its columns() every pass for the same reason).
const columns = computed<ColumnDef<typeof dataTableFeatures, AppEnvironmentResponse>[]>(() => [
  { accessorKey: 'name', header: t('environments.name'), meta: { mobile: 'primary' } },
  { id: 'scope', header: t('environments.scope') },
  { id: 'enabled', header: t('environments.enabled') },
]);

// Rename/Delete are gated per row by the API's canManage (global environments
// are platform-owned); the gate lives entirely in this callback.
function actionsFor(env: AppEnvironmentResponse): RowActionItem[] {
  if (!env.canManage) return [];
  return [
    {
      label: t('common.rename'),
      icon: Pencil,
      onClick: () => renameEnvironment(env),
    },
    {
      label: t('common.delete'),
      icon: Trash2,
      severity: 'danger',
      onClick: () => void confirmDelete(env),
    },
  ];
}

// ── Add environment ────────────────────────────────────────────────────
const addOpen = ref(false);
const newName = ref('');
// Angular-parity validation: error appears only after the field was touched
// (blurred), like FormControl.invalid && FormControl.touched. The Add button
// was already disabled on an empty name with no way for the user to see why.
const newNameTouched = ref(false);
// #191: a server-surfaced 409 ("duplicate") wins until the user edits the field again — cleared
// by the watcher below so client-side validation can take back over.
const newNameServerError = ref('');
const newNameError = computed(() => {
  if (newNameServerError.value) return newNameServerError.value;
  if (!newNameTouched.value) return '';
  const trimmed = newName.value.trim();
  if (!trimmed) return t('common.fieldRequired');
  if (isDuplicateName(trimmed)) return duplicateNameMessage();
  return '';
});
watch(newName, () => {
  newNameServerError.value = '';
});

function openAdd() {
  newName.value = '';
  newNameTouched.value = false;
  newNameServerError.value = '';
  addOpen.value = true;
}

async function addEnvironment() {
  newNameTouched.value = true;
  const name = newName.value.trim();
  if (!name || isDuplicateName(name)) return;
  try {
    await createEnvironment.mutateAsync({ data: { name } });
    addOpen.value = false;
    reload();
  } catch (e) {
    if (isConflictError(e)) {
      newNameServerError.value = duplicateNameMessage();
    } else {
      fail(e);
    }
  }
}

// ── Rename ─────────────────────────────────────────────────────────────
const renameOpen = ref(false);
const editingEnvironment = ref<AppEnvironmentResponse | null>(null);
const editName = ref('');
// Same touched-error convention as Add environment's name field above.
const editNameTouched = ref(false);
// #191: same server-error-wins-until-edited convention as Add environment above.
const editNameServerError = ref('');
const editNameError = computed(() => {
  if (editNameServerError.value) return editNameServerError.value;
  if (!editNameTouched.value) return '';
  const trimmed = editName.value.trim();
  if (!trimmed) return t('common.fieldRequired');
  if (isDuplicateName(trimmed, editingEnvironment.value?.id)) return duplicateNameMessage();
  return '';
});
watch(editName, () => {
  editNameServerError.value = '';
});

function renameEnvironment(env: AppEnvironmentResponse) {
  editingEnvironment.value = env;
  editName.value = env.name ?? '';
  editNameTouched.value = false;
  editNameServerError.value = '';
  renameOpen.value = true;
}

async function saveRename() {
  editNameTouched.value = true;
  const env = editingEnvironment.value;
  const name = editName.value.trim();
  if (!env || !name) return;
  if (name === env.name) {
    renameOpen.value = false;
    return;
  }
  if (isDuplicateName(name, env.id)) return;
  try {
    await updateEnvironment.mutateAsync({ id: env.id!, data: { name } });
    renameOpen.value = false;
    reload();
  } catch (e) {
    if (isConflictError(e)) {
      editNameServerError.value = duplicateNameMessage();
    } else {
      fail(e);
    }
  }
}

// ── Delete (via the shared promise-based confirm dialog) ───────────────
async function confirmDelete(env: AppEnvironmentResponse) {
  const ok = await confirm({
    message: t('environments.confirmDelete', { name: env.name }),
    confirmLabel: t('common.delete'),
    confirmVariant: 'destructive',
  });
  if (ok) await deleteEnvironment(env);
}

async function deleteEnvironment(env: AppEnvironmentResponse) {
  try {
    await removeEnvironment.mutateAsync({ id: env.id! });
    toast(t('environments.deleted'), 'success');
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Toggle enabled ─────────────────────────────────────────────────────
async function toggleEnabled(env: AppEnvironmentResponse) {
  // If enabling, just do it
  if (env.isEnabled === false) {
    await patchEnabled(env, true);
    return;
  }
  // If disabling, show confirmation if there are project URLs
  if ((env.projectUrlCount ?? 0) > 0) {
    const ok = await confirm({
      message: t('environments.confirmDisable', { name: env.name, count: env.projectUrlCount ?? 0 }),
      confirmLabel: t('common.disable'),
      confirmVariant: 'destructive',
    });
    if (ok) await patchEnabled(env, false);
  } else {
    await patchEnabled(env, false);
  }
}

async function patchEnabled(env: AppEnvironmentResponse, isEnabled: boolean) {
  try {
    savingEnvironmentId.value = env.id ?? null;
    await updateEnvironment.mutateAsync({ id: env.id!, data: { isEnabled } });
    savingEnvironmentId.value = null;
    toast(isEnabled ? t('environments.enabled') : t('environments.disabled'), 'success');
    reload();
  } catch (e) {
    savingEnvironmentId.value = null;
    fail(e);
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[20px] font-semibold leading-7 tracking-[-0.01em]">{{ t('environments.title') }}</h1>
        <p class="mt-0.5 text-[14px] text-muted-foreground">{{ t('environments.subtitle') }}</p>
      </div>
      <Button @click="openAdd">
        <Plus class="h-4 w-4" /> {{ t('environments.addEnvironment') }}
      </Button>
    </div>

    <DataTable
      :data="environments"
      :columns="columns"
      :actions="actionsFor"
      :actions-aria-label="t('common.actions')"
      gutter
      :empty-icon="Globe"
      :empty-message="t('environments.empty')"
      :empty-hint="t('environments.emptyHint')"
      :loading="isLoading"
    >
      <!-- Name cell: greyed out if retired -->
      <template #cell-name="{ row }">
        <span :class="row.isRetired ? 'text-muted-foreground' : ''">{{ row.name }}</span>
      </template>
      <!-- Scope cell: Global (platform-owned) vs the tenant's own environment -->
      <template #cell-scope="{ row }">
        <Badge :variant="row.isGlobal ? 'neutral' : 'default'">
          {{ t(row.isGlobal ? 'environments.global' : 'environments.own') }}
        </Badge>
        <Badge v-if="row.isRetired" variant="neutral" class="ms-2">
          {{ t('environments.retired') }}
        </Badge>
      </template>
      <!-- Enabled toggle column -->
      <template #cell-enabled="{ row }">
        <div class="flex items-center gap-2">
          <Switch
            v-if="!row.isRetired"
            :checked="row.isEnabled !== false"
            :disabled="!row.canManage || savingEnvironmentId === row.id"
            @update:checked="() => toggleEnabled(row)"
          />
          <span v-else class="text-xs text-muted-foreground">{{ t('environments.retired') }}</span>
        </div>
      </template>
      <!-- Empty-state CTA (only rendered while the table is empty) -->
      <template #empty-action>
        <Button @click="openAdd">
          <Plus class="h-4 w-4" /> {{ t('environments.addEnvironment') }}
        </Button>
      </template>
    </DataTable>
  </div>

  <!-- Add environment dialog -->
  <Dialog v-model:open="addOpen">
    <DialogContent class="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog">
      <DialogHeader>
        <DialogTitle class="text-base font-semibold leading-6">{{ t('environments.addEnvironment') }}</DialogTitle>
      </DialogHeader>
      <div class="py-2">
        <FormField :label="t('environments.name')" html-for="environment-name" :error="newNameError">
          <Input
            id="environment-name"
            v-model="newName"
            placeholder="e.g. qa"
            @keydown.enter="addEnvironment"
            @blur="newNameTouched = true"
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button variant="secondary" @click="addOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="!newName.trim() || isDuplicateName(newName.trim())" @click="addEnvironment">
          <Plus class="h-4 w-4" /> {{ t('environments.addEnvironment') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Rename environment dialog -->
  <Dialog v-model:open="renameOpen">
    <DialogContent class="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog">
      <DialogHeader>
        <DialogTitle class="text-base font-semibold leading-6">{{ t('common.rename') }}</DialogTitle>
      </DialogHeader>
      <div class="py-2">
        <FormField :label="t('environments.name')" html-for="rename-environment-name" :error="editNameError">
          <Input
            id="rename-environment-name"
            v-model="editName"
            @keydown.enter="saveRename"
            @blur="editNameTouched = true"
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button variant="secondary" @click="renameOpen = false">{{ t('common.cancel') }}</Button>
        <Button
          :disabled="!editName.trim() || isDuplicateName(editName.trim(), editingEnvironment?.id)"
          @click="saveRename"
        >
          {{ t('common.save') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
