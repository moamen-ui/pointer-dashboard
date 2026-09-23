// Users admin page. Originally ported from the retired Angular app's users.component.ts
// (Angular/Vue retired 2026-09-15; preserved on branch legacy/angular-vue, commit 6954ad2).
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
  useDeleteApiAdminUsersId,
  usePostApiAdminUsersIdApprove,
  usePostApiAdminUsersIdReject,
  getGetApiAdminUsersQueryKey,
  type UserResponse,
  type RoleResponse,
  useGetApiAdminInvites,
  usePostApiAdminInvites,
  useDeleteApiAdminInvitesId,
  usePostApiAdminInvitesIdQuickLinkRotate,
  patchApiAdminUsersId,
  getGetApiAdminInvitesQueryKey,
  type InviteResponse,
  type InviteeMembership,
} from '@moamen-ui/pointer-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Ban, CheckCircle2, UserCheck, User, Users, Link, Copy, MailCheck, LogOut, CircleAlert, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
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
import { emailError, requiredError } from '@/lib/validators';

type FilterStatus = 'Approved' | 'Pending' | 'Rejected';

// A union row type (real users + pending invites) with per-kind columns/actions --
// none of it forced into DataTable's core API, per this page's deliberate escape hatch.
type Row = ({ kind: 'user' } & UserResponse) | ({ kind: 'invite' } & InviteResponse);

