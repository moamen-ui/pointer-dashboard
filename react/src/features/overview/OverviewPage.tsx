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
  Brain,
  Building2,
  Bot,
  Wrench,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { DataTable } from '@/components/shared/data-table/DataTable';
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
import { cn } from '@/lib/utils';
import { extractMessage } from '@/lib/error';
import { formatRequestedAt } from '@/lib/format';
import { useStatusCatalog } from '@/lib/status-catalog';
import { useAuth } from '@/lib/auth';

type StatDef = {
  key: string; // i18n key
  label?: string; // catalog-driven status label; overrides t(key)
  value: number | undefined;
  icon: typeof Folder;
  tone: 'slate' | 'blue' | 'amber' | 'green';
}

const TONE: Record<StatDef['tone'], { box: string; value: string }> = {
  slate: { box: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300', value: '' },
  blue: { box: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300', value: 'text-blue-600 dark:text-blue-300' },
  amber: { box: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', value: 'text-amber-600 dark:text-amber-300' },
  green: { box: 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300', value: 'text-green-600 dark:text-green-300' },
};

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

  // Breakdown columns: key, name, comments, privateComments, one dynamic column
  // per catalog status (header + counts tinted with that status's configured
  // color — TanStack's header render fn applies the color inline, so the shared
  // DataTable needs no headerColor hook), then the project status badge.
  const columns: ColumnDef<ProjectStats>[] = [
    {
      accessorKey: 'key',
      header: t('overview.key'),
      cell: ({ row }) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.original.key}</code>
      ),
    },
    { accessorKey: 'name', header: t('overview.name') },
    { accessorKey: 'comments', header: t('overview.comments') },
    {
      accessorKey: 'privateComments',
      header: t('overview.private'),
      cell: ({ row }) => {
        const count = row.original.privateComments ?? 0;
        return count > 0 ? (
          <span className="chip chip-private" title={t('overview.privateHiddenTooltip')}>
            <Lock className="h-3 w-3" />
            {count}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    ...catalog.items.map(
      (s): ColumnDef<ProjectStats> => ({
        id: `status_${s.value}`,
        // Sort accessor for the dynamic column — maps to the matching count field.
        accessorFn: (row) => getProjectStatusCount(row, s.value),
        header: () => (
          <span style={{ color: s.color ?? undefined }}>{catalog.displayLabel(s)}</span>
        ),
        cell: ({ row }) => (
          <span className="font-medium" style={{ color: s.color ?? undefined }}>
            {getProjectStatusCount(row.original, s.value)}
          </span>
        ),
      }),
    ),
    {
      id: 'status',
      accessorFn: (row: ProjectStats) => row.isActive,
      header: t('overview.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'destructive'}>
          {t(row.original.isActive ? 'common.active' : 'common.disabled')}
        </Badge>
      ),
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
          <Badge variant={row.original.isActive ? 'success' : 'destructive'}>
            {t(row.original.isActive ? 'common.active' : 'common.disabled')}
          </Badge>
        ),
      },
    ],
    [t],
  );

  const cards: StatDef[] = [
    { key: 'overview.projects', value: totals?.projects, icon: Folder, tone: 'slate' },
    { key: 'overview.users', value: totals?.users, icon: UsersIcon, tone: 'slate' },
    { key: 'overview.comments', value: totals?.comments, icon: MessageSquare, tone: 'slate' },
    { key: 'overview.open', label: statusLabel(1), value: totals?.open, icon: Circle, tone: 'blue' },
    { key: 'overview.pending', label: statusLabel(2), value: totals?.pending, icon: Clock, tone: 'amber' },
    { key: 'overview.completed', label: statusLabel(3), value: totals?.completed, icon: CheckCircle2, tone: 'green' },
    { key: 'overview.archived', label: statusLabel(4), value: totals?.archived, icon: Archive, tone: 'slate' },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Stat cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
        {cards.map(({ key, label, value, icon: Icon, tone }) => (
          <Card key={key}>
            <CardContent className="flex items-center gap-3.5 p-4">
              <div
                className={cn(
                  'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
                  TONE[tone].box,
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <div className={cn('text-[1.7rem] font-bold leading-tight', TONE[tone].value)}>
                  {value ?? 0}
                </div>
                <div className="mt-0.5 text-[0.72rem] uppercase tracking-wide text-muted-foreground">
                  {label ?? t(key)}
                </div>
                {key === 'overview.comments' && (totals?.privateComments ?? 0) > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                    {t('overview.privateHidden', { count: totals?.privateComments ?? 0 })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending approvals */}
      <Card>
        <CardContent className="p-5 pt-5">
          <h3 className="flex items-center gap-2 text-[1.05rem] font-semibold">
            {t('overview.pendingApprovals')}
            <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[11px] bg-amber-50 px-[7px] text-[0.78rem] font-bold text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
              {pendingUsers.length}
            </span>
          </h3>
          {pendingUsers.length === 0 ? (
            <EmptyState icon={UserCheck} message={t('overview.noPending')} />
          ) : (
            <div className="flex flex-col">
              {pendingUsers.map((u) => {
                // createdAt = when access was requested. The API returns it;
                // the generated client only declares it from the next publish
                // on, hence the cast.
                const requestedAt = (u as { createdAt?: string | null }).createdAt ?? null;
                const busy = approveMut.isPending || rejectMut.isPending;
                return (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-3 first:border-t-0"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold">{u.displayName}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-[0.85rem] text-muted-foreground">
                        <span>{u.email}</span>
                        <span className="chip chip-neutral">{u.roleName}</span>
                        {requestedAt && (
                          <span className="text-[0.8rem]">
                            {t('overview.requested')}: {formatRequestedAt(requestedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" disabled={busy} onClick={() => openApprove(u)}>
                        {t('overview.approve')}
                      </Button>
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => setRejectUser(u)}>
                        {t('overview.reject')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Coding Tools & Rules Insights */}
      {aiInsights && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="text-[1.05rem] font-semibold">{t('aiRules.insightsTitle')}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{t('aiRules.insightsSubtitle')}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 pt-0">
            {/* Rules counts */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col rounded-lg border border-border p-3">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t('aiRules.totalRules')}
                </span>
                <span className="mt-1 text-2xl font-bold">
                  {aiInsights.totalRulesCount ?? 0}
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-border p-3">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t('aiRules.tenantRules')}
                </span>
                <span className="mt-1 text-2xl font-bold text-primary">
                  {aiInsights.tenantRulesCount ?? 0}
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-border p-3">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t('aiRules.projectRules')}
                </span>
                <span className="mt-1 text-2xl font-bold">
                  {aiInsights.projectRulesCount ?? 0}
                </span>
              </div>
              <div className="flex flex-col rounded-lg border border-border p-3">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t('aiRules.userRules')}
                </span>
                <span className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-300">
                  {aiInsights.userPersonalRulesCount ?? 0}
                </span>
              </div>
            </div>

            {/* Active AI Tools and Developer Adoption (and Workspaces for Super Admin) */}
            <div
              className={cn(
                'grid grid-cols-1 gap-4',
                isSuperAdmin && (aiInsights.tenantSummaries?.length ?? 0) > 0
                  ? 'md:grid-cols-3'
                  : 'md:grid-cols-2',
              )}
            >
              {/* Workspace adoption for Super Admin */}
              {isSuperAdmin && (aiInsights.tenantSummaries?.length ?? 0) > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {t('aiRules.tenantSummaries')}
                  </div>
                  <div className="flex flex-col gap-2">
                    {(aiInsights.tenantSummaries ?? []).map((tenant, idx) => (
                      <div
                        key={tenant.tenantId ?? idx}
                        className="flex items-center justify-between border-b border-border py-1 text-xs last:border-0"
                      >
                        <span className="font-medium">{tenant.tenantName}</span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>
                            {tenant.projectsCount ?? 0} {t('overview.projects')}
                          </span>
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {tenant.rulesCount ?? 0} {t('aiRules.section')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Registered AI Tools */}
              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  {t('aiRules.activeTools')}
                </div>
                {(aiInsights.toolUsage ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('aiRules.noToolsYet')}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(aiInsights.toolUsage ?? []).map((tool, idx) => (
                      <div
                        key={tool.toolName ?? idx}
                        className="flex items-center justify-between border-b border-border py-1 text-xs last:border-0"
                      >
                        <span className="font-mono font-medium">{tool.toolName}</span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>
                            {tool.projectCount ?? 0} {t('overview.projects')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Developer adoption */}
              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  {t('aiRules.userSummaries')}
                </div>
                {(aiInsights.userRuleSummaries ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('aiRules.noPersonalRules')}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(aiInsights.userRuleSummaries ?? []).map((user, idx) => (
                      <div
                        key={user.userId ?? idx}
                        className="flex items-center justify-between border-b border-border py-1 text-xs last:border-0"
                      >
                        <span className="font-medium">{user.userName}</span>
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {user.rulesCount ?? 0} {t('aiRules.section')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Super Admin Detailed Rules Inspection */}
            {isSuperAdmin && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="font-medium">{t('aiRules.detailedRulesTitle')}</span>
                  </div>
                  <Button
                    variant="outline"
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
                  <div className="overflow-x-auto">
                    <DataTable
                      data={aiInsights.detailedRules ?? []}
                      columns={detailedRulesColumns}
                      searchable
                      searchPlaceholder={t('common.search')}
                      paginated
                      emptyIcon={Brain}
                      emptyMessage={t('aiRules.emptyDetailedRules')}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Projects breakdown */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('overview.breakdown')}</h2>
          <Button
            variant="outline"
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

        {/* Projects breakdown — sorting + pagination arrive with the shared
            DataTable (parity with the angular page, which always had real sort). */}
        <DataTable
          data={projects}
          columns={columns}
          paginated
          emptyIcon={FolderOpen}
          emptyMessage={t('overview.emptyProjects')}
          emptyHint={t('overview.emptyProjectsHint')}
        />
      </div>

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
            <Button variant="outline" onClick={() => setApproveUserState(null)}>
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
