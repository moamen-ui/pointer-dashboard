<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiAdminUsers,
  useGetApiAdminRoles,
  usePostApiAdminUsers,
  usePatchApiAdminUsersId,
  usePostApiAdminUsersIdApprove,
  usePostApiAdminUsersIdReject,
  getGetApiAdminUsersQueryKey,
  type UserResponse,
  type RoleResponse,
} from '@moamen-ui/pointer-vue';
import { Plus, Ban, CheckCircle2, UserCheck, UserRound } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type FilterStatus = 'Approved' | 'Pending' | 'Rejected';

const { t } = useI18n();
const router = useRouter();

const filter = ref<FilterStatus>('Approved');
const busy = ref(false);

const queryClient = useQueryClient();

// Main users query — driven by a reactive param so it re-fetches (and re-keys)
// whenever the filter changes.
const usersParams = computed(() => ({ status: filter.value.toLowerCase() || undefined }));
const usersQuery = useGetApiAdminUsers(usersParams);
// Separate query for the Pending badge count.
const pendingQuery = useGetApiAdminUsers({ status: 'pending' });
const rolesQuery = useGetApiAdminRoles();

const users = computed<UserResponse[]>(() => usersQuery.data.value ?? []);
const roles = computed<RoleResponse[]>(() => rolesQuery.data.value ?? []);
const pendingCount = computed(() => pendingQuery.data.value?.length ?? 0);
const loading = computed(() => usersQuery.isLoading.value || busy.value);

const createUser = usePostApiAdminUsers();
const updateUser = usePatchApiAdminUsersId();
const approveUser = usePostApiAdminUsersIdApprove();
const rejectUser = usePostApiAdminUsersIdReject();

const FILTERS: FilterStatus[] = ['Approved', 'Pending', 'Rejected'];

function activeRoles(): RoleResponse[] {
  return roles.value.filter((r) => r.isActive);
}

function rolesForUser(user: UserResponse): RoleResponse[] {
  const active = activeRoles();
  const current = roles.value.find((r) => r.id === user.roleId);
  if (current && !current.isActive) return [current, ...active];
  return active;
}

function setFilter(status: FilterStatus) {
  filter.value = status;
}

function fail(e: unknown) {
  busy.value = false;
  toast(extractMessage(e));
}
// The base ["api","admin","users"] key prefix-matches every users query
// (filtered list + pending-count), so one invalidation refreshes both.
function reloadUsers() {
  void queryClient.invalidateQueries({ queryKey: getGetApiAdminUsersQueryKey() });
}

// ── Add user ──────────────────────────────────────────────────────────
const addOpen = ref(false);
const addForm = reactive({ email: '', displayName: '', password: '', roleId: 0 });

const addInvalid = computed(
  () =>
    !addForm.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email) ||
    !addForm.displayName ||
    !addForm.password ||
    !addForm.roleId,
);

function openAdd() {
  addForm.email = '';
  addForm.displayName = '';
  addForm.password = '';
  addForm.roleId = activeRoles()[0]?.id ?? 0;
  addOpen.value = true;
}

async function addUser() {
  if (addInvalid.value) return;
  busy.value = true;
  try {
    await createUser.mutateAsync({ data: { ...addForm } });
    addOpen.value = false;
    busy.value = false;
    reloadUsers();
  } catch (e) {
    fail(e);
  }
}

// ── Change role (approved view) ───────────────────────────────────────
function reloadCurrentList() {
  void queryClient.invalidateQueries({
    queryKey: getGetApiAdminUsersQueryKey(usersParams.value),
  });
}

async function changeRole(user: UserResponse, roleId: number) {
  busy.value = true;
  try {
    await updateUser.mutateAsync({ id: user.id!, data: { roleId } });
    busy.value = false;
    reloadCurrentList();
  } catch (e) {
    fail(e);
    reloadCurrentList();
  }
}

