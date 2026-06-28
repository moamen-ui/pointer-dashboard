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
} from '@moamen-ui/pointer-react';
import { Plus, Ban, CheckCircle2, UserCheck, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { extractMessage } from '@/lib/error';

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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('users.email')}</TableHead>
              <TableHead>{t('users.name')}</TableHead>
              <TableHead>{t('users.role')}</TableHead>
              <TableHead>{t('users.status')}</TableHead>
              <TableHead>{t('users.actions')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
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
                <TableCell>
                  <span className={cn('chip', user.isActive ? 'chip-active' : 'chip-disabled')}>
                    {t(user.isActive ? 'common.active' : 'common.disabled')}
                  </span>
                </TableCell>
                <TableCell>
                  {isApproved ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(user)}
                      disabled={patchMut.isPending}
                    >
                      {user.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      {t(user.isActive ? 'common.disable' : 'common.enable')}
                    </Button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => openApprove(user)}>
                        <UserCheck className="h-4 w-4" />
                        {t('users.approve')}
                      </Button>
                      {filter === 'Pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRejectUser(user)}
                        >
                          <Ban className="h-4 w-4" />
                          {t('users.reject')}
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/users/${user.id}/profile`)}
                  >
                    <User className="h-4 w-4" />
                    {t('profile.viewProfile')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && !isFetching && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {t('users.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

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
              <Input
                id="u-pass"
                type="password"
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
