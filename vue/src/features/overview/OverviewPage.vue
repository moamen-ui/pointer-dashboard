<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiAdminStats,
  useGetApiAdminUsers,
  useGetApiAdminRoles,
  usePostApiAdminUsersIdApprove,
  usePostApiAdminUsersIdReject,
  getGetApiAdminUsersQueryKey,
  getGetApiAdminStatsQueryKey,
  type ProjectStats,
  type UserResponse,
  type RoleResponse,
} from '@moamen-ui/pointer-vue';
import {
  Folder,
  FolderOpen,
  Users as UsersIcon,
  MessageSquare,
  Circle,
  Clock,
  CheckCircle2,
  Archive,
  RefreshCw,
  Lock,
  UserCheck,
  Ban,
} from 'lucide-vue-next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import EmptyState from '@/shared/EmptyState.vue';
import {
  Dialog,
  DialogContent,
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
import { cn } from '@/lib/utils';
import { extractMessage } from '@/lib/error';
import { formatRequestedAt } from '@/lib/formatRequestedAt';
import { confirm } from '@/composables/useConfirm';
import { toast } from '@/composables/useToast';
import { useStatusCatalog } from '@/composables/useStatusCatalog';

const { t } = useI18n();
const queryClient = useQueryClient();

// Generated TanStack query hook (GET → useQuery). The package's customInstance
// already unwraps Result<T>, so data resolves to StatsResponse.
const { data: stats, isFetching, refetch } = useGetApiAdminStats();
const { color: statusColor, displayLabelFor: statusLabel } = useStatusCatalog();

// Pending approvals — same admin-users endpoint as the Users page, filtered to pending.
const pendingQuery = useGetApiAdminUsers({ status: 'pending' });
const rolesQuery = useGetApiAdminRoles();
const approveUser = usePostApiAdminUsersIdApprove();
const rejectUser = usePostApiAdminUsersIdReject();

const pendingUsers = computed<UserResponse[]>(() => pendingQuery.data.value ?? []);
const activeRoles = computed<RoleResponse[]>(() =>
  (rolesQuery.data.value ?? []).filter((r) => r.isActive),
);
const busy = ref(false);

function requestedAt(user: UserResponse): string | null {
  // createdAt lands in UserResponse with the next client publish; narrow cast until then
  return (user as { createdAt?: string | null }).createdAt ?? null;
}

// ── Approve (with role selection) ─────────────────────────────────────
const approveSelection = reactive<Record<number, number>>({});
const approveOpenFor = ref<number | null>(null);

function openApprove(user: UserResponse) {
  approveSelection[user.id!] = user.roleId ?? activeRoles.value[0]?.id ?? 0;
  approveOpenFor.value = user.id!;
}

async function approve(user: UserResponse) {
  const roleId = approveSelection[user.id!] ?? user.roleId;
  busy.value = true;
  try {
    await approveUser.mutateAsync({ id: user.id!, data: { roleId } });
    approveOpenFor.value = null;
    busy.value = false;
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminUsersQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminStatsQueryKey() });
  } catch (e) {
    busy.value = false;
    toast(extractMessage(e));
  }
}

// ── Reject ────────────────────────────────────────────────────────────
async function reject(user: UserResponse) {
  const ok = await confirm({
    message: t('overview.confirmReject', { name: user.email }),
    confirmLabel: t('overview.reject'),
    confirmVariant: 'destructive',
  });
  if (!ok) return;
  busy.value = true;
  try {
    await rejectUser.mutateAsync({ id: user.id! });
    busy.value = false;
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminUsersQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminStatsQueryKey() });
  } catch (e) {
    busy.value = false;
    toast(extractMessage(e));
  }
}

const totals = computed(() => stats.value?.totals);
const projects = computed<ProjectStats[]>(() => stats.value?.projects ?? []);

type Tone = 'slate';

