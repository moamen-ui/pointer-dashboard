// Roles admin page. React port of angular/.../roles/roles.component.ts.
// list (name, grants-admin, status) + create/rename/enable-disable + delete
// with delegation (reassign users to another active, non-system role).
//
// The client generates GET endpoints as mutations; following the overview page
// we wrap the plain async functions in TanStack Query (useQuery for the list,
// invalidate/refetch after each mutation).
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getApiAdminRoles,
  postApiAdminRoles,
  patchApiAdminRolesId,
  deleteApiAdminRolesId,
  type RoleResponse,
} from '@moamen-ui/pointer-react';
import { Plus, Pencil, Ban, CheckCircle2, Trash2 } from 'lucide-react';
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

const ROLES_KEY = ['admin', 'roles'];

export function RolesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: roles = [] } = useQuery<RoleResponse[]>({
    queryKey: ROLES_KEY,
    queryFn: ({ signal }) => getApiAdminRoles(signal),
  });

  const reload = () => qc.invalidateQueries({ queryKey: ROLES_KEY });
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // ---- Add role ----
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGrantsAdmin, setNewGrantsAdmin] = useState(false);

  const addMut = useMutation({
    mutationFn: (body: { name: string; grantsAdmin: boolean }) =>
      postApiAdminRoles(body),
    onSuccess: () => {
      setAddOpen(false);
      setNewName('');
      setNewGrantsAdmin(false);
      reload();
    },
    onError,
  });

  function openAdd() {
    setNewName('');
    setNewGrantsAdmin(false);
    setAddOpen(true);
  }
  function addRole() {
    const name = newName.trim();
    if (!name) return;
    addMut.mutate({ name, grantsAdmin: newGrantsAdmin });
  }

  // ---- Patch (grantsAdmin / rename / active) ----
  const patchMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: { name?: string; grantsAdmin?: boolean; isActive?: boolean };
    }) => patchApiAdminRolesId(id, body),
    onSuccess: () => reload(),
    onError,
  });

  function toggleGrantsAdmin(role: RoleResponse, grantsAdmin: boolean) {
    patchMut.mutate({ id: role.id!, body: { grantsAdmin } });
  }

  // ---- Rename ----
  const [renameOpen, setRenameOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleResponse | null>(null);
  const [editName, setEditName] = useState('');

  function openRename(role: RoleResponse) {
    setEditingRole(role);
    setEditName(role.name ?? '');
    setRenameOpen(true);
  }
  function saveRename() {
    const role = editingRole;
    const name = editName.trim();
    if (!role || !name || name === role.name) {
      setRenameOpen(false);
      return;
    }
    patchMut.mutate(
      { id: role.id!, body: { name } },
      { onSuccess: () => { setRenameOpen(false); reload(); } },
    );
  }

  // ---- Enable / disable (disable confirmed) ----
  const [confirmRole, setConfirmRole] = useState<RoleResponse | null>(null);

  function toggleActive(role: RoleResponse) {
    if (!role.isActive) {
      patchMut.mutate({ id: role.id!, body: { isActive: true } });
      return;
    }
    setConfirmRole(role);
  }
  function confirmDisable() {
    const role = confirmRole;
    setConfirmRole(null);
    if (role) patchMut.mutate({ id: role.id!, body: { isActive: false } });
  }

  // ---- Delete + delegate ----
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<RoleResponse | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<number | null>(null);

  // Valid targets: active, non-system roles other than the one being deleted.
  const targetRoles = useMemo(
    () =>
      roles.filter(
        (r) => r.isActive && !r.isSystem && r.id !== deletingRole?.id,
      ),
    [roles, deletingRole],
  );

  const deleteMut = useMutation({
    mutationFn: ({ id, reassignToRoleId }: { id: number; reassignToRoleId: number | null }) =>
      // reassignToRoleId is only sent when a target was picked; the API returns
      // a 409 (surfaced via the toast) if it's required and missing.
      deleteApiAdminRolesId(
        id,
        reassignToRoleId ? { reassignToRoleId } : undefined,
      ),
    onSuccess: (res) => {
      setDeleteOpen(false);
      const moved = res?.reassignedUsers ?? 0;
      toast(t('roles.deleted') + (moved ? ` (${moved})` : ''));
      reload();
    },
    onError,
  });

  function openDelete(role: RoleResponse) {
    setDeletingRole(role);
    setReassignTargetId(null);
    setDeleteOpen(true);
  }
  function deleteRole() {
    if (!deletingRole) return;
    deleteMut.mutate({ id: deletingRole.id!, reassignToRoleId: reassignTargetId });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('roles.title')}</h2>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          {t('roles.addRole')}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('roles.name')}</TableHead>
              <TableHead>{t('roles.grantsAdmin')}</TableHead>
              <TableHead>{t('roles.status')}</TableHead>
              <TableHead>{t('roles.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">
                  {role.name}
                  {role.isSystem && (
                    <span className="chip chip-neutral ms-2 text-[10px]">
                      {t('roles.system')}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--brand,currentColor)] disabled:opacity-50"
                    checked={!!role.grantsAdmin}
                    disabled={role.isSystem}
                    onChange={(e) => toggleGrantsAdmin(role, e.target.checked)}
                  />
                </TableCell>
                <TableCell>
                  <span className={cn('chip', role.isActive ? 'chip-active' : 'chip-disabled')}>
                    {t(role.isActive ? 'common.active' : 'common.disabled')}
                  </span>
                </TableCell>
                <TableCell>
                  {!role.isSystem && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openRename(role)}>
                        <Pencil className="h-4 w-4" />
                        {t('common.rename')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(role)}
                      >
                        {role.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {t(role.isActive ? 'common.disable' : 'common.enable')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openDelete(role)}>
                        <Trash2 className="h-4 w-4" />
                        {t('roles.delete')}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {roles.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  {t('roles.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add role dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('roles.addRole')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-name">{t('roles.name')}</Label>
              <Input
                id="role-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRole()}
                autoFocus
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={newGrantsAdmin}
                onChange={(e) => setNewGrantsAdmin(e.target.checked)}
              />
              {t('roles.grantsAdmin')}
            </label>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!newName.trim() || addMut.isPending} onClick={addRole}>
              <Plus className="h-4 w-4" />
              {t('roles.addRole')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename role dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('common.rename')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            <Label htmlFor="role-rename">{t('roles.name')}</Label>
            <Input
              id="role-rename"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveRename()}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!editName.trim() || patchMut.isPending} onClick={saveRename}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete role + delegate users dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('roles.deleteTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <p className="text-sm">
              {t('roles.deleteIntro', { name: deletingRole?.name })}
            </p>
            {targetRoles.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label>{t('roles.reassignLabel')}</Label>
                <Select
                  value={reassignTargetId != null ? String(reassignTargetId) : undefined}
                  onValueChange={(v) => setReassignTargetId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('roles.reassignLabel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {targetRoles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('roles.noTargets')}</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={
                deleteMut.isPending ||
                (targetRoles.length > 0 && reassignTargetId == null)
              }
              onClick={deleteRole}
            >
              <Trash2 className="h-4 w-4" />
              {t('roles.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable confirmation */}
      <ConfirmDialog
        open={!!confirmRole}
        message={t('common.confirmDisable', { name: confirmRole?.name })}
        confirmLabel={t('common.disable')}
        confirmColor="warn"
        onConfirm={confirmDisable}
        onCancel={() => setConfirmRole(null)}
      />
    </div>
  );
}