// ── Active toggle ─────────────────────────────────────────────────────
async function toggleActive(user: UserResponse) {
  if (!user.isActive) {
    await patchActive(user, true);
    return;
  }
  const ok = await confirm({
    message: t('common.confirmDisable', { name: user.email }),
    confirmLabel: t('common.disable'),
    confirmVariant: 'destructive',
  });
  if (ok) await patchActive(user, false);
}

async function patchActive(user: UserResponse, isActive: boolean) {
  busy.value = true;
  try {
    await updateUser.mutateAsync({ id: user.id!, data: { isActive } });
    busy.value = false;
    reloadCurrentList();
  } catch (e) {
    fail(e);
  }
}

// ── Approve (with role selection) ─────────────────────────────────────
const approveSelection = reactive<Record<number, number>>({});
const approveOpenFor = ref<number | null>(null);

function openApprove(user: UserResponse) {
  approveSelection[user.id!] = user.roleId ?? activeRoles()[0]?.id ?? 0;
  approveOpenFor.value = user.id!;
}

async function approve(user: UserResponse) {
  const roleId = approveSelection[user.id!] ?? user.roleId;
  busy.value = true;
  try {
    await approveUser.mutateAsync({ id: user.id!, data: { roleId } });
    approveOpenFor.value = null;
    busy.value = false;
    reloadUsers();
  } catch (e) {
    fail(e);
  }
}