export function UsersPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user: viewer, isSuperAdmin } = useAuth();

  const [filter, setFilter] = useState<FilterStatus>('Approved');

  // DB-11c: sole-admin (and similar) conflicts from remove/disable/role-change surface here as an
  // inline explanation instead of a toast — the message already names the workspace(s) to transfer
  // ownership from first (MessageKeys.User.SoleAdminBlocked).
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

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
  const [emailTouched, setEmailTouched] = useState(false);
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const emailErrorMsg = emailError(email, t);
  const displayNameErrorMsg = requiredError(displayName, t);
  const passwordErrorMsg = requiredError(password, t);

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
    setEmailTouched(false);
    setDisplayNameTouched(false);
    setPasswordTouched(false);
    setInviteRoleId(String(nonAdminActiveRoles[0]?.id ?? ''));
    setInviteEmail('');
    setInviteExpiresDays('7');
    setInviteMaxUses('');
    setCreatedInvite(null);
    setAddMode('invite');
    setAddOpen(true);
  }
  const addInvalid =
    !!emailErrorMsg || !!displayNameErrorMsg || !!passwordErrorMsg || roleId < 1;
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

  // DB-11c: revoking an already-accepted invite returns the live memberships it created
  // (InviteRevokeResponse.invitees) — offer a one-click "also disable" follow-up for them.
  const [followupInvitees, setFollowupInvitees] = useState<InviteeMembership[] | null>(null);
  const [followupChecked, setFollowupChecked] = useState<Record<number, boolean>>({});
  const [followupResults, setFollowupResults] = useState<Record<number, 'pending' | 'ok' | 'error'>>({});
  const [followupBusy, setFollowupBusy] = useState(false);

  const revokeInviteMut = useDeleteApiAdminInvitesId({
    mutation: {
      onSuccess: (res) => {
        toast(t('invite.revoked'));
        void qc.invalidateQueries({ queryKey: getGetApiAdminInvitesQueryKey() });
        const invitees = (res?.invitees ?? []).filter((i) => i.isActive);
        if (invitees.length > 0) {
          setFollowupInvitees(invitees);
          setFollowupChecked(Object.fromEntries(invitees.map((i) => [i.userId!, true])));
          setFollowupResults({});
        }
      },
      onError,
    },
  });

  function closeFollowup() {
    setFollowupInvitees(null);
    setFollowupChecked({});
    setFollowupResults({});
  }

  async function disableFollowupSelected() {
    if (!followupInvitees) return;
    const targets = followupInvitees.filter((i) => followupChecked[i.userId!]);
    if (targets.length === 0) return;
    setFollowupBusy(true);
    for (const invitee of targets) {
      setFollowupResults((prev) => ({ ...prev, [invitee.userId!]: 'pending' }));
      try {
        await patchApiAdminUsersId(invitee.userId!, { isActive: false });
        setFollowupResults((prev) => ({ ...prev, [invitee.userId!]: 'ok' }));
      } catch {
        setFollowupResults((prev) => ({ ...prev, [invitee.userId!]: 'error' }));
      }
    }
    setFollowupBusy(false);
    reload();
  }

  const rotateQuickLinkMut = usePostApiAdminInvitesIdQuickLinkRotate({
    mutation: {
      onSuccess: (res: any) => {
        const inv = res.data ?? res;
        if (inv.magicLink) {
          copyInviteUrl(inv.magicLink);
          toast(t('invite.rotated', { defaultValue: 'Quick link rotated and copied' }));
        }
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
      onSuccess: () => {
        setConflictMessage(null);
        reload();
      },
      // 409 (sole-admin) and 400 (e.g. self-demotion) land here as the server's own message —
      // shown inline (below the filter bar) rather than as a generic toast (DB-11c dashboard task 1/2).
      onError: (e: unknown) => {
        setConflictMessage(extractMessage(e));
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

  // ---- Remove from workspace (DB-11c; was a bare "Delete") ----
  const [removeUser, setRemoveUser] = useState<UserResponse | null>(null);
  const removeMut = useDeleteApiAdminUsersId({
    mutation: {
      onSuccess: () => {
        setRemoveUser(null);
        setConflictMessage(null);
        toast(t('users.removed'), 'success');
        reload();
      },
      onError: (e: unknown) => {
        setRemoveUser(null);
        setConflictMessage(extractMessage(e));
      },
    },
  });
  function confirmRemove() {
    const u = removeUser;
    setRemoveUser(null);
    if (u) removeMut.mutate({ id: u.id! });
  }

  // A Deputy may remove neither a Workspace Admin nor another Deputy — only the workspace's own
  // admin or a super admin may (UserService.DeleteAsync, DB-11c review finding #7); mirrored here
  // so a Deputy never sees an action the API will only refuse (CannotRemoveAdmin/CannotDeleteDeputy).
  const viewerIsDeputy = !isSuperAdmin && viewer?.roleName === 'Workspace Admin Deputy';
  function canRemove(user: UserResponse): boolean {
    if (!viewerIsDeputy) return true;
    return user.roleName !== 'Workspace Admin' && user.roleName !== 'Workspace Admin Deputy';
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
      meta: { mobile: 'primary' },
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
  if (filter === 'Pending') {
    columns.push({
      id: 'magicLink',
      enableSorting: false,
      header: t('invite.quickAccess'),
      cell: ({ row }) => {
        if (row.original.kind !== 'invite') return '—';
        const inv = row.original as any;
        if (!inv.magicLink) return '—';
        return (
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
              {inv.magicLink}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyInviteUrl(inv.magicLink)}
              className="h-6 px-2"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        );
      },
    });
  }

  columns.push({
    id: 'status',
    enableSorting: false,
    header: t('users.status'),
    cell: ({ row }) => {
      if (row.original.kind === 'invite') {
        const inv = row.original as any;
        return (
          <div className="flex flex-col gap-1">
            <span className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] font-medium leading-none text-state-archived bg-state-archived-tint border-state-archived/30">
              {t('invite.invited')}
            </span>
            {inv.magicLinkActive === false && (
              <span className="text-xs text-state-danger">{t('invite.magicLinkInactive')}</span>
            )}
            {inv.linkExpiresAt && (
              <span className="text-xs text-muted-foreground">
                {t('invite.expiresAt')}: {new Date(inv.linkExpiresAt).toLocaleDateString()}
              </span>
            )}
            {inv.linkUses != null && (
              <span className="text-xs text-muted-foreground">
                {t('invite.uses')}: {inv.linkUses}
              </span>
            )}
          </div>
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
      const inv = row as any;
      return [
        { label: t('common.copyLink', { defaultValue: 'Copy link' }), icon: Copy, disabled: !row.url && !inv.magicLink, onClick: () => copyInviteUrl(inv.magicLink ?? row.url ?? '') },
        inv.magicLinkActive && {
          label: t('invite.rotateLink', { defaultValue: 'Rotate link' }),
          icon: MailCheck,
          onClick: () => rotateQuickLinkMut.mutate({ id: row.id! }),
          disabled: rotateQuickLinkMut.isPending,
        },
        {
          label: t('invite.revoke'),
          severity: 'danger',
          disabled: revokeInviteMut.isPending,
          onClick: () => revokeInviteMut.mutate({ id: row.id! }),
        },
      ].filter(Boolean);
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
      if (canRemove(user)) {
        items.push({
          label: t('users.removeFromWorkspace'),
          icon: LogOut,
          severity: 'danger',
          disabled: removeMut.isPending,
          onClick: () => setRemoveUser(user),
        });
      }
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

      {/* Inline conflict explanation (DB-11c dashboard tasks 1/2): a 409/400 from remove, disable
          or role-change — most commonly the sole-admin guard — surfaces here instead of a toast, so
          the "promote a deputy first" text (already in the server message) stays on screen next to
          the table until dismissed or the next successful action. */}
      {conflictMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-state-danger/30 bg-state-danger-tint px-3 py-2 text-[13px] text-state-danger"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{conflictMessage}</span>
          <button
            type="button"
            aria-label={t('common.dismiss')}
            onClick={() => setConflictMessage(null)}
            className="shrink-0 text-state-danger/70 hover:text-state-danger"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filter bar — label + segmented control. Below `sm` the segments stack full
          width with equal shares (DESIGN.md target: "segmented controls full-width
          with equal segments"). */}
      <div className="flex flex-col items-start gap-2 max-sm:items-stretch sm:flex-row sm:items-center sm:gap-3">
        <span className="text-[13px] text-muted-foreground">{t('common.show')}</span>
        <div className="inline-flex gap-0.5 rounded-md border border-border bg-gutter p-0.5 max-sm:flex max-sm:w-full">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'h-7 max-md:h-11 px-3 rounded-[4px] text-[13px] font-medium transition-colors max-sm:flex-1',
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
            <div className="inline-flex gap-0.5 rounded-md border border-border bg-gutter p-0.5 max-sm:flex max-sm:w-full">
              <button
                type="button"
                onClick={() => setAddMode('invite')}
                className={cn(
                  'h-7 max-md:h-11 px-3 rounded-[4px] text-[13px] font-medium transition-colors max-sm:flex-1',
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
                  'h-7 max-md:h-11 px-3 rounded-[4px] text-[13px] font-medium transition-colors max-sm:flex-1',
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
              <FormField
                label={t('users.email')}
                htmlFor="u-email"
                error={emailTouched ? emailErrorMsg || undefined : undefined}
              >
                <Input
                  id="u-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  autoFocus
                />
              </FormField>
              <FormField
                label={t('users.displayName')}
                htmlFor="u-name"
                error={displayNameTouched ? displayNameErrorMsg || undefined : undefined}
              >
                <Input
                  id="u-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={() => setDisplayNameTouched(true)}
                />
              </FormField>
              <FormField
                label={t('users.password')}
                htmlFor="u-pass"
                error={passwordTouched ? passwordErrorMsg || undefined : undefined}
              >
                <PasswordInput
                  id="u-pass"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
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

      {/* Remove-from-workspace confirmation (DB-11c) */}
      <ConfirmDialog
        open={!!removeUser}
        message={t('users.confirmRemove', { name: removeUser?.email })}
        confirmLabel={t('users.removeFromWorkspace')}
        confirmColor="warn"
        onConfirm={confirmRemove}
        onCancel={() => setRemoveUser(null)}
      />

      {/* Invite revoke follow-up (DB-11c dashboard task 3): the invite created these live
          memberships before it was revoked — offer to disable them in one click. */}
      <Dialog open={!!followupInvitees} onOpenChange={(o) => !o && closeFollowup()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('invite.followupTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-[13px] text-muted-foreground">
              {t('invite.followupQuestion', { count: followupInvitees?.length ?? 0 })}
            </p>
            <div className="flex flex-col gap-2">
              {(followupInvitees ?? []).map((invitee) => {
                const result = followupResults[invitee.userId!];
                return (
                  <label
                    key={invitee.userId}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={!!followupChecked[invitee.userId!]}
                        disabled={followupBusy || result === 'ok'}
                        onChange={(e) =>
                          setFollowupChecked((prev) => ({ ...prev, [invitee.userId!]: e.target.checked }))
                        }
                      />
                      <span className="min-w-0 truncate text-[13px]">
                        {invitee.displayName || invitee.email} · {invitee.roleName}
                      </span>
                    </span>
                    {result === 'pending' && (
                      <span className="shrink-0 text-[12px] text-muted-foreground">…</span>
                    )}
                    {result === 'ok' && (
                      <span className="shrink-0 text-[12px] text-state-completed">{t('invite.followupResultOk')}</span>
                    )}
                    {result === 'error' && (
                      <span className="shrink-0 text-[12px] text-state-danger">{t('invite.followupResultError')}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeFollowup}>
              {t('invite.followupDone')}
            </Button>
            <Button
              variant="destructive"
              disabled={followupBusy || !Object.values(followupChecked).some(Boolean)}
              onClick={disableFollowupSelected}
            >
              {t('invite.followupDisableSelected')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
