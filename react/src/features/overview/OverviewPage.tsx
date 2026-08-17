import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
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
} from '@moamen-ui/pointer-react';
import {
  Folder,
  Users as UsersIcon,
  MessageSquare,
  Circle,
  Clock,
  CheckCircle2,
  Archive,
  RefreshCw,
  Lock,
} from 'lucide-react';
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

interface StatDef {
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
  const { data: stats, isFetching, refetch } = useGetApiAdminStats();
  const catalog = useStatusCatalog();

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
            <p className="mt-2 text-sm text-muted-foreground">{t('overview.noPending')}</p>
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

      {/* Projects breakdown */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('overview.breakdown')}</h2>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            {t('common.refresh')}
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('overview.key')}</TableHead>
                <TableHead>{t('overview.name')}</TableHead>
                <TableHead>{t('overview.comments')}</TableHead>
                <TableHead>{t('overview.private')}</TableHead>
                {catalog.items.map((s) => (
                  <TableHead key={s.value} style={{ color: s.color ?? undefined }}>
                    {catalog.displayLabel(s)}
                  </TableHead>
                ))}
                <TableHead>{t('overview.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((row: ProjectStats) => (
                <TableRow key={row.projectId ?? row.key}>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.key}</code>
                  </TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.comments}</TableCell>
                  <TableCell>
                    {(row.privateComments ?? 0) > 0 ? (
                      <span className="chip chip-private" title={t('overview.privateHiddenTooltip')}>
                        <Lock className="h-3 w-3" />
                        {row.privateComments}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {/* Render per-status counts using catalog order */}
                  {catalog.items.map((s) => {
                    const count = getProjectStatusCount(row, s.value);
                    return (
                      <TableCell
                        key={s.value}
                        className="font-medium"
                        style={{ color: count > 0 ? (s.color ?? undefined) : undefined }}
                      >
                        {count}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <span className={cn('chip', row.isActive ? 'chip-active' : 'chip-disabled')}>
                      {t(row.isActive ? 'common.active' : 'common.disabled')}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {projects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5 + catalog.items.length} className="py-10 text-center text-muted-foreground">
                    {t('overview.noPending')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
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
