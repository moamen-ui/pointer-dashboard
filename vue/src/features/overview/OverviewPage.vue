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
  FolderOpen,
  RefreshCw,
  Lock,
  Brain,
  Bot,
  Wrench,
  Shield,
  Building2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, dataTableFeatures } from '@/components/shared/data-table';
import Diffstat from '@/components/shared/Diffstat.vue';
import CountCell from '@/components/shared/CountCell.vue';
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
import { statusTone, toneTextClass } from '@/lib/statusTone';
import { useStatusCatalog } from '@/composables/useStatusCatalog';
import { useAuth } from '@/composables/useAuth';

const { t } = useI18n();
const queryClient = useQueryClient();
const { isSuperAdmin } = useAuth();

// Generated TanStack query hook (GET → useQuery). The package's customInstance
// already unwraps Result<T>, so data resolves to StatsResponse.
const { data: stats, isFetching, refetch } = useGetApiAdminStats();
const { items: statusItems, displayLabel: statusLabel, displayLabelFor: statusLabelFor } = useStatusCatalog();

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

// Status value constants (CommentStatus enum: Open=1, ReadyToApply=2, Applied=3, Archived=4)
const STATUS_OPEN = 1;
const STATUS_READY = 2;
const STATUS_APPLIED = 3;
const STATUS_ARCHIVED = 4;

// Diffstat items for top overview summary
const diffstatItems = computed(() => [
  { count: totals.value?.comments ?? 0, label: t('overview.comments'), severity: 'open' as const },
  { count: totals.value?.open ?? 0, label: statusLabelFor(STATUS_OPEN), severity: 'open' as const },
  { count: totals.value?.pending ?? 0, label: statusLabelFor(STATUS_READY), severity: 'ready' as const },
  { count: totals.value?.completed ?? 0, label: statusLabelFor(STATUS_APPLIED), severity: 'completed' as const },
  { count: totals.value?.archived ?? 0, label: statusLabelFor(STATUS_ARCHIVED), severity: 'archived' as const },
  { count: totals.value?.projects ?? 0, label: t('overview.projects') },
  { count: totals.value?.users ?? 0, label: t('overview.users') },
]);

// Dynamic columns per §4 of build brief:
// gutter → name (with key chip) → comments → privateComments (lock icon header) → status columns → status badge → chevron
// A computed so headers follow live language/catalog changes.
const columns = computed<ColumnDef<typeof dataTableFeatures, ProjectStats>[]>(() => [
  {
    id: 'name',
    accessorKey: 'name',
    header: t('overview.name'),
    sortingFn: 'alphanumeric',
    cell: ({ row }) => {
      const children = [
        h('span', { class: 'truncate text-[14px] font-medium' }, String(row.original.name ?? '')),
      ];
      if (row.original.key) {
        children.push(
          h(
            'code',
            { class: 'shrink-0 whitespace-nowrap rounded bg-gutter px-1.5 py-0.5 font-mono text-[13px]' },
            String(row.original.key),
          ),
        );
      }
      return h('div', { class: 'flex min-w-0 items-center gap-2' }, children);
    },
  },
  {
    accessorKey: 'comments',
    header: t('overview.comments'),
    cell: ({ getValue }) =>
      h('span', { class: 'font-mono text-[14px]' }, String(getValue() as number)),
  },
  {
    id: 'privateComments',
    accessorKey: 'privateComments',
    header: () => h(Lock, { class: 'h-4 w-4', title: t('overview.privateHiddenTooltip') }),
    cell: ({ row }) => {
      const count = row.original.privateComments ?? 0;
      if (count > 0) {
        return h('span', { class: 'inline-flex items-center gap-1 font-mono text-[14px]', title: t('overview.privateHiddenTooltip') }, [
          h(Lock, { class: 'h-4 w-4' }),
          String(count),
        ]);
      }
      return h('span', { class: 'text-faint-foreground' }, '—');
    },
  },
  ...statusItems.value.map(
    (s): ColumnDef<typeof dataTableFeatures, ProjectStats> => ({
      id: `status_${s.value}`,
      accessorFn: (row) => statusCellValue(row, s.value),
      header: () => h('span', { class: toneTextClass(statusTone(s.value)) }, statusLabel(s)),
      cell: ({ getValue }) => {
        const severity = s.value === 1 ? 'open' : s.value === 2 ? 'ready' : s.value === 3 ? 'completed' : 'archived';
        return h(CountCell, { count: getValue() as number, severity });
      },
    }),
  ),
  {
    id: 'isActive',
    accessorFn: (row) => row.isActive,
    header: t('overview.status'),
    cell: ({ row }) =>
      h(Badge, { variant: row.original.isActive ? 'success' : 'destructive' }, {
        default: () => t(row.original.isActive ? 'common.active' : 'common.disabled'),
      }),
  },
  {
    id: 'chevron',
    header: '',
    enableSorting: false,
    cell: () => h(ChevronRight, { class: 'h-4 w-4 text-muted-foreground rtl:-scale-x-100' }),
  },
]);
</script>

