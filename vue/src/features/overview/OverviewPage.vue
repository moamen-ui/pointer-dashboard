<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import type { ColumnDef } from '@tanstack/vue-table';
import {
  useGetApiAdminStats,
  useGetApiAdminUsers,
  useGetApiAdminRoles,
  usePostApiAdminUsersIdApprove,
  usePostApiAdminUsersIdReject,
  useGetApiAdminAiRulesInsights,
  getGetApiAdminUsersQueryKey,
  getGetApiAdminStatsQueryKey,
  type ProjectStats,
  type UserResponse,
  type RoleResponse,
  type AiInsightsResponse,
  type AiRuleResponse,
  type GetApiAdminAiRulesInsightsParams,
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
  Brain,
  Bot,
  Wrench,
  Shield,
  Building2,
  ChevronUp,
  ChevronDown,
} from 'lucide-vue-next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, dataTableFeatures } from '@/components/shared/data-table';
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
import { useAuth } from '@/composables/useAuth';

const { t } = useI18n();
const queryClient = useQueryClient();
const { isSuperAdmin } = useAuth();

// Generated TanStack query hook (GET → useQuery). The package's customInstance
// already unwraps Result<T>, so data resolves to StatsResponse.
const { data: stats, isFetching, refetch } = useGetApiAdminStats();
const { items: statusItems, color: statusColor, displayLabel: statusLabel, displayLabelFor: statusLabelFor } = useStatusCatalog();

// AI Insights & Rules
const aiInsightsParams = computed<GetApiAdminAiRulesInsightsParams>(() => ({
  includeDetails: isSuperAdmin.value,
}));
const { data: aiInsightsData, refetch: refetchAiInsights } = useGetApiAdminAiRulesInsights(aiInsightsParams);
const aiInsights = computed<AiInsightsResponse | undefined>(
  () => aiInsightsData.value as unknown as AiInsightsResponse | undefined,
);

const showDetailedRules = ref(false);
const detailedRulesRows = computed<AiRuleResponse[]>(() => aiInsights.value?.detailedRules ?? []);

const detailedRulesColumns = computed<ColumnDef<typeof dataTableFeatures, AiRuleResponse>[]>(() => [
  { accessorKey: 'tenantName', header: t('aiRules.workspace'), sortingFn: 'alphanumeric' },
  { accessorKey: 'projectName', header: t('overview.projects'), sortingFn: 'alphanumeric' },
  { id: 'scope', header: t('aiRules.ruleScope') },
  { accessorKey: 'userName', header: t('aiRules.author'), sortingFn: 'alphanumeric' },
  { accessorKey: 'title', header: t('aiRules.titleLabel'), sortingFn: 'alphanumeric' },
  { id: 'prompt', header: t('aiRules.instruction') },
  { id: 'status', header: t('overview.status') },
]);

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

/** Map status value → count field on ProjectStats. */
function statusCellValue(row: ProjectStats, statusValue: number | undefined): number {
  switch (statusValue) {
    case 1: return row.open ?? 0;
    case 2: return row.pending ?? 0;
    case 3: return row.completed ?? 0;
    case 4: return row.archived ?? 0;
    default: return 0;
  }
}

