<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import type { ColumnDef } from '@tanstack/vue-table';
import {
  useGetApiAdminRoles,
  usePostApiAdminRoles,
  usePatchApiAdminRolesId,
  useDeleteApiAdminRolesId,
  getGetApiAdminRolesQueryKey,
  type RoleResponse,
} from '@moamen-ui/pointer-vue';
import { Plus, Pencil, Ban, CheckCircle2, Trash2, UserCog } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { DataTable, dataTableFeatures } from '@/components/shared/data-table';
import type { RowActionItem } from '@/components/shared/types';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { extractMessage } from '@/lib/error';
import { useAuth } from '@/composables/useAuth';
import { confirm } from '@/composables/useConfirm';
import { toast } from '@/composables/useToast';

const { t } = useI18n();

const queryClient = useQueryClient();

/**
 * Whether the signed-in user may fully manage this role (rename/delete/reconfigure). The API
 * computes it (RoleResponse.CanManage): system roles are immutable for everyone, and a scoped
 * admin may only fully own roles its own tenant created. Falls back to !isSystem
 * so an older API still behaves as before.
 */
function canManage(role: RoleResponse): boolean {
  return role.canManage ?? !role.isSystem;
}

/**
 * Whether the signed-in user may at least flip this role's active status — true for
 * everything canManage() covers, PLUS a GLOBAL, non-system role a scoped admin doesn't own
 * (toggled via a per-tenant override server-side, never touching the shared row). False for
 * every system role, for everyone but a super admin.
 */
function canToggleActive(role: RoleResponse): boolean {
  return role.canToggleActive ?? canManage(role);
}

const { isSuperAdmin } = useAuth();
const { data, isLoading } = useGetApiAdminRoles();
// System roles (e.g. Admin, Workspace Admin) are immutable platform roles, not workspace
// ones, so listing them to a scoped admin is noise they can never act on — filtered out via
// canToggleActive, which is false for every system role. A GLOBAL, non-system role (e.g. the
// seeded "Tester") DOES show, though: a scoped admin can still toggle it on/off for their own
// workspace via a per-tenant override, even without fully owning it. A super-admin sees
// everything, system roles included.
const roles = computed<RoleResponse[]>(() => {
  const all = data.value ?? [];
  return isSuperAdmin.value ? all : all.filter(canToggleActive);
});

const createRole = usePostApiAdminRoles();
const updateRole = usePatchApiAdminRolesId();
const removeRole = useDeleteApiAdminRolesId();

function reload() {
  void queryClient.invalidateQueries({ queryKey: getGetApiAdminRolesQueryKey() });
}
function fail(e: unknown) {
  toast(extractMessage(e));
}

// A computed so headers follow live language switches (Angular re-evaluates
// its columns() every pass for the same reason).
const columns = computed<ColumnDef<typeof dataTableFeatures, RoleResponse>[]>(() => [
  { accessorKey: 'name', header: t('roles.name'), enableSorting: false },
  { accessorKey: 'grantsAdmin', header: t('roles.grantsAdmin'), enableSorting: false },
  { accessorKey: 'quickAccess', header: t('roles.quickAccess'), enableSorting: false },
  { id: 'status', header: t('roles.status'), enableSorting: false },
]);

// canToggleActive gates whether the menu shows at all; within it, Rename/Delete
// additionally require canManage (matching the Angular reference).
function actionsFor(role: RoleResponse): RowActionItem[] {
  if (!canToggleActive(role)) return [];
  const items: RowActionItem[] = [];
  if (canManage(role)) {
    items.push({ label: t('common.rename'), icon: Pencil, onClick: () => renameRole(role) });
  }
  items.push({
    label: role.isActive ? t('common.disable') : t('common.enable'),
    icon: role.isActive ? Ban : CheckCircle2,
    severity: role.isActive ? 'danger' : 'neutral',
    onClick: () => void toggleActive(role),
  });
  if (canManage(role)) {
    items.push({ label: t('roles.delete'), icon: Trash2, severity: 'danger', onClick: () => openDelete(role) });
  }
  return items;
}

