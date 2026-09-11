// Users admin page. React port of angular/.../users/users.component.ts.
// list with Approved/Pending/Rejected filters; add user; approve pending
// (choose role); reject (confirmed); enable/disable (disable confirmed);
// change role inline for approved users.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
  useGetApiAdminInvites,
  usePostApiAdminInvites,
  useDeleteApiAdminInvitesId,
  getGetApiAdminInvitesQueryKey,
  type InviteResponse,
} from '@moamen-ui/pointer-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Ban, CheckCircle2, UserCheck, User, Users, Link, Copy, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { DataTable } from '@/components/shared/data-table/DataTable';
import type { RowActionItem } from '@/components/shared/types';
import { FormField } from '@/components/shared/FormField';
import { EmptyState } from '@/components/EmptyState';
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
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { extractMessage } from '@/lib/error';
import { formatRequestedAt } from '@/lib/format';

type FilterStatus = 'Approved' | 'Pending' | 'Rejected';

// A union row type (real users + pending invites) with per-kind columns/actions --
// none of it forced into DataTable's core API, per this page's deliberate escape hatch.
type Row = ({ kind: 'user' } & UserResponse) | ({ kind: 'invite' } & InviteResponse);

export function UsersPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<FilterStatus>('Approved');

  const { data: users = [], isFetching } = useGetApiAdminUsers({
    status: filter.toLowerCase(),
  });

  // Separate count for the Pending badge regardless of the active filter.
  const { data: pending = [] } = useGetApiAdminUsers({ status: 'pending' });

  const { data: roles = [] } = useGetApiAdminRoles();

  // Pending invites render as rows in the Pending view too — they're "not a
  // member yet" just like a pending user, until accepted (then they become an
  // Approved user directly and drop out of this list).
  const { data: invitesRaw } = useGetApiAdminInvites();
  const invites = useMemo(() => (invitesRaw as InviteResponse[] | undefined) ?? [], [invitesRaw]);

  const activeRoles = useMemo(() => roles.filter((r) => r.isActive), [roles]);
  const nonAdminActiveRoles = useMemo(
    () => activeRoles.filter((r) => !r.grantsAdmin),
    [activeRoles],
  );
  const pendingCount = pending.length + invites.length;

  // Invalidate every users list (any status filter) by matching the shared
  // prefix the generated key helper produces without params.
  function reload() {
    qc.invalidateQueries({ queryKey: getGetApiAdminUsersQueryKey() });
  }
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // For an approved user's inline role select, keep their current role even if
  // it has since been disabled (mirrors angular rolesForUser).
  function rolesForUser(user: UserResponse): RoleResponse[] {
    const current = roles.find((r) => r.id === user.roleId);
    if (current && !current.isActive) return [current, ...activeRoles];
    return activeRoles;
  }

  // ---- Add user: "Send invite" is the default mode, "Create directly" is secondary ----
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<'invite' | 'direct'>('invite');

  // Direct-creation fields
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number>(0);

  const addMut = usePostApiAdminUsers({
    mutation: {
      onSuccess: () => {
        setAddOpen(false);
        reload();
      },
      onError,
    },
  });

  // Invite fields
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteExpiresDays, setInviteExpiresDays] = useState('7');
  const [inviteMaxUses, setInviteMaxUses] = useState('');
  const [createdInvite, setCreatedInvite] = useState<{ url: string; emailSent: string | null } | null>(
    null,
  );

  const inviteMut = usePostApiAdminInvites({
    mutation: {
      onSuccess: (res) => {
        const inv = res as unknown as InviteResponse;
        setCreatedInvite({ url: inv.url ?? '', emailSent: inv.emailSent && inv.email ? inv.email : null });
        toast(t('invite.created'));
        void qc.invalidateQueries({ queryKey: getGetApiAdminInvitesQueryKey() });
      },
      onError,
    },
  });

  function openAdd() {
    setEmail('');
    setDisplayName('');
    setPassword('');
    setRoleId(activeRoles[0]?.id ?? 0);
    setInviteRoleId(String(nonAdminActiveRoles[0]?.id ?? ''));
    setInviteEmail('');
    setInviteExpiresDays('7');
    setInviteMaxUses('');
    setCreatedInvite(null);
    setAddMode('invite');
    setAddOpen(true);
  }
  const addInvalid =
    !email.trim() || !displayName.trim() || !password.trim() || roleId < 1;
  function addUser() {
    if (addInvalid) return;
    addMut.mutate({
      data: {
        email: email.trim(),
        displayName: displayName.trim(),
        password,
        roleId,
      },
    });
  }

  function sendInvite() {
    if (!inviteRoleId) return;
    inviteMut.mutate({
      data: {
        roleId: Number(inviteRoleId),
        email: inviteEmail.trim() || undefined,
        expiresInDays: inviteExpiresDays ? Number(inviteExpiresDays) : undefined,
        maxUses: inviteMaxUses ? Number(inviteMaxUses) : undefined,
      },
    });
  }

  function copyInviteUrl(url: string) {
    void navigator.clipboard.writeText(url).then(() => toast(t('invite.copied')));
  }

  const revokeInviteMut = useDeleteApiAdminInvitesId({
    mutation: {
      onSuccess: () => {
        toast(t('invite.revoked'));
        void qc.invalidateQueries({ queryKey: getGetApiAdminInvitesQueryKey() });
      },
      onError,
    },
  });

  function formatInviteExpiry(iso: string | undefined) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  }

  // ---- Change role / enable-disable (patch) ----
  const patchMut = usePatchApiAdminUsersId({
    mutation: {
      onSuccess: () => reload(),
      onError: (e: unknown) => {
        onError(e);
        reload();
      },
    },
  });

  function changeRole(user: UserResponse, newRoleId: number) {
    patchMut.mutate({ id: user.id!, data: { roleId: newRoleId } });
  }

  const [confirmUser, setConfirmUser] = useState<UserResponse | null>(null);
  function toggleActive(user: UserResponse) {
    if (!user.isActive) {
      patchMut.mutate({ id: user.id!, data: { isActive: true } });
      return;
    }
    setConfirmUser(user);
  }
  function confirmDisable() {
    const u = confirmUser;
    setConfirmUser(null);
    if (u) patchMut.mutate({ id: u.id!, data: { isActive: false } });
  }

  // ---- Approve ----
  const [approveUserState, setApproveUserState] = useState<UserResponse | null>(null);
  const [approveRoleId, setApproveRoleId] = useState<number>(0);

  const approveMut = usePostApiAdminUsersIdApprove({
    mutation: {
      onSuccess: () => {
        setApproveUserState(null);
        reload();
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

  // ---- Reject ----
  const [rejectUser, setRejectUser] = useState<UserResponse | null>(null);
  const rejectMut = usePostApiAdminUsersIdReject({
    mutation: {
      onSuccess: () => {
        setRejectUser(null);
        reload();
      },
      onError,
    },
  });
  function confirmReject() {
    if (rejectUser) rejectMut.mutate({ id: rejectUser.id! });
  }

  const isApproved = filter === 'Approved';
  const filters: FilterStatus[] = ['Approved', 'Pending', 'Rejected'];
  // Under the Pending filter, invite rows are appended after real pending users.
  const totalRows = filter === 'Pending' ? users.length + invites.length : users.length;

  const rows: Row[] = useMemo(() => {
    const userRows: Row[] = users.map((u) => ({ kind: 'user' as const, ...u }));
    if (filter !== 'Pending') return userRows;
    const inviteRows: Row[] = invites.map((i) => ({ kind: 'invite' as const, ...i }));
    return [...userRows, ...inviteRows];
  }, [users, invites, filter]);

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: 'email',
      enableSorting: false,
      header: t('users.email'),
      cell: ({ row }) =>
        row.original.kind === 'invite'
          ? row.original.email || t('invite.anyone')
          : row.original.email,
    },
    {
      id: 'displayName',
      enableSorting: false,
      header: t('users.name'),
      cell: ({ row }) => (row.original.kind === 'invite' ? '—' : row.original.displayName),
    },
    {
      id: 'role',
      enableSorting: false,
      header: t('users.role'),
      cell: ({ row }) => {
        if (row.original.kind === 'invite') return row.original.roleName ?? '—';
        const user = row.original;
        if (isApproved) {
          return (
            <Select
              value={user.roleId != null ? String(user.roleId) : undefined}
              onValueChange={(v) => changeRole(user, Number(v))}
            >
              <SelectTrigger className="min-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rolesForUser(user).map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        return <span>{user.roleName}</span>;
      },
    },
  ];
  if (!isApproved) {
    columns.push({
      id: 'requested',
      enableSorting: false,
      header: t('overview.requested'),
      cell: ({ row }) => {
        if (row.original.kind === 'invite') {
          return `${t('invite.expires')}: ${formatInviteExpiry(row.original.expiresAt)}`;
        }
        // createdAt = when access was requested. The API returns it; the
        // generated client only declares it from the next publish on.
        const requestedAt = (row.original as { createdAt?: string | null }).createdAt ?? null;
        return requestedAt ? formatRequestedAt(requestedAt) : '—';
      },
    });
  }
  columns.push({
    id: 'status',
    enableSorting: false,
    header: t('users.status'),
    cell: ({ row }) => {
      if (row.original.kind === 'invite') {
        return (
          <span className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] font-medium leading-none text-state-archived bg-state-archived-tint border-state-archived/30">
            {t('invite.invited')}
          </span>
        );
      }
      return (
        <span className={cn(
          'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] font-medium leading-none',
          row.original.isActive
            ? 'text-state-completed bg-state-completed-tint border-state-completed/30'
            : 'text-state-danger bg-state-danger-tint border-state-danger/30'
        )}>
          {row.original.isActive ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              {t('common.active')}
            </>
          ) : (
            <>
              <Ban className="h-3 w-3" />
              {t('common.disabled')}
            </>
          )}
        </span>
      );
    },
  });

  function actionsFor(row: Row): RowActionItem[] {
    if (row.kind === 'invite') {
      return [
        { label: t('invite.copy'), icon: Copy, disabled: !row.url, onClick: () => copyInviteUrl(row.url ?? '') },
        {
          label: t('invite.revoke'),
          severity: 'danger',
          disabled: revokeInviteMut.isPending,
          onClick: () => revokeInviteMut.mutate({ id: row.id! }),
        },
      ];
    }
    const user = row;
    const items: RowActionItem[] = [];
    if (isApproved) {
      items.push({
        label: t(user.isActive ? 'common.disable' : 'common.enable'),
        icon: user.isActive ? Ban : CheckCircle2,
        severity: user.isActive ? 'danger' : 'neutral',
        disabled: patchMut.isPending,
        onClick: () => toggleActive(user),
      });
    } else {
      items.push({ label: t('users.approve'), icon: UserCheck, onClick: () => openApprove(user) });
      if (filter === 'Pending') {
        items.push({ label: t('users.reject'), icon: Ban, severity: 'danger', onClick: () => setRejectUser(user) });
      }
    }
    items.push({ label: t('profile.viewProfile'), icon: User, onClick: () => navigate(`/users/${user.id}/profile`) });
    return items;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.01em]">{t('users.title')}</h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          {t('users.addUser')}
        </Button>
      </div>

      {/* Filter bar — label + segmented control */}
      <div className="flex items-center gap-3">
        <span className="text-[13px] text-muted-foreground">{t('common.show')}</span>
        <div className="inline-flex gap-0.5 rounded-md border border-border bg-gutter p-0.5">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'h-7 px-3 rounded-[4px] text-[13px] font-medium transition-colors',
                filter === f
                  ? 'bg-background text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(
                f === 'Approved'
                  ? 'users.filterApproved'
                  : f === 'Pending'
                    ? 'users.filterPending'
                    : 'users.filterRejected',
              )}
              {f === 'Pending' && pendingCount > 0 && (
                <span className="ms-1 inline-flex h-5 items-center justify-center rounded-full bg-state-ready px-1.5 text-[10px] font-medium text-white">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {totalRows === 0 && !isFetching ? (
        <EmptyState
          icon={Users}
          message={t('users.empty')}
          hint={t('users.emptyHint')}
        >
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t('users.addUser')}
          </Button>
        </EmptyState>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          actions={actionsFor}
          actionsAriaLabel={t('users.actions')}
          actionsHeader={t('users.actions')}
          gutter
        />
      )}

      {/* Add user dialog — "Send invite" (default) or "Create directly" (secondary) */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold leading-6">{t('users.addUser')}</DialogTitle>
          </DialogHeader>

          {!createdInvite && (
            <div className="inline-flex gap-0.5 rounded-md border border-border bg-gutter p-0.5">
              <button
                type="button"
                onClick={() => setAddMode('invite')}
                className={cn(
                  'h-7 px-3 rounded-[4px] text-[13px] font-medium transition-colors',
                  addMode === 'invite'
                    ? 'bg-background text-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('users.modeInvite')}
              </button>
              <button
                type="button"
                onClick={() => setAddMode('direct')}
                className={cn(
                  'h-7 px-3 rounded-[4px] text-[13px] font-medium transition-colors',
                  addMode === 'direct'
                    ? 'bg-background text-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t('users.modeDirect')}
              </button>
            </div>
          )}

          {addMode === 'invite' ? (
            createdInvite ? (
              <div className="flex flex-col gap-3 pt-1">
                {createdInvite.emailSent && (
                  <div className="flex items-center gap-2 rounded-md border border-state-completed/30 bg-state-completed-tint px-3 py-2 text-sm text-state-completed">
                    <MailCheck className="h-4 w-4 shrink-0" />
                    <span>{t('invite.emailSent', { email: createdInvite.emailSent })}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                  <p className="flex-1 truncate text-xs font-mono">{createdInvite.url}</p>
                  <Button size="sm" variant="ghost" onClick={() => copyInviteUrl(createdInvite.url)} type="button">
                    <Copy className="h-4 w-4" />
                    {t('invite.copy')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pt-1">
                <p className="text-xs text-muted-foreground">{t('invite.sectionHint')}</p>
                <FormField label={t('invite.role')} htmlFor="invite-role">
                  <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                    <SelectTrigger id="invite-role">
                      <SelectValue placeholder={t('invite.role')} />
                    </SelectTrigger>
                    <SelectContent>
                      {nonAdminActiveRoles.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label={t('invite.email')} htmlFor="invite-email">
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@example.com"
                  />
                </FormField>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <FormField label={t('invite.expiresDays')} htmlFor="invite-expires-days">
                      <Input
                        id="invite-expires-days"
                        type="number"
                        min={1}
                        value={inviteExpiresDays}
                        onChange={(e) => setInviteExpiresDays(e.target.value)}
                      />
                    </FormField>
                  </div>
                  <div className="flex-1">
                    <FormField label={t('invite.maxUses')} htmlFor="invite-max-uses">
                      <Input
                        id="invite-max-uses"
                        type="number"
                        min={1}
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(e.target.value)}
                        placeholder="∞"
                      />
                    </FormField>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3 pt-1">
              <FormField label={t('users.email')} htmlFor="u-email">
                <Input
                  id="u-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </FormField>
              <FormField label={t('users.displayName')} htmlFor="u-name">
                <Input
                  id="u-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </FormField>
              <FormField label={t('users.password')} htmlFor="u-pass">
                <PasswordInput
                  id="u-pass"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </FormField>
              <FormField label={t('users.role')} htmlFor="u-role">
                <Select
                  value={roleId ? String(roleId) : undefined}
                  onValueChange={(v) => setRoleId(Number(v))}
                >
                  <SelectTrigger id="u-role">
                    <SelectValue placeholder={t('users.role')} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeRoles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          )}

          <DialogFooter className="gap-2">
            {addMode === 'invite' ? (
              createdInvite ? (
                <Button onClick={() => setAddOpen(false)}>{t('invite.done')}</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button disabled={!inviteRoleId || inviteMut.isPending} onClick={sendInvite}>
                    <Link className="h-4 w-4" />
                    {t('invite.create')}
                  </Button>
                </>
              )
            ) : (
              <>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button disabled={addInvalid || addMut.isPending} onClick={addUser}>
                  <Plus className="h-4 w-4" />
                  {t('users.addUser')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={!!approveUserState} onOpenChange={(o) => !o && setApproveUserState(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('users.approve')}</DialogTitle>
          </DialogHeader>
          <div className="pt-1">
            <FormField label={t('users.approveAs')} htmlFor="approve-user-role">
              <Select
                value={approveRoleId ? String(approveRoleId) : undefined}
                onValueChange={(v) => setApproveRoleId(Number(v))}
              >
                <SelectTrigger id="approve-user-role">
                  <SelectValue placeholder={t('users.approveAs')} />
                </SelectTrigger>
                <SelectContent>
                  {activeRoles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproveUserState(null)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={approveRoleId < 1 || approveMut.isPending} onClick={approve}>
              {t('users.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject confirmation */}
      <ConfirmDialog
        open={!!rejectUser}
        message={t('users.confirmReject', { name: rejectUser?.email })}
        confirmLabel={t('users.reject')}
        confirmColor="warn"
        onConfirm={confirmReject}
        onCancel={() => setRejectUser(null)}
      />

      {/* Disable confirmation */}
      <ConfirmDialog
        open={!!confirmUser}
        message={t('common.confirmDisable', { name: confirmUser?.email })}
        confirmLabel={t('common.disable')}
        confirmColor="warn"
        onConfirm={confirmDisable}
        onCancel={() => setConfirmUser(null)}
      />
    </div>
  );
}
