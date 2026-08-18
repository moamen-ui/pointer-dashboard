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
import { Plus, Ban, CheckCircle2, UserCheck, User, EllipsisVertical, Users, Link, Copy, MailCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/EmptyState';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { extractMessage } from '@/lib/error';
import { formatRequestedAt } from '@/lib/format';

type FilterStatus = 'Approved' | 'Pending' | 'Rejected';

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

  const activeRoles = useMemo(() => roles.filter((r) => r.isActive), [roles]);
  const pendingCount = pending.length;

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

  // ---- Add user ----
  const [addOpen, setAddOpen] = useState(false);
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

  function openAdd() {
    setEmail('');
    setDisplayName('');
    setPassword('');
    setRoleId(activeRoles[0]?.id ?? 0);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('users.title')}</h2>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          {t('users.addUser')}
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">{t('users.filter')}</span>
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors',
                filter === f
                  ? 'bg-brand-tint font-semibold text-brand'
                  : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5',
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
                <span className="chip chip-neutral text-[10px]">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {users.length === 0 && !isFetching ? (
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
        <Card>
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('users.email')}</TableHead>
              <TableHead>{t('users.name')}</TableHead>
              <TableHead>{t('users.role')}</TableHead>
              {!isApproved && <TableHead>{t('overview.requested')}</TableHead>}
              <TableHead>{t('users.status')}</TableHead>
              <TableHead>{t('users.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              // createdAt = when access was requested. The API returns it; the
              // generated client only declares it from the next publish on.
              const requestedAt = (user as { createdAt?: string | null }).createdAt ?? null;
              return (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.displayName}</TableCell>
                  <TableCell>
                    {isApproved ? (
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
                    ) : (
                      <span>{user.roleName}</span>
                    )}
                  </TableCell>
                  {!isApproved && (
                    <TableCell>
                      {requestedAt ? formatRequestedAt(requestedAt) : '—'}
                    </TableCell>
                  )}
                  <TableCell>
                    <span className={cn('chip', user.isActive ? 'chip-active' : 'chip-disabled')}>
                      {t(user.isActive ? 'common.active' : 'common.disabled')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <EllipsisVertical className="h-4 w-4" />
                          <span className="sr-only">{t('users.actions')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isApproved ? (
                          <DropdownMenuItem
                            onSelect={() => toggleActive(user)}
                            disabled={patchMut.isPending}
                            className={cn(
                              user.isActive && 'text-destructive focus:text-destructive',
                            )}
                          >
                            {user.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                            {t(user.isActive ? 'common.disable' : 'common.enable')}
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onSelect={() => openApprove(user)}>
                              <UserCheck className="h-4 w-4" />
                              {t('users.approve')}
                            </DropdownMenuItem>
                            {filter === 'Pending' && (
                              <DropdownMenuItem
                                onSelect={() => setRejectUser(user)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Ban className="h-4 w-4" />
                                {t('users.reject')}
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                        <DropdownMenuItem
                          onSelect={() => navigate(`/users/${user.id}/profile`)}
                        >
                          <User className="h-4 w-4" />
                          {t('profile.viewProfile')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      )}

      <InviteCard />

      {/* Add user dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('users.addUser')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="u-email">{t('users.email')}</Label>
              <Input
                id="u-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="u-name">{t('users.displayName')}</Label>
              <Input
                id="u-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="u-pass">{t('users.password')}</Label>
              <PasswordInput
                id="u-pass"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('users.role')}</Label>
              <Select
                value={roleId ? String(roleId) : undefined}
                onValueChange={(v) => setRoleId(Number(v))}
              >
                <SelectTrigger>
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
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={addInvalid || addMut.isPending} onClick={addUser}>
              <Plus className="h-4 w-4" />
              {t('users.addUser')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={!!approveUserState} onOpenChange={(o) => !o && setApproveUserState(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('users.approve')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            <Label>{t('users.approveAs')}</Label>
            <Select
              value={approveRoleId ? String(approveRoleId) : undefined}
              onValueChange={(v) => setApproveRoleId(Number(v))}
            >
              <SelectTrigger>
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

// Invite teammates — any admin (including a Workspace Admin, the primary user of this
// feature) reaches it here, since /users is not super-admin-gated unlike /settings.
function InviteCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: rolesRaw = [], isLoading: rolesLoading } = useGetApiAdminRoles();
  const nonAdminRoles: RoleResponse[] = (rolesRaw as RoleResponse[]).filter(
    (r) => !r.grantsAdmin && r.isActive,
  );

  const { data: invitesRaw, isLoading: invitesLoading, isError: invitesError } =
    useGetApiAdminInvites();
  const invites: InviteResponse[] = (invitesRaw as InviteResponse[] | undefined) ?? [];

  const reloadInvites = () =>
    void qc.invalidateQueries({ queryKey: getGetApiAdminInvitesQueryKey() });

  // ---- Create form state ----
  const [roleId, setRoleId] = useState<string>('');
  const [email, setEmail] = useState('');
  const [expiresDays, setExpiresDays] = useState<string>('7');
  const [maxUses, setMaxUses] = useState<string>('');
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [createdEmailSent, setCreatedEmailSent] = useState<string | null>(null);

  const createMut = usePostApiAdminInvites({
    mutation: {
      onSuccess: (res) => {
        const inv = res as unknown as InviteResponse;
        setCreatedUrl(inv.url ?? null);
        setCreatedEmailSent(inv.emailSent && inv.email ? inv.email : null);
        toast(t('invite.created'));
        reloadInvites();
        // Reset form
        setRoleId('');
        setEmail('');
        setExpiresDays('7');
        setMaxUses('');
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  function createInvite() {
    if (!roleId) return;
    createMut.mutate({
      data: {
        roleId: Number(roleId),
        email: email.trim() || undefined,
        expiresInDays: expiresDays ? Number(expiresDays) : undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
      },
    });
  }

  function copyUrl(url: string) {
    void navigator.clipboard.writeText(url).then(() => toast(t('invite.copied')));
  }

  const revokeMut = useDeleteApiAdminInvitesId({
    mutation: {
      onSuccess: () => {
        toast(t('invite.revoked'));
        reloadInvites();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  function formatDate(iso: string | undefined) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <h3 className="text-sm font-semibold">{t('invite.section')}</h3>
        <p className="text-xs text-muted-foreground">{t('invite.sectionHint')}</p>

        {/* Create form */}
        <div className="flex flex-col gap-3 rounded-md border border-dashed border-border p-4">
          {/* Role select */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t('invite.role')}</Label>
            {rolesLoading ? (
              <p className="text-xs text-muted-foreground">{t('settings.loading')}</p>
            ) : (
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('invite.role')} />
                </SelectTrigger>
                <SelectContent>
                  {nonAdminRoles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Optional email */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t('invite.email')}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
          </div>

          {/* Expires in days */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t('invite.expiresDays')}</Label>
            <Input
              type="number"
              min={1}
              value={expiresDays}
              onChange={(e) => setExpiresDays(e.target.value)}
              className="max-w-[12rem]"
            />
          </div>

          {/* Max uses */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t('invite.maxUses')}</Label>
            <Input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="∞"
              className="max-w-[12rem]"
            />
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!roleId || createMut.isPending}
              onClick={createInvite}
              type="button"
            >
              <Link className="h-4 w-4" />
              {t('invite.create')}
            </Button>
          </div>
        </div>

        {/* Newly created invite URL */}
        {createdUrl && (
          <>
            {createdEmailSent && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                <MailCheck className="h-4 w-4 shrink-0" />
                <span>{t('invite.emailSent', { email: createdEmailSent })}</span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <p className="flex-1 truncate text-xs font-mono">{createdUrl}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyUrl(createdUrl)}
                type="button"
              >
                <Copy className="h-4 w-4" />
                {t('invite.copy')}
              </Button>
            </div>
          </>
        )}

        {/* Invite list */}
        {invitesLoading && (
          <p className="text-sm text-muted-foreground">{t('settings.loading')}</p>
        )}
        {invitesError && (
          <p className="text-sm text-destructive">{t('settings.loadError')}</p>
        )}
        {!invitesLoading && !invitesError && invites.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('invite.empty')}</p>
        )}
        {invites.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('invite.role')}</TableHead>
                <TableHead>{t('invite.email')}</TableHead>
                <TableHead>{t('invite.expires')}</TableHead>
                <TableHead>{t('invite.uses')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.roleName ?? '—'}</TableCell>
                  <TableCell>{inv.email ?? t('invite.anyone')}</TableCell>
                  <TableCell>{formatDate(inv.expiresAt)}</TableCell>
                  <TableCell>
                    {inv.uses ?? 0}/{inv.maxUses ?? '∞'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" type="button">
                          <EllipsisVertical className="h-4 w-4" />
                          <span className="sr-only">{t('users.actions')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => copyUrl(inv.url ?? '')}
                          disabled={!inv.url}
                        >
                          <Copy className="h-4 w-4" />
                          {t('invite.copy')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => revokeMut.mutate({ id: inv.id! })}
                          disabled={revokeMut.isPending}
                        >
                          {t('invite.revoke')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
