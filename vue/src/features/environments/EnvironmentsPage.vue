<script setup lang="ts">
import { computed, ref } from 'vue';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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
const environments = computed<AppEnvironmentResponse[]>(() => data.value ?? []);

const createEnvironment = usePostApiAdminEnvironments();
const updateEnvironment = usePatchApiAdminEnvironmentsId();
const removeEnvironment = useDeleteApiAdminEnvironmentsId();

function reload() {
  void queryClient.invalidateQueries({ queryKey: getGetApiAdminEnvironmentsQueryKey() });
}
function fail(e: unknown) {
  toast(extractMessage(e));
}

// A computed so headers follow live language switches (Angular re-evaluates
// its columns() every pass for the same reason).
const columns = computed<ColumnDef<typeof dataTableFeatures, AppEnvironmentResponse>[]>(() => [
  { accessorKey: 'name', header: t('environments.name') },
  { id: 'scope', header: t('environments.scope') },
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

function openAdd() {
  newName.value = '';
  addOpen.value = true;
}

async function addEnvironment() {
  const name = newName.value.trim();
  if (!name) return;
  try {
    await createEnvironment.mutateAsync({ data: { name } });
    addOpen.value = false;
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Rename ─────────────────────────────────────────────────────────────
const renameOpen = ref(false);
const editingEnvironment = ref<AppEnvironmentResponse | null>(null);
const editName = ref('');

function renameEnvironment(env: AppEnvironmentResponse) {
  editingEnvironment.value = env;
  editName.value = env.name ?? '';
  renameOpen.value = true;
}

async function saveRename() {
  const env = editingEnvironment.value;
  const name = editName.value.trim();
  if (!env || !name || name === env.name) {
    renameOpen.value = false;
    return;
  }
  try {
    await updateEnvironment.mutateAsync({ id: env.id!, data: { name } });
    renameOpen.value = false;
    reload();
  } catch (e) {
    fail(e);
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
    toast(t('environments.deleted'));
    reload();
  } catch (e) {
    fail(e);
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">{{ t('environments.title') }}</h2>
        <p class="mt-0.5 text-[13px] text-muted-foreground">{{ t('environments.subtitle') }}</p>
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
      :empty-icon="Globe"
      :empty-message="t('environments.empty')"
      :empty-hint="t('environments.emptyHint')"
      :loading="isLoading"
    >
      <!-- Scope cell: Global (platform-owned) vs the tenant's own environment -->
      <template #cell-scope="{ row }">
        <Badge :variant="row.isGlobal ? 'neutral' : 'success'">
          {{ t(row.isGlobal ? 'environments.global' : 'environments.own') }}
        </Badge>
      </template>
      <!-- Empty-state CTA (only rendered while the table is empty) -->
      <Button @click="openAdd">
        <Plus class="h-4 w-4" /> {{ t('environments.addEnvironment') }}
      </Button>
    </DataTable>
  </div>

  <!-- Add environment dialog -->
  <Dialog v-model:open="addOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('environments.addEnvironment') }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-2 pt-2">
        <Label for="environment-name">{{ t('environments.name') }}</Label>
        <Input
          id="environment-name"
          v-model="newName"
          placeholder="e.g. qa"
          @keydown.enter="addEnvironment"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" @click="addOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="!newName.trim()" @click="addEnvironment">
          <Plus class="h-4 w-4" /> {{ t('environments.addEnvironment') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Rename environment dialog -->
  <Dialog v-model:open="renameOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('common.rename') }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-2 pt-2">
        <Label for="rename-environment-name">{{ t('environments.name') }}</Label>
        <Input
          id="rename-environment-name"
          v-model="editName"
          @keydown.enter="saveRename"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" @click="renameOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="!editName.trim()" @click="saveRename">{{ t('common.save') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
