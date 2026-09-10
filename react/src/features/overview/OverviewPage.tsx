import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useGetApiAdminStats,
  useGetApiAdminUsers,
  useGetApiAdminRoles,
  usePostApiAdminUsersIdApprove,
  usePostApiAdminUsersIdReject,
  getGetApiAdminUsersQueryKey,
  getGetApiAdminStatsQueryKey,
  useGetApiAdminAiRulesInsights,
  type ProjectStats,
  type UserResponse,
  type AiInsightsResponse,
  type AiRuleResponse,
} from '@moamen-ui/pointer-react';
import {
  Lock,
  RefreshCw,
  Brain,
  Building2,
  Bot,
  Wrench,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table/DataTable';
import { CountCell, DiffstatLine, statusTone, toneTextClass } from '@/components/shared/CountCell';
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
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ui/toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { extractMessage } from '@/lib/error';
import { formatRequestedAt } from '@/lib/format';
import { useStatusCatalog } from '@/lib/status-catalog';
import { useAuth } from '@/lib/auth';

export function OverviewPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isSuperAdmin } = useAuth();
  const { data: stats, isFetching, refetch } = useGetApiAdminStats();
  const {
    data: insightsData,
    isFetching: isInsightsFetching,
    refetch: refetchInsights,
  } = useGetApiAdminAiRulesInsights({ includeDetails: isSuperAdmin });
  const aiInsights = insightsData as AiInsightsResponse | undefined;
  const [showDetailedRules, setShowDetailedRules] = useState(false);
  const catalog = useStatusCatalog();

  const reloadAll = () => {
    void refetch();
    void refetchInsights();
  };

  // Pending approvals — same data the /users Pending filter shows.
  const { data: pendingUsers = [] } = useGetApiAdminUsers({ status: 'pending' });
  const { data: roles = [] } = useGetApiAdminRoles();
  const activeRoles = useMemo(() => roles.filter((r) => r.isActive), [roles]);

  function reloadApprovals() {
    void qc.invalidateQueries({ queryKey: getGetApiAdminUsersQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetApiAdminStatsQueryKey() });
  }
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // ---- Approve (choose role) ----
  const [approveUserState, setApproveUserState] = useState<UserResponse | null>(null);
  const [approveRoleId, setApproveRoleId] = useState<number>(0);

  const approveMut = usePostApiAdminUsersIdApprove({
    mutation: {
      onSuccess: () => {
        setApproveUserState(null);
        reloadApprovals();
      },
      onError,
    },
  });

  function openApprove(user: UserResponse) {
    setApproveUserState(user);
    setApproveRoleId(user.roleId || activeRoles[0]?.id || 0);
  }
  function approve() {
    if (!approveUserState || approveRoleId < 1) return;
    approveMut.mutate({ id: approveUserState.id!, data: { roleId: approveRoleId } });
  }

  // ---- Reject (confirmed) ----
  const [rejectUser, setRejectUser] = useState<UserResponse | null>(null);
  const rejectMut = usePostApiAdminUsersIdReject({
    mutation: {
      onSuccess: () => {
        setRejectUser(null);
        reloadApprovals();
      },
      onError,
    },
  });
  function confirmReject() {
    if (rejectUser) rejectMut.mutate({ id: rejectUser.id! });
  }

  const totals = stats?.totals;
  const projects = stats?.projects ?? [];

  // Localized catalog label for a fixed stats status value (1–4).
  function statusLabel(value: number): string | undefined {
    const s = catalog.items.find((x) => x.value === value);
    return s ? catalog.displayLabel(s) : undefined;
  }

  // Projects table columns per §4 of build brief
  const columns: ColumnDef<ProjectStats>[] = [
    {
      id: 'gutter',
      header: '',
      cell: ({ row }) => (
        <div className="w-10 text-end font-mono text-[12px] text-faint-foreground">
          {row.index + 1}
        </div>
      ),
    },
    {
      accessorKey: 'name',
      header: t('overview.name'),
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-medium">{row.original.name}</span>
          <code className="shrink-0 whitespace-nowrap rounded bg-gutter px-1.5 py-0.5 font-mono text-[13px]">
            {row.original.key}
          </code>
        </div>
      ),
    },
    {
      accessorKey: 'comments',
      header: t('overview.comments'),
      cell: ({ row }) => (
        <span className="font-mono text-[14px]">{row.original.comments ?? 0}</span>
      ),
    },
    {
      accessorKey: 'privateComments',
      header: () => <Lock className="h-4 w-4" />,
      cell: ({ row }) => {
        const count = row.original.privateComments ?? 0;
        return count > 0 ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-[14px]"
            title={t('overview.privateHiddenTooltip')}
          >
            <Lock className="h-4 w-4" />
            {count}
          </span>
        ) : (
          <span className="text-faint-foreground">—</span>
        );
      },
    },
    ...catalog.items.map(
      (s): ColumnDef<ProjectStats> => ({
        id: `status_${s.value}`,
        accessorFn: (row) => getProjectStatusCount(row, s.value),
        header: () => (
          <span className={toneTextClass(statusTone(s.value))}>
            {catalog.displayLabel(s)}
          </span>
        ),
        cell: ({ row }) => (
          <CountCell
            count={getProjectStatusCount(row.original, s.value)}
            tone={statusTone(s.value)}
          />
        ),
      }),
    ),
    {
      id: 'status',
      accessorFn: (row: ProjectStats) => row.isActive,
      header: t('overview.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'neutral'}>
          {t(row.original.isActive ? 'common.active' : 'common.disabled')}
        </Badge>
      ),
    },
    {
      id: 'chevron',
      header: '',
      cell: () => <ChevronRight className="h-4 w-4 text-muted-foreground rtl:-scale-x-100" />,
    },
  ];

  const detailedRulesColumns = useMemo<ColumnDef<AiRuleResponse>[]>(
    () => [
      {
        accessorKey: 'tenantName',
        header: t('aiRules.workspace'),
      },
      {
        accessorKey: 'projectName',
        header: t('overview.projects'),
      },
      {
        id: 'scope',
        header: t('aiRules.ruleScope'),
        cell: ({ row }) => {
          if (row.original.isPersonal) {
            return <Badge variant="neutral">{t('aiRules.personalBadge')}</Badge>;
          }
          if (row.original.isProjectAdminRule) {
            return <Badge variant="warning">{t('aiRules.projectBadge')}</Badge>;
          }
          return <Badge variant="default">{t('aiRules.inheritedBadge')}</Badge>;
        },
      },
      {
        accessorKey: 'userName',
        header: t('aiRules.author'),
      },
      {
        accessorKey: 'title',
        header: t('aiRules.titleLabel'),
      },
      {
        accessorKey: 'prompt',
        header: t('aiRules.instruction'),
        cell: ({ row }) => (
          <span
            className="line-clamp-2 max-w-md font-mono text-xs text-muted-foreground"
            title={row.original.prompt ?? ''}
          >
            {row.original.prompt ?? '—'}
          </span>
        ),
      },
      {
        id: 'status',
        accessorFn: (row) => row.isActive,
        header: t('overview.status'),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'success' : 'neutral'}>
            {t(row.original.isActive ? 'common.active' : 'common.disabled')}
          </Badge>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-8">
      {/* 1. Title row */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
          {t('overview.title')}
        </h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={reloadAll}
          disabled={isFetching || isInsightsFetching}
        >
          <RefreshCw
            className={cn('h-4 w-4', (isFetching || isInsightsFetching) && 'animate-spin')}
          />
          {t('common.refresh')}
        </Button>
      </div>

      {/* 2. Diffstat line */}
      {totals && (
        <DiffstatLine
          items={[
            { label: t('overview.comments'), count: totals.comments ?? 0, tone: 'open' as const },
            { label: statusLabel(1) || t('overview.open'), count: totals.open ?? 0, tone: 'open' as const },
            { label: statusLabel(2) || t('overview.pending'), count: totals.pending ?? 0, tone: 'ready' as const },
            { label: statusLabel(3) || t('overview.completed'), count: totals.completed ?? 0, tone: 'completed' as const },
            { label: statusLabel(4) || t('overview.archived'), count: totals.archived ?? 0, tone: 'archived' as const },
            { label: t('overview.projects'), count: totals.projects ?? 0 },
            { label: t('overview.users'), count: totals.users ?? 0 },
            ...(totals.privateComments && totals.privateComments > 0
              ? [
                  {
                    label: t('overview.private'),
                    count: totals.privateComments,
                    icon: <Lock className="h-3 w-3" />,
                  },
                ]
              : []),
          ]}
        />
      )}

      {/* 3. Pending approvals section (only when non-empty) */}
      {pendingUsers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold leading-6">
              {t('overview.pendingApprovals')}
            </h2>
            <Badge variant="warning" className="h-6">
              {pendingUsers.length}
            </Badge>
          </div>
          <div className="rounded-md border border-border overflow-hidden">
            {pendingUsers.map((u, idx) => {
              const requestedAt = (u as { createdAt?: string | null }).createdAt ?? null;
              const busy = approveMut.isPending || rejectMut.isPending;
              return (
                <div
                  key={u.id}
                  className={cn(
                    'min-h-11 px-3 py-2 flex items-center gap-4 flex-wrap justify-between',
                    idx > 0 && 'border-t border-border-muted',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-foreground">{u.displayName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-[13px] text-muted-foreground">
                      <span>{u.email}</span>
                      <Badge variant="neutral" className="h-5">{u.roleName}</Badge>
                      {requestedAt && (
                        <span className="text-[12px]">
                          {t('overview.requested')}: {formatRequestedAt(requestedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => openApprove(u)}
                    >
                      {t('overview.approve')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => setRejectUser(u)}
                    >
                      {t('overview.reject')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Projects section */}
      <div className="space-y-3">
        <h2 className="text-[16px] font-semibold leading-6">{t('overview.projects')}</h2>
        {projects.length === 0 ? (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gutter">
                  <TableHead className="text-[12px] font-medium text-muted-foreground">
                    {/* gutter */}
                  </TableHead>
                  <TableHead className="text-[12px] font-medium text-muted-foreground">
                    {t('overview.name')}
                  </TableHead>
                  <TableHead className="text-[12px] font-medium text-muted-foreground">
                    {t('overview.comments')}
                  </TableHead>
                  <TableHead colSpan={catalog.items.length + 2} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[0, 1, 2].map((idx) => (
                  <TableRow key={idx} className="h-11 border-t border-dashed border-border-muted">
                    <TableCell colSpan={3} className="px-3 text-[14px] text-muted-foreground">
                      {idx === 0 ? t('overview.emptyProjects') : ''}
                    </TableCell>
                    {idx === 0 && (
                      <TableCell colSpan={catalog.items.length + 2} className="text-end px-3">
                        <Button
                          size="sm"
                          onClick={() => {
                            /* open install guide */
                          }}
                        >
                          {t('install.open')}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <DataTable
              data={projects}
              columns={columns}
              paginated
            />
          </div>
        )}
      </div>

      {/* 5. AI insights section (only when exists) */}
      {aiInsights && (
        <div className="space-y-3">
          <div>
            <h2 className="text-[16px] font-semibold leading-6">{t('aiRules.insightsTitle')}</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">{t('aiRules.insightsSubtitle')}</p>
          </div>

          {/* Diffstat line for 4 counts */}
          <DiffstatLine
            items={[
              { label: t('aiRules.totalRules'), count: aiInsights.totalRulesCount ?? 0 },
              { label: t('aiRules.tenantRules'), count: aiInsights.tenantRulesCount ?? 0, tone: 'open' as const },
              { label: t('aiRules.projectRules'), count: aiInsights.projectRulesCount ?? 0 },
              { label: t('aiRules.userRules'), count: aiInsights.userPersonalRulesCount ?? 0, tone: 'ready' as const },
            ]}
          />

          {/* Grid of bordered lists */}
          <div
            className={cn(
              'grid gap-4',
              isSuperAdmin && (aiInsights.tenantSummaries?.length ?? 0) > 0
                ? 'md:grid-cols-3'
                : 'md:grid-cols-2',
            )}
          >
            {/* Tenants (super admin) */}
            {isSuperAdmin && (aiInsights.tenantSummaries?.length ?? 0) > 0 && (
              <div className="rounded-md border border-border overflow-hidden">
                <div className="h-11 px-3 py-2 flex items-center gap-2 bg-gutter border-b border-border-muted">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[14px] font-medium text-foreground">
                    {t('aiRules.tenantSummaries')}
                  </span>
                </div>
                <div className="flex flex-col">
                  {(aiInsights.tenantSummaries ?? []).map((tenant, idx) => (
                    <div
                      key={tenant.tenantId ?? idx}
                      className={cn(
                        'min-h-11 px-3 py-2 flex items-center justify-between gap-4',
                        idx > 0 && 'border-t border-border-muted',
                      )}
                    >
                      <span className="text-[14px] font-medium text-foreground">
                        {tenant.tenantName}
                      </span>
                      <div className="text-[13px] text-muted-foreground">
                        {tenant.projectsCount ?? 0} {t('overview.projects')} · {tenant.rulesCount ?? 0}{' '}
                        {t('aiRules.section')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active tools */}
            <div className="rounded-md border border-border overflow-hidden">
              <div className="h-11 px-3 py-2 flex items-center gap-2 bg-gutter border-b border-border-muted">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span className="text-[14px] font-medium text-foreground">
                  {t('aiRules.activeTools')}
                </span>
              </div>
              {(aiInsights.toolUsage ?? []).length === 0 ? (
                <div className="px-3 py-2 text-[13px] text-muted-foreground">
                  {t('aiRules.noToolsYet')}
                </div>
              ) : (
                <div className="flex flex-col">
                  {(aiInsights.toolUsage ?? []).map((tool, idx) => (
                    <div
                      key={tool.toolName ?? idx}
                      className={cn(
                        'min-h-11 px-3 py-2 flex items-center justify-between gap-4',
                        idx > 0 && 'border-t border-border-muted',
                      )}
                    >
                      <span className="font-mono text-[13px] font-medium text-foreground">
                        {tool.toolName}
                      </span>
                      <div className="text-[13px] text-muted-foreground">
                        {tool.projectCount ?? 0} {t('overview.projects')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Developer adoption */}
            <div className="rounded-md border border-border overflow-hidden">
              <div className="h-11 px-3 py-2 flex items-center gap-2 bg-gutter border-b border-border-muted">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="text-[14px] font-medium text-foreground">
                  {t('aiRules.userSummaries')}
                </span>
              </div>
              {(aiInsights.userRuleSummaries ?? []).length === 0 ? (
                <div className="px-3 py-2 text-[13px] text-muted-foreground">
                  {t('aiRules.noPersonalRules')}
                </div>
              ) : (
                <div className="flex flex-col">
                  {(aiInsights.userRuleSummaries ?? []).map((user, idx) => (
                    <div
                      key={user.userId ?? idx}
                      className={cn(
                        'min-h-11 px-3 py-2 flex items-center justify-between gap-4',
                        idx > 0 && 'border-t border-border-muted',
                      )}
                    >
                      <span className="text-[14px] font-medium text-foreground">
                        {user.userName}
                      </span>
                      <div className="text-[13px] text-muted-foreground">
                        {user.rulesCount ?? 0} {t('aiRules.section')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Super Admin Detailed Rules Inspection */}
          {isSuperAdmin && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand" />
                  <span className="text-[14px] font-medium text-foreground">
                    {t('aiRules.detailedRulesTitle')}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDetailedRules((prev) => !prev)}
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      showDetailedRules && 'rotate-180',
                    )}
                  />
                  {t(showDetailedRules ? 'aiRules.hideDetails' : 'aiRules.inspectDetails')}
                </Button>
              </div>

              {showDetailedRules && (
                <DataTable
                  data={aiInsights.detailedRules ?? []}
                  columns={detailedRulesColumns}
                  searchable
                  searchPlaceholder={t('common.search')}
                  paginated
                  emptyIcon={Brain}
                  emptyMessage={t('aiRules.emptyDetailedRules')}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Approve dialog */}
      <Dialog open={!!approveUserState} onOpenChange={(o) => !o && setApproveUserState(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('overview.approve')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            <Label>{t('overview.approveAs')}</Label>
            <Select
              value={approveRoleId ? String(approveRoleId) : undefined}
              onValueChange={(v) => setApproveRoleId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('overview.approveAs')} />
              </SelectTrigger>
              <SelectContent>
                {activeRoles.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setApproveUserState(null)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={approveRoleId < 1 || approveMut.isPending} onClick={approve}>
              {t('overview.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject confirmation */}
      <ConfirmDialog
        open={!!rejectUser}
        message={t('overview.confirmReject', { name: rejectUser?.email })}
        confirmLabel={t('overview.reject')}
        confirmColor="warn"
        onConfirm={confirmReject}
        onCancel={() => setRejectUser(null)}
      />
    </div>
  );
}

/** Map a catalog status value to the matching field on a ProjectStats row. */
function getProjectStatusCount(row: ProjectStats, value: number | undefined): number {
  switch (value) {
    case 1: return row.open ?? 0;
    case 2: return row.pending ?? 0;
    case 3: return row.completed ?? 0;
    case 4: return row.archived ?? 0;
    default: return 0;
  }
}
