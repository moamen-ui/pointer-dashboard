<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import type { ColumnDef } from '@tanstack/vue-table';
import {
  useGetApiAdminUsers,
  useGetApiAdminRoles,
  usePostApiAdminUsers,
  usePatchApiAdminUsersId,
  usePostApiAdminUsersIdApprove,
  usePostApiAdminUsersIdReject,
  getGetApiAdminUsersQueryKey,
  useGetApiAdminInvites,
  usePostApiAdminInvites,
  useDeleteApiAdminInvitesId,
  getGetApiAdminInvitesQueryKey,
  type UserResponse,
  type RoleResponse,
  type InviteResponse,
} from '@moamen-ui/pointer-vue';
import {
  Plus,
  Ban,
  CheckCircle2,
  UserCheck,
  UserRound,
  Users,
  Copy,
  Link2Off,
  MailCheck,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
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
import { formatRequestedAt } from '@/lib/formatRequestedAt';
import { cn } from '@/lib/utils';
import { confirm } from '@/composables/useConfirm';
import { toast } from '@/composables/useToast';
import EmptyState from '@/shared/EmptyState.vue';

type FilterStatus = 'Approved' | 'Pending' | 'Rejected';

// A union row type (real users + pending invites) with per-kind columns/actions --
// none of it forced into DataTable's core API, per this page's deliberate escape hatch.
type Row = ({ kind: 'user' } & UserResponse) | ({ kind: 'invite' } & InviteResponse);

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
const loading = computed(() => usersQuery.isLoading.value || busy.value);

// ── Pending invites — rendered as rows in the Pending view, right alongside
// real pending users; created via "Send invite" in the Add User dialog below.
// Once accepted, an invite becomes an Approved user directly and drops out here.
const invitesQuery = useGetApiAdminInvites();
const inviteList = computed<InviteResponse[]>(
  () => (invitesQuery.data.value ?? []) as InviteResponse[],
);
const pendingCount = computed(() => (pendingQuery.data.value?.length ?? 0) + inviteList.value.length);

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

// ── Add user: "Send invite" is the default mode, "Create directly" is secondary ──
const addOpen = ref(false);
const addMode = ref<'invite' | 'direct'>('invite');
const addForm = reactive({ email: '', displayName: '', password: '', roleId: 0 });

const addInvalid = computed(
  () =>
    !addForm.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email) ||
    !addForm.displayName ||
    !addForm.password ||
    !addForm.roleId,
);

const nonAdminActiveRoles = computed<RoleResponse[]>(
  () => roles.value.filter((r) => !r.grantsAdmin && r.isActive),
);

const inviteRoleId = ref<number | null>(null);
const inviteEmail = ref('');
const inviteExpiresDays = ref<number | undefined>(7);
const inviteMaxUses = ref<number | undefined>(undefined);
const createdInvite = ref<{ url: string; emailSent: string | null } | null>(null);

const createInvite = usePostApiAdminInvites();

function openAdd() {
  addForm.email = '';
  addForm.displayName = '';
  addForm.password = '';
  addForm.roleId = activeRoles()[0]?.id ?? 0;
  inviteRoleId.value = nonAdminActiveRoles.value[0]?.id ?? null;
  inviteEmail.value = '';
  inviteExpiresDays.value = 7;
  inviteMaxUses.value = undefined;
  createdInvite.value = null;
  addMode.value = 'invite';
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

async function sendInvite() {
  if (!inviteRoleId.value) return;
  try {
    const res = (await createInvite.mutateAsync({
      data: {
        roleId: inviteRoleId.value ?? undefined,
        email: inviteEmail.value || undefined,
        expiresInDays: inviteExpiresDays.value ?? undefined,
        maxUses: inviteMaxUses.value ?? undefined,
      },
    })) as unknown as InviteResponse;
    createdInvite.value = {
      url: res.url ?? '',
      emailSent: res.emailSent && res.email ? res.email : null,
    };
    toast(t('invite.created'));
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminInvitesQueryKey() });
  } catch (e) {
    toast(extractMessage(e));
  }
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast(t('invite.copied'));
  } catch {
    toast(url);
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

function requestedAt(user: UserResponse): string | null {
  // createdAt lands in UserResponse with the next client publish; narrow cast until then
  return (user as { createdAt?: string | null }).createdAt ?? null;
}

const revokeInvite = useDeleteApiAdminInvitesId();

async function onRevoke(id: number) {
  try {
    await revokeInvite.mutateAsync({ id });
    toast(t('invite.revoked'));
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminInvitesQueryKey() });
  } catch (e) {
    toast(extractMessage(e));
  }
}

function formatInviteDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

const rows = computed<Row[]>(() => {
  const userRows: Row[] = users.value.map((u) => ({ kind: 'user' as const, ...u }));
  if (filter.value !== 'Pending') return userRows;
  const invRows: Row[] = inviteList.value.map((i) => ({ kind: 'invite' as const, ...i }));
  return [...userRows, ...invRows];
});

// A computed so headers follow live language switches, and the conditional
// "requested" column follows the active filter.
const columns = computed<ColumnDef<typeof dataTableFeatures, Row>[]>(() => {
  const cols: ColumnDef<typeof dataTableFeatures, Row>[] = [
    { accessorKey: 'email', header: t('users.email'), enableSorting: false },
    { id: 'displayName', header: t('users.name'), enableSorting: false },
    { id: 'role', header: t('users.role'), enableSorting: false },
  ];
  if (filter.value !== 'Approved') {
    cols.push({ id: 'requested', header: t('overview.requested'), enableSorting: false });
  }
  cols.push({ id: 'status', header: t('users.status'), enableSorting: false });
  return cols;
});

function actionsFor(row: Row): RowActionItem[] {
  if (row.kind === 'invite') {
    const items: RowActionItem[] = [];
    if (row.url) {
      items.push({ label: t('invite.copy'), icon: Copy, onClick: () => void copyUrl(row.url!) });
    }
    items.push({ label: t('invite.revoke'), icon: Link2Off, severity: 'danger', onClick: () => void onRevoke(row.id!) });
    return items;
  }
  const user = row;
  const items: RowActionItem[] = [];
  if (filter.value === 'Approved') {
    items.push({
      label: t(user.isActive ? 'common.disable' : 'common.enable'),
      icon: user.isActive ? Ban : CheckCircle2,
      severity: user.isActive ? 'danger' : 'neutral',
      disabled: loading.value,
      onClick: () => void toggleActive(user),
    });
  } else {
    items.push({ label: t('users.approve'), icon: UserCheck, disabled: loading.value, onClick: () => openApprove(user) });
    if (filter.value === 'Pending') {
      items.push({ label: t('users.reject'), icon: Ban, severity: 'danger', disabled: loading.value, onClick: () => void reject(user) });
    }
  }
  // View profile link — always shown for approved users (matches this page's
  // pre-existing convention, kept as-is).
  if (filter.value === 'Approved') {
    items.push({ label: t('profile.viewProfile'), icon: UserRound, onClick: () => router.push(`/users/${user.id}/profile`) });
  }
  return items;
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

    <EmptyState
      v-if="(filter === 'Pending' ? users.length + inviteList.length : users.length) === 0 && !loading"
      :icon="Users"
      :message="t('users.empty')"
      :hint="t('users.emptyHint')"
    >
      <Button @click="openAdd">
        <Plus class="h-4 w-4" /> {{ t('users.addUser') }}
      </Button>
    </EmptyState>

    <!-- Escape hatch: rows are a union type (real users + pending invites) with
         per-kind columns/actions, none of which fit a homogeneous DataTable
         row shape -- every custom column renders through a scoped slot. -->
    <DataTable
      v-else
      :data="rows"
      :columns="columns"
      :actions="actionsFor"
      :actions-aria-label="t('users.actions')"
      :loading="loading"
    >
      <template #cell-email="{ row }">
        {{ row.kind === 'invite' ? (row.email ?? t('invite.anyone')) : row.email }}
      </template>
      <template #cell-displayName="{ row }">
        {{ row.kind === 'invite' ? '—' : row.displayName }}
      </template>
      <template #cell-role="{ row }">
        <template v-if="row.kind === 'invite'">{{ row.roleName ?? '—' }}</template>
        <template v-else>
          <Select
            v-if="filter === 'Approved'"
            :model-value="row.roleId != null ? String(row.roleId) : undefined"
            @update:model-value="(v: any) => v != null && changeRole(row, Number(v))"
          >
            <SelectTrigger class="min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="role in rolesForUser(row)" :key="role.id" :value="String(role.id)">
                {{ role.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <span v-else>{{ row.roleName }}</span>
        </template>
      </template>
      <template #cell-requested="{ row }">
        {{ row.kind === 'invite' ? `${t('invite.expires')}: ${formatInviteDate(row.expiresAt)}` : formatRequestedAt(requestedAt(row)) }}
      </template>
      <template #cell-status="{ row }">
        <span v-if="row.kind === 'invite'" class="chip chip-neutral">{{ t('invite.invited') }}</span>
        <span v-else :class="cn('chip', row.isActive ? 'chip-active' : 'chip-disabled')">
          {{ t(row.isActive ? 'common.active' : 'common.disabled') }}
        </span>
      </template>
    </DataTable>
  </div>

  <!-- Add user dialog — "Send invite" (default) or "Create directly" (secondary) -->
  <Dialog v-model:open="addOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('users.addUser') }}</DialogTitle>
      </DialogHeader>

      <div
        v-if="!createdInvite"
        class="inline-flex self-start overflow-hidden rounded-md border border-input"
      >
        <button
          type="button"
          :class="
            cn(
              'px-3 py-1.5 text-sm transition-colors',
              addMode === 'invite'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-accent hover:text-accent-foreground',
            )
          "
          @click="addMode = 'invite'"
        >
          {{ t('users.modeInvite') }}
        </button>
        <button
          type="button"
          :class="
            cn(
              'border-s border-input px-3 py-1.5 text-sm transition-colors',
              addMode === 'direct'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-accent hover:text-accent-foreground',
            )
          "
          @click="addMode = 'direct'"
        >
          {{ t('users.modeDirect') }}
        </button>
      </div>

      <template v-if="addMode === 'invite'">
        <div v-if="createdInvite" class="flex flex-col gap-3 pt-2">
          <div
            v-if="createdInvite.emailSent"
            class="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-300"
          >
            <MailCheck class="h-4 w-4 shrink-0" />
            <span>{{ t('invite.emailSent', { email: createdInvite.emailSent }) }}</span>
          </div>
          <div class="flex items-center gap-2 rounded-md bg-muted p-3">
            <span class="flex-1 truncate text-sm font-mono">{{ createdInvite.url }}</span>
            <Button type="button" size="sm" variant="outline" @click="copyUrl(createdInvite.url)">
              <Copy class="h-4 w-4 mr-1" />{{ t('invite.copy') }}
            </Button>
          </div>
        </div>
        <form v-else class="flex flex-col gap-3 pt-2" @submit.prevent="sendInvite">
          <p class="text-xs text-muted-foreground">{{ t('invite.sectionHint') }}</p>
          <div class="flex flex-col gap-1">
            <Label for="invite-role">{{ t('invite.role') }}</Label>
            <select
              id="invite-role"
              v-model="inviteRoleId"
              class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option :value="null" disabled>— {{ t('invite.role') }} —</option>
              <option v-for="r in nonAdminActiveRoles" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <Label for="invite-email">{{ t('invite.email') }}</Label>
            <Input id="invite-email" v-model="inviteEmail" type="email" placeholder="teammate@example.com" />
          </div>
          <div class="flex gap-3">
            <div class="flex flex-1 flex-col gap-1">
              <Label for="invite-expires">{{ t('invite.expiresDays') }}</Label>
              <Input id="invite-expires" v-model.number="inviteExpiresDays" type="number" :min="1" />
            </div>
            <div class="flex flex-1 flex-col gap-1">
              <Label for="invite-maxuses">{{ t('invite.maxUses') }}</Label>
              <Input id="invite-maxuses" v-model.number="inviteMaxUses" type="number" :min="1" placeholder="∞" />
            </div>
          </div>
        </form>
      </template>

      <form v-else class="flex flex-col gap-3 pt-2" @submit.prevent="addUser">
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
          <PasswordInput id="u-pass" v-model="addForm.password" />
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
        <template v-if="addMode === 'invite'">
          <Button v-if="createdInvite" @click="addOpen = false">{{ t('invite.done') }}</Button>
          <template v-else>
            <Button variant="outline" @click="addOpen = false">{{ t('common.cancel') }}</Button>
            <Button :disabled="!inviteRoleId || createInvite.isPending.value" @click="sendInvite">
              {{ t('invite.create') }}
            </Button>
          </template>
        </template>
        <template v-else>
          <Button variant="outline" @click="addOpen = false">{{ t('common.cancel') }}</Button>
          <Button :disabled="addInvalid || loading" @click="addUser">
            <Plus class="h-4 w-4" /> {{ t('users.addUser') }}
          </Button>
        </template>
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