// Dynamic columns: key, name, comments, privateComments, status_1..N, status.
// A computed so headers follow live language/catalog changes. Each per-status
// header is tinted with that status's configured color (matching the Angular
// reference's headerColor) via TanStack's header render hook.
const columns = computed<ColumnDef<typeof dataTableFeatures, ProjectStats>[]>(() => [
  { accessorKey: 'key', header: t('overview.key'), sortingFn: 'alphanumeric' },
  { accessorKey: 'name', header: t('overview.name'), sortingFn: 'alphanumeric' },
  { accessorKey: 'comments', header: t('overview.comments') },
  { accessorKey: 'privateComments', header: t('overview.private') },
  ...statusItems.value.map(
    (s): ColumnDef<typeof dataTableFeatures, ProjectStats> => ({
      id: `status_${s.value}`,
      accessorFn: (row) => statusCellValue(row, s.value),
      header: () => h('span', { style: { color: statusColor(s.value) } }, statusLabel(s)),
      cell: ({ getValue }) =>
        h('span', { class: 'font-medium', style: { color: statusColor(s.value) } }, String(getValue() ?? 0)),
    }),
  ),
  { id: 'status', accessorFn: (row) => (row.isActive ? 1 : 0), header: t('overview.status') },
]);

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
              {{ card.statusValue != null ? statusLabelFor(card.statusValue) : t(card.key) }}
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

    <!-- AI Coding Tools & Rules Insights -->
    <Card v-if="aiInsights" class="p-6">
      <div class="flex flex-col gap-1">
        <h3 class="flex items-center gap-2 text-base font-semibold">
          <Brain class="h-5 w-5 text-primary" />
          {{ t('aiRules.insightsTitle') }}
        </h3>
        <p class="text-xs text-muted-foreground">{{ t('aiRules.insightsSubtitle') }}</p>
      </div>

      <!-- Rules Counts -->
      <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="flex flex-col rounded-lg border border-border p-3">
          <span class="text-xs uppercase tracking-wider text-muted-foreground">{{ t('aiRules.totalRules') }}</span>
          <span class="mt-1 text-2xl font-bold">{{ aiInsights.totalRulesCount ?? 0 }}</span>
        </div>
        <div class="flex flex-col rounded-lg border border-border p-3">
          <span class="text-xs uppercase tracking-wider text-muted-foreground">{{ t('aiRules.tenantRules') }}</span>
          <span class="mt-1 text-2xl font-bold text-primary">{{ aiInsights.tenantRulesCount ?? 0 }}</span>
        </div>
        <div class="flex flex-col rounded-lg border border-border p-3">
          <span class="text-xs uppercase tracking-wider text-muted-foreground">{{ t('aiRules.projectRules') }}</span>
          <span class="mt-1 text-2xl font-bold">{{ aiInsights.projectRulesCount ?? 0 }}</span>
        </div>
        <div class="flex flex-col rounded-lg border border-border p-3">
          <span class="text-xs uppercase tracking-wider text-muted-foreground">{{ t('aiRules.userRules') }}</span>
          <span class="mt-1 text-2xl font-bold text-amber-500">{{ aiInsights.userPersonalRulesCount ?? 0 }}</span>
        </div>
      </div>

      <!-- Active Tools and Developer Adoption (and Workspaces for Super Admin) -->
      <div
        :class="cn('mt-4 grid grid-cols-1 gap-4', isSuperAdmin && (aiInsights.tenantSummaries?.length ?? 0) > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2')"
      >
        <!-- Workspace adoption for Super Admin -->
        <div
          v-if="isSuperAdmin && (aiInsights.tenantSummaries?.length ?? 0) > 0"
          class="rounded-lg border border-border p-4"
        >
          <div class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Building2 class="h-4 w-4 text-muted-foreground" />
            <span>{{ t('aiRules.tenantSummaries') }}</span>
          </div>
          <div class="flex flex-col gap-2">
            <div
              v-for="tenant in aiInsights.tenantSummaries ?? []"
              :key="tenant.tenantId ?? tenant.tenantName ?? ''"
              class="flex items-center justify-between border-b border-border py-1 text-xs last:border-0"
            >
              <span class="font-medium">{{ tenant.tenantName }}</span>
              <div class="flex items-center gap-2 text-muted-foreground">
                <span>{{ tenant.projectsCount ?? 0 }} {{ t('overview.projects') }}</span>
                <span class="font-semibold text-foreground">{{ tenant.rulesCount ?? 0 }} {{ t('aiRules.section') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Registered AI Tools -->
        <div class="rounded-lg border border-border p-4">
          <div class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Bot class="h-4 w-4 text-muted-foreground" />
            <span>{{ t('aiRules.activeTools') }}</span>
          </div>
          <p v-if="(aiInsights.toolUsage ?? []).length === 0" class="text-xs text-muted-foreground">
            {{ t('aiRules.noToolsYet') }}
          </p>
          <div v-else class="flex flex-col gap-2">
            <div
              v-for="tool in aiInsights.toolUsage ?? []"
              :key="tool.toolName ?? ''"
              class="flex items-center justify-between border-b border-border py-1 text-xs last:border-0"
            >
              <span class="font-mono font-medium">{{ tool.toolName }}</span>
              <div class="flex items-center gap-2 text-muted-foreground">
                <span>{{ tool.projectCount ?? 0 }} {{ t('overview.projects') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Developer adoption -->
        <div class="rounded-lg border border-border p-4">
          <div class="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Wrench class="h-4 w-4 text-muted-foreground" />
            <span>{{ t('aiRules.userSummaries') }}</span>
          </div>
          <p v-if="(aiInsights.userRuleSummaries ?? []).length === 0" class="text-xs text-muted-foreground">
            {{ t('aiRules.noPersonalRules') }}
          </p>
          <div v-else class="flex flex-col gap-2">
            <div
              v-for="user in aiInsights.userRuleSummaries ?? []"
              :key="user.userId ?? user.userName ?? ''"
              class="flex items-center justify-between border-b border-border py-1 text-xs last:border-0"
            >
              <span class="font-medium">{{ user.userName }}</span>
              <span class="font-semibold text-foreground">{{ user.rulesCount ?? 0 }} {{ t('aiRules.section') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Super Admin Detailed Rules Inspection -->
      <div v-if="isSuperAdmin" class="mt-5 border-t border-border pt-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield class="h-4 w-4 text-primary" />
            <span class="font-medium">{{ t('aiRules.detailedRulesTitle') }}</span>
          </div>
          <Button variant="outline" size="sm" @click="showDetailedRules = !showDetailedRules">
            <component :is="showDetailedRules ? ChevronUp : ChevronDown" class="h-4 w-4" />
            {{ t(showDetailedRules ? 'aiRules.hideDetails' : 'aiRules.inspectDetails') }}
          </Button>
        </div>

        <div v-if="showDetailedRules" class="mt-4">
          <DataTable
            :data="detailedRulesRows"
            :columns="detailedRulesColumns"
            paginated
            searchable
            :empty-icon="Brain"
            :empty-message="t('aiRules.emptyDetailedRules')"
          >
            <template #cell-scope="{ row }">
              <Badge v-if="row.isPersonal" variant="neutral">{{ t('aiRules.personalBadge') }}</Badge>
              <Badge v-else-if="row.isProjectAdminRule" variant="warning">{{ t('aiRules.projectBadge') }}</Badge>
              <Badge v-else variant="default">{{ t('aiRules.inheritedBadge') }}</Badge>
            </template>
            <template #cell-prompt="{ row }">
              <span class="line-clamp-2 text-xs font-mono text-muted-foreground" :title="row.prompt ?? undefined">{{ row.prompt }}</span>
            </template>
            <template #cell-status="{ row }">
              <Badge :variant="row.isActive ? 'success' : 'destructive'">
                {{ t(row.isActive ? 'common.active' : 'common.disabled') }}
              </Badge>
            </template>
          </DataTable>
        </div>
      </div>
    </Card>

    <!-- Projects breakdown -->
    <div>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">{{ t('overview.breakdown') }}</h2>
        <Button variant="outline" size="sm" :disabled="isFetching" @click="() => { void refetch(); void refetchAiInsights(); }">
          <RefreshCw :class="cn('h-4 w-4', isFetching && 'animate-spin')" />
          {{ t('common.refresh') }}
        </Button>
      </div>

      <DataTable
        :data="projects"
        :columns="columns"
        paginated
        :loading="isFetching"
        :empty-icon="FolderOpen"
        :empty-message="t('overview.emptyProjects')"
        :empty-hint="t('overview.emptyProjectsHint')"
      >
        <template #cell-key="{ row }">
          <code class="rounded bg-muted px-1.5 py-0.5 text-xs">{{ row.key }}</code>
        </template>
        <template #cell-privateComments="{ row }">
          <span
            v-if="(row.privateComments ?? 0) > 0"
            class="chip chip-private"
            :title="t('overview.privateHiddenTooltip')"
          >
            <Lock class="h-3 w-3" />
            {{ row.privateComments }}
          </span>
          <span v-else class="text-muted-foreground">—</span>
        </template>
        <template #cell-status="{ row }">
          <Badge :variant="row.isActive ? 'success' : 'destructive'">
            {{ t(row.isActive ? 'common.active' : 'common.disabled') }}
          </Badge>
        </template>
      </DataTable>
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
