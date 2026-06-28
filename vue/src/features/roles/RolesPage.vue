<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiAdminRoles,
  usePostApiAdminRoles,
  usePatchApiAdminRolesId,
  useDeleteApiAdminRolesId,
  getGetApiAdminRolesQueryKey,
  type RoleResponse,
} from '@moamen-ui/pointer-vue';
import { Plus, Pencil, Ban, CheckCircle2, Trash2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { cn } from '@/lib/utils';
import { confirm } from '@/composables/useConfirm';
import { toast } from '@/composables/useToast';

const { t } = useI18n();

const queryClient = useQueryClient();

const { data } = useGetApiAdminRoles();
const roles = computed<RoleResponse[]>(() => data.value ?? []);

const createRole = usePostApiAdminRoles();
const updateRole = usePatchApiAdminRolesId();
const removeRole = useDeleteApiAdminRolesId();

function reload() {
  void queryClient.invalidateQueries({ queryKey: getGetApiAdminRolesQueryKey() });
}
function fail(e: unknown) {
  toast(extractMessage(e));
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

// ── Grants admin toggle ───────────────────────────────────────────────
async function toggleGrantsAdmin(role: RoleResponse, grantsAdmin: boolean) {
  try {
    await updateRole.mutateAsync({ id: role.id!, data: { grantsAdmin } });
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
    (r) => r.isActive && !r.isSystem && r.id !== deletingRole.value?.id,
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

    <Card v-if="roles.length > 0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ t('roles.name') }}</TableHead>
            <TableHead>{{ t('roles.grantsAdmin') }}</TableHead>
            <TableHead>{{ t('roles.status') }}</TableHead>
            <TableHead>{{ t('roles.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="role in roles" :key="role.id">
            <TableCell>
              {{ role.name }}
              <span v-if="role.isSystem" class="chip chip-neutral ms-2 text-[10px]">
                {{ t('roles.system') }}
              </span>
            </TableCell>
            <TableCell>
              <Switch
                :model-value="role.grantsAdmin"
                :disabled="role.isSystem"
                @update:model-value="(v: boolean) => toggleGrantsAdmin(role, v)"
              />
            </TableCell>
            <TableCell>
              <span :class="cn('chip', role.isActive ? 'chip-active' : 'chip-disabled')">
                {{ t(role.isActive ? 'common.active' : 'common.disabled') }}
              </span>
            </TableCell>
            <TableCell>
              <div v-if="!role.isSystem" class="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" @click="renameRole(role)">
                  <Pencil class="h-4 w-4" /> {{ t('common.rename') }}
                </Button>
                <Button
                  :variant="role.isActive ? 'destructive' : 'default'"
                  size="sm"
                  @click="toggleActive(role)"
                >
                  <component :is="role.isActive ? Ban : CheckCircle2" class="h-4 w-4" />
                  {{ role.isActive ? t('common.disable') : t('common.enable') }}
                </Button>
                <Button variant="destructive" size="sm" @click="openDelete(role)">
                  <Trash2 class="h-4 w-4" /> {{ t('roles.delete') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
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