// ── Add role ──────────────────────────────────────────────────────────
const addOpen = ref(false);
const newName = ref('');
const newGrantsAdmin = ref(false);

function openAdd() {
  newName.value = '';
  newGrantsAdmin.value = false;
  addOpen.value = true;
}

async function addRole() {
  const name = newName.value.trim();
  if (!name) return;
  try {
    await createRole.mutateAsync({ data: { name, grantsAdmin: newGrantsAdmin.value } });
    addOpen.value = false;
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Grants admin / quick-access toggles ───────────────────────────────
async function toggleGrantsAdmin(role: RoleResponse, grantsAdmin: boolean) {
  try {
    await updateRole.mutateAsync({ id: role.id!, data: { grantsAdmin } });
    reload();
  } catch (e) {
    fail(e);
  }
}

async function toggleQuickAccess(role: RoleResponse, quickAccess: boolean) {
  try {
    await updateRole.mutateAsync({ id: role.id!, data: { quickAccess } });
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Rename ────────────────────────────────────────────────────────────
const renameOpen = ref(false);
const editingRole = ref<RoleResponse | null>(null);
const editName = ref('');

function renameRole(role: RoleResponse) {
  editingRole.value = role;
  editName.value = role.name ?? '';
  renameOpen.value = true;
}

async function saveRename() {
  const role = editingRole.value;
  const name = editName.value.trim();
  if (!role || !name || name === role.name) {
    renameOpen.value = false;
    return;
  }
  try {
    await updateRole.mutateAsync({ id: role.id!, data: { name } });
    renameOpen.value = false;
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Active toggle (confirm on disable) ────────────────────────────────
async function toggleActive(role: RoleResponse) {
  if (!role.isActive) {
    await patchActive(role, true);
    return;
  }
  const ok = await confirm({
    message: t('common.confirmDisable', { name: role.name }),
    confirmLabel: t('common.disable'),
    confirmVariant: 'destructive',
  });
  if (ok) await patchActive(role, false);
}

async function patchActive(role: RoleResponse, isActive: boolean) {
  try {
    await updateRole.mutateAsync({ id: role.id!, data: { isActive } });
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Delete + delegate ─────────────────────────────────────────────────
const deleteOpen = ref(false);
const deletingRole = ref<RoleResponse | null>(null);
const reassignTargetId = ref<number | null>(null);

// Valid reassignment targets: active, non-system roles other than the one being deleted.
const targetRoles = computed(() =>
  roles.value.filter(
    // The API resolves the reassignment target with its own ownership/escalation guard,
    // so offer only roles this caller may actually manage.
    (r) => r.isActive && canManage(r) && r.id !== deletingRole.value?.id,
  ),
);

function openDelete(role: RoleResponse) {
  deletingRole.value = role;
  reassignTargetId.value = null;
  deleteOpen.value = true;
}

async function deleteRole() {
  const role = deletingRole.value;
  if (!role) return;
  // reassignToRoleId is only needed when the role actually has users; the API
  // validates and returns a 409 (shown via the toast) if it's required.
  const params = reassignTargetId.value
    ? { reassignToRoleId: reassignTargetId.value }
    : undefined;
  try {
    const res = await removeRole.mutateAsync({ id: role.id!, params });
    deleteOpen.value = false;
    const moved = res?.reassignedUsers ?? 0;
    toast(t('roles.deleted') + (moved ? ` (${moved})` : ''));
    reload();
  } catch (e) {
    fail(e);
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-lg font-semibold">{{ t('roles.title') }}</h2>
      <Button @click="openAdd">
        <Plus class="h-4 w-4" /> {{ t('roles.addRole') }}
      </Button>
    </div>

    <DataTable
      :data="roles"
      :columns="columns"
      :actions="actionsFor"
      :actions-aria-label="t('roles.actions')"
      paginated
      :empty-icon="UserCog"
      :empty-message="t('roles.empty')"
      :empty-hint="t('roles.emptyHint')"
      :loading="isLoading"
    >
      <template #cell-name="{ row }">
        {{ row.name }}
        <span v-if="row.isSystem" class="chip chip-neutral ms-2 text-[10px]">
          {{ t('roles.system') }}
        </span>
      </template>
      <template #cell-grantsAdmin="{ row }">
        <!-- Compact switch for the table cell (~28×16 track, 12px thumb) -->
        <Switch
          :model-value="row.grantsAdmin"
          :disabled="row.isSystem || !canManage(row)"
          class="h-4 w-7 [&_span]:h-3 [&_span]:w-3 [&_span[data-state=checked]]:translate-x-3 rtl:[&_span[data-state=checked]]:-translate-x-3"
          @update:model-value="(v: boolean) => toggleGrantsAdmin(row, v)"
        />
      </template>
      <template #cell-quickAccess="{ row }">
        <Switch
          :model-value="row.quickAccess"
          :disabled="row.isSystem || !canManage(row)"
          class="h-4 w-7 [&_span]:h-3 [&_span]:w-3 [&_span[data-state=checked]]:translate-x-3 rtl:[&_span[data-state=checked]]:-translate-x-3"
          @update:model-value="(v: boolean) => toggleQuickAccess(row, v)"
        />
      </template>
      <template #cell-status="{ row }">
        <Badge :variant="row.isActive ? 'success' : 'destructive'">
          {{ t(row.isActive ? 'common.active' : 'common.disabled') }}
        </Badge>
      </template>
      <!-- Empty-state CTA (only rendered while the table is empty) -->
      <Button @click="openAdd">
        <Plus class="h-4 w-4" /> {{ t('roles.addRole') }}
      </Button>
    </DataTable>
  </div>

  <!-- Add role dialog -->
  <Dialog v-model:open="addOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('roles.addRole') }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-2">
          <Label for="role-name">{{ t('roles.name') }}</Label>
          <Input id="role-name" v-model="newName" @keydown.enter="addRole" />
        </div>
        <label class="flex items-center gap-2 text-sm">
          <Checkbox v-model="newGrantsAdmin" />
          {{ t('roles.grantsAdmin') }}
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="addOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="!newName.trim()" @click="addRole">
          <Plus class="h-4 w-4" /> {{ t('roles.addRole') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Rename role dialog -->
  <Dialog v-model:open="renameOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('common.rename') }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-2 pt-2">
        <Label for="rename-name">{{ t('roles.name') }}</Label>
        <Input id="rename-name" v-model="editName" @keydown.enter="saveRename" />
      </div>
      <DialogFooter>
        <Button variant="outline" @click="renameOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="!editName.trim()" @click="saveRename">{{ t('common.save') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Delete role + delegate users dialog -->
  <Dialog v-model:open="deleteOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('roles.deleteTitle') }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-4 pt-2">
        <p class="text-sm">{{ t('roles.deleteIntro', { name: deletingRole?.name }) }}</p>
        <div v-if="targetRoles.length > 0" class="flex flex-col gap-2">
          <Label>{{ t('roles.reassignLabel') }}</Label>
          <Select
            :model-value="reassignTargetId != null ? String(reassignTargetId) : undefined"
            @update:model-value="(v: any) => (reassignTargetId = v != null ? Number(v) : null)"
          >
            <SelectTrigger>
              <SelectValue :placeholder="t('roles.reassignLabel')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="r in targetRoles" :key="r.id" :value="String(r.id)">
                {{ r.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p v-else class="text-sm text-muted-foreground">{{ t('roles.noTargets') }}</p>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="deleteOpen = false">{{ t('common.cancel') }}</Button>
        <Button
          variant="destructive"
          :disabled="targetRoles.length > 0 && !reassignTargetId"
          @click="deleteRole"
        >
          <Trash2 class="h-4 w-4" /> {{ t('roles.delete') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