// ── Reject ────────────────────────────────────────────────────────────
async function reject(user: UserResponse) {
  const ok = await confirm({
    message: t('users.confirmReject', { name: user.email }),
    confirmLabel: t('users.reject'),
    confirmVariant: 'destructive',
  });
  if (!ok) return;
  busy.value = true;
  try {
    await rejectUser.mutateAsync({ id: user.id! });
    busy.value = false;
    reloadUsers();
  } catch (e) {
    fail(e);
  }
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-lg font-semibold">{{ t('users.title') }}</h2>
      <Button @click="openAdd">
        <Plus class="h-4 w-4" /> {{ t('users.addUser') }}
      </Button>
    </div>

    <div v-if="loading" class="h-0.5 w-full overflow-hidden rounded bg-muted">
      <div class="h-full w-1/3 animate-pulse bg-primary" />
    </div>

    <!-- Filter bar -->
    <div class="flex flex-wrap items-center gap-3">
      <span class="text-sm text-muted-foreground">{{ t('users.filter') }}</span>
      <div class="inline-flex overflow-hidden rounded-md border border-input">
        <button
          v-for="(f, i) in FILTERS"
          :key="f"
          type="button"
          :class="
            cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors',
              i > 0 && 'border-s border-input',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-accent hover:text-accent-foreground',
            )
          "
          @click="setFilter(f)"
        >
          {{ t('users.filter' + f) }}
          <span
            v-if="f === 'Pending' && pendingCount"
            class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/90 px-1 text-[0.7rem] font-bold text-white"
          >
            {{ pendingCount }}
          </span>
        </button>
      </div>
    </div>

    <p v-if="users.length === 0 && !loading" class="py-6 text-muted-foreground">
      {{ t('users.empty') }}
    </p>

    <Card v-else>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ t('users.email') }}</TableHead>
            <TableHead>{{ t('users.name') }}</TableHead>
            <TableHead>{{ t('users.role') }}</TableHead>
            <TableHead v-if="filter !== 'Approved'">{{ t('overview.requested') }}</TableHead>
            <TableHead>{{ t('users.status') }}</TableHead>
            <TableHead>{{ t('users.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="user in users" :key="user.id">
            <TableCell>{{ user.email }}</TableCell>
            <TableCell>{{ user.displayName }}</TableCell>
            <TableCell>
              <Select
                v-if="filter === 'Approved'"
                :model-value="user.roleId != null ? String(user.roleId) : undefined"
                @update:model-value="(v: any) => v != null && changeRole(user, Number(v))"
              >
                <SelectTrigger class="min-w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="role in rolesForUser(user)" :key="role.id" :value="String(role.id)">
                    {{ role.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <span v-else>{{ user.roleName }}</span>
            </TableCell>
            <TableCell v-if="filter !== 'Approved'">
              {{ formatDate((user as any).createdAt) }}
            </TableCell>
            <TableCell>
              <span :class="cn('chip', user.isActive ? 'chip-active' : 'chip-disabled')">
                {{ t(user.isActive ? 'common.active' : 'common.disabled') }}
              </span>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <Button
                  v-if="filter === 'Approved'"
                  :variant="user.isActive ? 'destructive' : 'default'"
                  size="sm"
                  :disabled="loading"
                  @click="toggleActive(user)"
                >
                  <component :is="user.isActive ? Ban : CheckCircle2" class="h-4 w-4" />
                  {{ user.isActive ? t('common.disable') : t('common.enable') }}
                </Button>
                <template v-else>
                  <Button size="sm" :disabled="loading" @click="openApprove(user)">
                    <UserCheck class="h-4 w-4" /> {{ t('users.approve') }}
                  </Button>
                  <Button
                    v-if="filter === 'Pending'"
                    variant="destructive"
                    size="sm"
                    :disabled="loading"
                    @click="reject(user)"
                  >
                    <Ban class="h-4 w-4" /> {{ t('users.reject') }}
                  </Button>
                </template>
                <!-- View profile link — always shown for approved users -->
                <Button
                  v-if="filter === 'Approved'"
                  variant="outline"
                  size="sm"
                  @click="router.push(`/users/${user.id}/profile`)"
                >
                  <UserRound class="h-4 w-4" />
                  {{ t('profile.viewProfile') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  </div>

  <!-- Add user dialog -->
  <Dialog v-model:open="addOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('users.addUser') }}</DialogTitle>
      </DialogHeader>
      <form class="flex flex-col gap-3 pt-2" @submit.prevent="addUser">
        <div class="flex flex-col gap-2">
          <Label for="u-email">{{ t('users.email') }}</Label>
          <Input id="u-email" v-model="addForm.email" type="email" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="u-name">{{ t('users.displayName') }}</Label>
          <Input id="u-name" v-model="addForm.displayName" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="u-pass">{{ t('users.password') }}</Label>
          <Input id="u-pass" v-model="addForm.password" type="password" />
        </div>
        <div class="flex flex-col gap-2">
          <Label>{{ t('users.role') }}</Label>
          <Select
            :model-value="addForm.roleId ? String(addForm.roleId) : undefined"
            @update:model-value="(v: any) => (addForm.roleId = v != null ? Number(v) : 0)"
          >
            <SelectTrigger>
              <SelectValue :placeholder="t('users.role')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="role in activeRoles()" :key="role.id" :value="String(role.id)">
                {{ role.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="addOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="addInvalid || loading" @click="addUser">
          <Plus class="h-4 w-4" /> {{ t('users.addUser') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Approve-as dialog -->
  <Dialog
    :open="approveOpenFor !== null"
    @update:open="(o: boolean) => { if (!o) approveOpenFor = null; }"
  >
    <DialogContent class="max-w-[360px]">
      <DialogHeader>
        <DialogTitle>{{ t('users.approveAs') }}</DialogTitle>
      </DialogHeader>
      <template v-for="user in users" :key="'ap-' + user.id">
        <div v-if="approveOpenFor === user.id" class="flex flex-col gap-3 pt-2">
          <Select
            :model-value="approveSelection[user.id!] ? String(approveSelection[user.id!]) : undefined"
            @update:model-value="(v: any) => v != null && (approveSelection[user.id!] = Number(v))"
          >
            <SelectTrigger>
              <SelectValue :placeholder="t('users.approveAs')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="r in activeRoles()" :key="r.id" :value="String(r.id)">
                {{ r.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button :disabled="loading" @click="approve(user)">
            {{ t('users.confirm') }}
          </Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