const TONE: Record<Tone, { box: string; value: string }> = {
  slate: { box: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300', value: '' },
};

// Status value constants (CommentStatus enum: Open=1, ReadyToApply=2, Applied=3, Archived=4)
const STATUS_OPEN = 1;
const STATUS_READY = 2;
const STATUS_APPLIED = 3;
const STATUS_ARCHIVED = 4;

const cards = computed(() => [
  { key: 'overview.projects', value: totals.value?.projects, icon: Folder, statusValue: undefined },
  { key: 'overview.users', value: totals.value?.users, icon: UsersIcon, statusValue: undefined },
  { key: 'overview.comments', value: totals.value?.comments, icon: MessageSquare, statusValue: undefined },
  { key: 'overview.open', value: totals.value?.open, icon: Circle, statusValue: STATUS_OPEN },
  { key: 'overview.pending', value: totals.value?.pending, icon: Clock, statusValue: STATUS_READY },
  { key: 'overview.completed', value: totals.value?.completed, icon: CheckCircle2, statusValue: STATUS_APPLIED },
  { key: 'overview.archived', value: totals.value?.archived, icon: Archive, statusValue: STATUS_ARCHIVED },
]);
</script>

<template>
  <div class="flex flex-col gap-8">
    <!-- Stat cards -->
    <div class="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
      <Card v-for="card in cards" :key="card.key">
        <CardContent class="flex items-center gap-3.5 p-4">
          <div
            :class="cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl', TONE['slate'].box)"
            :style="card.statusValue != null ? { backgroundColor: statusColor(card.statusValue) + '22', color: statusColor(card.statusValue) } : {}"
          >
            <component :is="card.icon" class="h-6 w-6" />
          </div>
          <div class="flex flex-col">
            <div
              class="text-[1.7rem] font-bold leading-tight"
              :style="card.statusValue != null ? { color: statusColor(card.statusValue) } : {}"
            >
              {{ card.value ?? 0 }}
            </div>
            <div class="mt-0.5 text-[0.72rem] uppercase tracking-wide text-muted-foreground">
              {{ card.statusValue != null ? statusLabel(card.statusValue) : t(card.key) }}
            </div>
            <div
              v-if="card.key === 'overview.comments' && (totals?.privateComments ?? 0) > 0"
              class="mt-1 inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground"
            >
              {{ t('overview.privateHidden', { count: totals?.privateComments ?? 0 }) }}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Pending approvals -->
    <Card class="p-6">
      <h3 class="flex items-center gap-2 text-base font-semibold">
        <Clock class="h-5 w-5 text-amber-500" />
        {{ t('overview.pendingApprovals') }}
        <span
          class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-xs font-bold text-amber-600 dark:text-amber-400"
        >
          {{ pendingUsers.length }}
        </span>
      </h3>

      <EmptyState
        v-if="pendingUsers.length === 0 && !pendingQuery.isLoading.value"
        :icon="UserCheck"
        :message="t('overview.noPending')"
      />

      <div v-else class="mt-2 flex flex-col">
        <div
          v-for="u in pendingUsers"
          :key="u.id"
          class="flex flex-wrap items-center justify-between gap-4 border-t border-border py-3"
        >
          <div>
            <div class="font-semibold">{{ u.displayName }}</div>
            <div class="mt-0.5 flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
              <span>{{ u.email }}</span>
              <span class="chip chip-neutral">{{ u.roleName }}</span>
              <span v-if="requestedAt(u)" class="text-xs">
                {{ t('overview.requested') }}: {{ formatRequestedAt(requestedAt(u)) }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button size="sm" :disabled="busy" @click="openApprove(u)">
              <UserCheck class="h-4 w-4" /> {{ t('overview.approve') }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="text-destructive hover:text-destructive"
              :disabled="busy"
              @click="reject(u)"
            >
              <Ban class="h-4 w-4" /> {{ t('overview.reject') }}
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <!-- Projects breakdown -->
    <div>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">{{ t('overview.breakdown') }}</h2>
        <Button variant="outline" size="sm" :disabled="isFetching" @click="() => refetch()">
          <RefreshCw :class="cn('h-4 w-4', isFetching && 'animate-spin')" />
          {{ t('common.refresh') }}
        </Button>
      </div>

      <Card v-if="projects.length > 0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('overview.key') }}</TableHead>
              <TableHead>{{ t('overview.name') }}</TableHead>
              <TableHead>{{ t('overview.comments') }}</TableHead>
              <TableHead>{{ t('overview.private') }}</TableHead>
              <TableHead :style="{ color: statusColor(STATUS_OPEN) }">{{ statusLabel(STATUS_OPEN) }}</TableHead>
              <TableHead :style="{ color: statusColor(STATUS_READY) }">{{ statusLabel(STATUS_READY) }}</TableHead>
              <TableHead :style="{ color: statusColor(STATUS_APPLIED) }">{{ statusLabel(STATUS_APPLIED) }}</TableHead>
              <TableHead :style="{ color: statusColor(STATUS_ARCHIVED) }">{{ statusLabel(STATUS_ARCHIVED) }}</TableHead>
              <TableHead>{{ t('overview.status') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in projects" :key="row.projectId ?? row.key ?? ''">
              <TableCell>
                <code class="rounded bg-muted px-1.5 py-0.5 text-xs">{{ row.key }}</code>
              </TableCell>
              <TableCell>{{ row.name }}</TableCell>
              <TableCell>{{ row.comments }}</TableCell>
              <TableCell>
                <span
                  v-if="(row.privateComments ?? 0) > 0"
                  class="chip chip-private"
                  :title="t('overview.privateHiddenTooltip')"
                >
                  <Lock class="h-3 w-3" />
                  {{ row.privateComments }}
                </span>
                <span v-else class="text-muted-foreground">—</span>
              </TableCell>
              <TableCell class="font-medium" :style="{ color: statusColor(STATUS_OPEN) }">{{ row.open }}</TableCell>
              <TableCell class="font-medium" :style="{ color: statusColor(STATUS_READY) }">{{ row.pending }}</TableCell>
              <TableCell class="font-medium" :style="{ color: statusColor(STATUS_APPLIED) }">{{ row.completed }}</TableCell>
              <TableCell class="font-medium" :style="{ color: statusColor(STATUS_ARCHIVED) }">{{ row.archived }}</TableCell>
              <TableCell>
                <span :class="cn('chip', row.isActive ? 'chip-active' : 'chip-disabled')">
                  {{ t(row.isActive ? 'common.active' : 'common.disabled') }}
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <EmptyState
        v-else-if="!isFetching"
        :icon="FolderOpen"
        :message="t('overview.emptyProjects')"
        :hint="t('overview.emptyProjectsHint')"
      />
    </div>
  </div>

  <!-- Approve-as dialog -->
  <Dialog
    :open="approveOpenFor !== null"
    @update:open="(o: boolean) => { if (!o) approveOpenFor = null; }"
  >
    <DialogContent class="max-w-[360px]">
      <DialogHeader>
        <DialogTitle>{{ t('overview.approveAs') }}</DialogTitle>
      </DialogHeader>
      <template v-for="u in pendingUsers" :key="'ov-ap-' + u.id">
        <div v-if="approveOpenFor === u.id" class="flex flex-col gap-3 pt-2">
          <Select
            :model-value="approveSelection[u.id!] ? String(approveSelection[u.id!]) : undefined"
            @update:model-value="(v: any) => v != null && (approveSelection[u.id!] = Number(v))"
          >
            <SelectTrigger>
              <SelectValue :placeholder="t('overview.approveAs')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="r in activeRoles" :key="r.id" :value="String(r.id)">
                {{ r.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button :disabled="busy" @click="approve(u)">
            {{ t('overview.confirm') }}
          </Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