<template>
  <div class="space-y-8">
    <!-- Title row -->
    <div class="flex items-center justify-between gap-4 mb-4">
      <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">{{ t('nav.overview') }}</h1>
      <Button variant="secondary" size="sm" :disabled="isFetching" @click="() => { void refetch(); void refetchAiInsights(); }">
        <RefreshCw :class="cn('h-4 w-4', isFetching && 'animate-spin')" />
        {{ t('common.refresh') }}
      </Button>
    </div>

    <!-- Diffstat line -->
    <Diffstat :items="diffstatItems" :privateComments="totals?.privateComments ?? 0" />

    <!-- Pending approvals - only when there are pending users -->
    <div v-if="pendingUsers.length > 0">
      <div class="flex items-center gap-2 mb-3">
        <h2 class="text-[16px] font-semibold leading-6">{{ t('overview.pendingApprovals') }}</h2>
        <Badge variant="warning">{{ pendingUsers.length }}</Badge>
      </div>

      <div class="rounded-md border border-border overflow-hidden">
        <div
          v-for="u in pendingUsers"
          :key="u.id"
          class="min-h-11 px-3 py-2 flex items-center gap-4 border-t border-border-muted first:border-t-0 justify-between"
        >
          <div class="flex flex-col min-w-0 flex-1">
            <div class="text-[14px] font-medium text-foreground">{{ u.displayName }}</div>
            <div class="flex items-center gap-2.5 mt-1 text-[13px] text-muted-foreground flex-wrap">
              <span>{{ u.email }}</span>
              <Badge variant="neutral" class="text-[12px]">{{ u.roleName }}</Badge>
              <span v-if="requestedAt(u)" class="text-[12px]">
                {{ t('overview.requested') }}: {{ formatRequestedAt(requestedAt(u)) }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" :disabled="busy" @click="openApprove(u)">
              {{ t('overview.approve') }}
            </Button>
            <Button variant="secondary" size="sm" :disabled="busy" @click="reject(u)">
              {{ t('overview.reject') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Projects section -->
    <div>
      <h2 class="text-[16px] font-semibold leading-6 mb-3">{{ t('overview.projects') }}</h2>

      <DataTable
        :data="projects"
        :columns="columns"
        gutter
        paginated
        :loading="isFetching"
        :empty-icon="FolderOpen"
        :empty-message="t('overview.emptyProjects')"
        :empty-hint="t('overview.emptyProjectsHint')"
      />
    </div>

    <!-- AI Coding Tools & Rules Insights -->
    <div v-if="aiInsights">
      <div class="flex flex-col gap-1 mb-3">
        <h2 class="text-[16px] font-semibold leading-6">{{ t('aiRules.insightsTitle') }}</h2>
        <p class="text-[14px] text-muted-foreground">{{ t('aiRules.insightsSubtitle') }}</p>
      </div>

      <!-- Rules Counts as diffstat line -->
      <Diffstat
        :items="[
          { count: aiInsights.totalRulesCount ?? 0, label: t('aiRules.totalRules') },
          { count: aiInsights.tenantRulesCount ?? 0, label: t('aiRules.tenantRules'), severity: 'open' },
          { count: aiInsights.projectRulesCount ?? 0, label: t('aiRules.projectRules') },
          { count: aiInsights.userPersonalRulesCount ?? 0, label: t('aiRules.userRules'), severity: 'ready' },
        ]"
        class="mb-6"
      />

      <!-- Active Tools and Developer Adoption (and Workspaces for Super Admin) -->
      <div
        :class="cn('grid grid-cols-1 gap-4', isSuperAdmin && (aiInsights.tenantSummaries?.length ?? 0) > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2')"
      >
        <!-- Workspace adoption for Super Admin -->
        <div
          v-if="isSuperAdmin && (aiInsights.tenantSummaries?.length ?? 0) > 0"
          class="rounded-md border border-border overflow-hidden"
        >
          <div class="bg-gutter min-h-11 px-3 py-2 flex items-center gap-2 text-[14px] font-medium text-foreground border-b border-border-muted">
            <Building2 class="h-4 w-4 text-muted-foreground" />
            <span>{{ t('aiRules.tenantSummaries') }}</span>
          </div>
          <div class="flex flex-col">
            <div
              v-for="tenant in aiInsights.tenantSummaries ?? []"
              :key="tenant.tenantId ?? tenant.tenantName ?? ''"
              class="min-h-11 px-3 py-2 flex items-center justify-between border-t border-border-muted first:border-t-0 text-[13px]"
            >
              <span class="font-medium text-foreground">{{ tenant.tenantName }}</span>
              <div class="flex items-center gap-2 text-muted-foreground">
                <span>{{ tenant.projectsCount ?? 0 }} {{ t('overview.projects') }}</span>
                <span class="font-medium text-foreground">{{ tenant.rulesCount ?? 0 }} {{ t('aiRules.section') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Registered AI Tools -->
        <div class="rounded-md border border-border overflow-hidden">
          <div class="bg-gutter min-h-11 px-3 py-2 flex items-center gap-2 text-[14px] font-medium text-foreground border-b border-border-muted">
            <Bot class="h-4 w-4 text-muted-foreground" />
            <span>{{ t('aiRules.activeTools') }}</span>
          </div>
          <div v-if="(aiInsights.toolUsage ?? []).length === 0" class="min-h-11 px-3 py-2 text-[13px] text-muted-foreground">
            {{ t('aiRules.noToolsYet') }}
          </div>
          <div v-else class="flex flex-col">
            <div
              v-for="tool in aiInsights.toolUsage ?? []"
              :key="tool.toolName ?? ''"
              class="min-h-11 px-3 py-2 flex items-center justify-between border-t border-border-muted first:border-t-0 text-[13px]"
            >
              <span class="font-mono font-medium text-foreground">{{ tool.toolName }}</span>
              <div class="flex items-center gap-2 text-muted-foreground">
                <span>{{ tool.projectCount ?? 0 }} {{ t('overview.projects') }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Developer adoption -->
        <div class="rounded-md border border-border overflow-hidden">
          <div class="bg-gutter min-h-11 px-3 py-2 flex items-center gap-2 text-[14px] font-medium text-foreground border-b border-border-muted">
            <Wrench class="h-4 w-4 text-muted-foreground" />
            <span>{{ t('aiRules.userSummaries') }}</span>
          </div>
          <div v-if="(aiInsights.userRuleSummaries ?? []).length === 0" class="min-h-11 px-3 py-2 text-[13px] text-muted-foreground">
            {{ t('aiRules.noPersonalRules') }}
          </div>
          <div v-else class="flex flex-col">
            <div
              v-for="user in aiInsights.userRuleSummaries ?? []"
              :key="user.userId ?? user.userName ?? ''"
              class="min-h-11 px-3 py-2 flex items-center justify-between border-t border-border-muted first:border-t-0 text-[13px]"
            >
              <span class="font-medium text-foreground">{{ user.userName }}</span>
              <span class="font-medium text-foreground">{{ user.rulesCount ?? 0 }} {{ t('aiRules.section') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Super Admin Detailed Rules Inspection -->
      <div v-if="isSuperAdmin" class="mt-8 border-t border-border pt-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Shield class="h-4 w-4 text-foreground" />
            <span class="font-medium">{{ t('aiRules.detailedRulesTitle') }}</span>
          </div>
          <Button variant="secondary" size="sm" @click="showDetailedRules = !showDetailedRules">
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
              <span class="line-clamp-2 text-[13px] font-mono text-muted-foreground" :title="row.prompt ?? undefined">{{ row.prompt }}</span>
            </template>
            <template #cell-status="{ row }">
              <Badge :variant="row.isActive ? 'success' : 'destructive'">
                {{ t(row.isActive ? 'common.active' : 'common.disabled') }}
              </Badge>
            </template>
          </DataTable>
        </div>
      </div>
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
