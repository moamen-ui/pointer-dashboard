// Roles admin page. React port of angular/.../roles/roles.component.ts.
// list (name, grants-admin, quick-access, status) + create/rename/enable-disable
// + delete with delegation (reassign users to another active, non-system role).
//
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useGetApiAdminRoles,
  usePostApiAdminRoles,
  usePatchApiAdminRolesId,
  useDeleteApiAdminRolesId,
  getGetApiAdminRolesQueryKey,
  type RoleResponse,
} from '@moamen-ui/pointer-react';
import { Plus, Pencil, Ban, CheckCircle2, Trash2, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table/DataTable';
import type { RowActionItem } from '@/components/shared/types';
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
import { useAuth } from '@/lib/auth';
import { extractMessage } from '@/lib/error';

// Compact switch for table cells — a full-size switch overpowers the row, so
// the track runs at ~2/3 scale (28×16px track, 12px thumb). Scoped to this
// page; switches elsewhere keep the default size.
function SmallSwitch({
  checked,
  disabled,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex h-4 w-7 items-center rounded-full p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input',
      )}
    >
      <span
        className={cn(
          'block h-3 w-3 rounded-full bg-background shadow-sm transition-transform',
          checked
            ? 'translate-x-[14px] rtl:-translate-x-[14px]'
            : 'translate-x-0.5 rtl:-translate-x-0.5',
        )}
      />
    </button>
  );
}

/**
 * Whether the signed-in user may fully manage this role (rename/delete/reconfigure).
 * The API computes it (RoleResponse.canManage): system roles are immutable for
 * everyone, and a scoped admin may only fully own roles its own tenant created.
 * Falls back to !isSystem so an older API still behaves as before.
 */
function canManage(role: RoleResponse): boolean {
  return role.canManage ?? !role.isSystem;
}

/**
 * Whether the signed-in user may at least flip this role's active status —
 * everything canManage() covers, PLUS a GLOBAL, non-system role a scoped admin
 * doesn't own (toggled via a per-tenant override server-side, never touching the
 * shared row). False for every system role, for everyone but a super admin.
 */
function canToggleActive(role: RoleResponse): boolean {
  return role.canToggleActive ?? canManage(role);
}

export function RolesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { isSuperAdmin } = useAuth();
  const { data: allRoles = [] } = useGetApiAdminRoles();
  // System roles (e.g. Admin, Workspace Admin) are immutable platform roles, not
  // workspace ones, so listing them to a scoped admin is noise they can never act
  // on — filtered out via canToggleActive, which is false for every system role. A
  // GLOBAL, non-system role (e.g. the seeded "Tester") DOES show, though: a scoped
  // admin can still toggle it on/off for their own workspace via a per-tenant
  // override, even without fully owning it. A super-admin sees everything.
  const roles = useMemo(
    () => (isSuperAdmin ? allRoles : allRoles.filter(canToggleActive)),
    [allRoles, isSuperAdmin],
  );

  const reload = () =>
    qc.invalidateQueries({ queryKey: getGetApiAdminRolesQueryKey() });
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // ---- Add role ----
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGrantsAdmin, setNewGrantsAdmin] = useState(false);

  const addMut = usePostApiAdminRoles({
    mutation: {
      onSuccess: () => {
        setAddOpen(false);
        setNewName('');
        setNewGrantsAdmin(false);
        reload();
      },
      onError,
    },
  });

  function openAdd() {
    setNewName('');
    setNewGrantsAdmin(false);
    setAddOpen(true);
  }
  function addRole() {
    const name = newName.trim();
    if (!name) return;
    addMut.mutate({ data: { name, grantsAdmin: newGrantsAdmin } });
  }

  // ---- Patch (grantsAdmin / rename / active) ----
  const patchMut = usePatchApiAdminRolesId({
    mutation: {
      onSuccess: () => reload(),
      onError,
    },
  });

  function toggleGrantsAdmin(role: RoleResponse, grantsAdmin: boolean) {
    patchMut.mutate({ id: role.id!, data: { grantsAdmin } });
  }

  function toggleQuickAccess(role: RoleResponse, quickAccess: boolean) {
    patchMut.mutate({ id: role.id!, data: { quickAccess } });
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
      { id: role.id!, data: { name } },
      { onSuccess: () => { setRenameOpen(false); reload(); } },
    );
  }

  // ---- Enable / disable (disable confirmed) ----
  const [confirmRole, setConfirmRole] = useState<RoleResponse | null>(null);

  function toggleActive(role: RoleResponse) {
    if (!role.isActive) {
      patchMut.mutate({ id: role.id!, data: { isActive: true } });
      return;
    }
    setConfirmRole(role);
  }
  function confirmDisable() {
    const role = confirmRole;
    setConfirmRole(null);
    if (role) patchMut.mutate({ id: role.id!, data: { isActive: false } });
  }

  // ---- Delete + delegate ----
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<RoleResponse | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<number | null>(null);

  // Valid targets: active, non-system roles other than the one being deleted.
  const targetRoles = useMemo(
    () =>
      roles.filter(
        // The API resolves the reassignment target with its own ownership/escalation
        // guard, so offer only roles this caller may actually manage.
        (r) => r.isActive && canManage(r) && r.id !== deletingRole?.id,
      ),
    [roles, deletingRole],
  );

  const deleteMut = useDeleteApiAdminRolesId({
    mutation: {
      onSuccess: (res) => {
        setDeleteOpen(false);
        const moved = res?.reassignedUsers ?? 0;
        toast(t('roles.deleted') + (moved ? ` (${moved})` : ''));
        reload();
      },
      onError,
    },
  });

  function openDelete(role: RoleResponse) {
    setDeletingRole(role);
    setReassignTargetId(null);
    setDeleteOpen(true);
  }
  function deleteRole() {
    if (!deletingRole) return;
    // reassignToRoleId is only sent when a target was picked; the API returns
    // a 409 (surfaced via the toast) if it's required and missing.
    deleteMut.mutate({
      id: deletingRole.id!,
      params: reassignTargetId ? { reassignToRoleId: reassignTargetId } : undefined,
    });
  }

  // Column set mirrors the angular reference: none of these sort (the angular
  // DataTableColumn entries leave sortable off); custom cells carry the toggles,
  // the system chip and the status badge.
  const columns: ColumnDef<RoleResponse>[] = [
    {
      accessorKey: 'name',
      enableSorting: false,
      header: t('roles.name'),
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.name}
          {row.original.isSystem && (
            <Badge variant="neutral" className="ms-2 text-[10px]">
              {t('roles.system')}
            </Badge>
          )}
        </span>
      ),
    },
    {
      accessorKey: 'grantsAdmin',
      enableSorting: false,
      header: t('roles.grantsAdmin'),
      cell: ({ row }) => (
        <SmallSwitch
          checked={!!row.original.grantsAdmin}
          disabled={row.original.isSystem || !canManage(row.original)}
          onCheckedChange={(checked) => toggleGrantsAdmin(row.original, checked)}
          label={t('roles.grantsAdmin')}
        />
      ),
    },
    {
      accessorKey: 'quickAccess',
      enableSorting: false,
      header: t('roles.quickAccess'),
      cell: ({ row }) => (
        <SmallSwitch
          checked={!!row.original.quickAccess}
          disabled={row.original.isSystem || !canManage(row.original)}
          onCheckedChange={(checked) => toggleQuickAccess(row.original, checked)}
          label={t('roles.quickAccess')}
        />
      ),
    },
    {
      accessorKey: 'isActive',
      enableSorting: false,
      header: t('roles.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'destructive'}>
          {t(row.original.isActive ? 'common.active' : 'common.disabled')}
        </Badge>
      ),
    },
  ];

  // Menu contents match the angular reference's gating exactly: canToggleActive
  // decides whether the row gets a menu at all; Rename/Delete additionally need
  // canManage; Disable/Enable is always offered (danger severity on Disable only).
  const actionsFor = (role: RoleResponse): RowActionItem[] => {
    if (!canToggleActive(role)) return [];
    const items: RowActionItem[] = [];
    if (canManage(role)) {
      items.push({
        label: t('common.rename'),
        icon: Pencil,
        onClick: () => openRename(role),
      });
    }
    items.push({
      label: t(role.isActive ? 'common.disable' : 'common.enable'),
      icon: role.isActive ? Ban : CheckCircle2,
      severity: role.isActive ? 'danger' : 'neutral',
      onClick: () => toggleActive(role),
    });
    if (canManage(role)) {
      items.push({
        label: t('roles.delete'),
        icon: Trash2,
        severity: 'danger',
        onClick: () => openDelete(role),
      });
    }
    return items;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('roles.title')}</h2>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          {t('roles.addRole')}
        </Button>
      </div>

      <DataTable
        data={roles}
        columns={columns}
        actions={actionsFor}
        actionsAriaLabel={t('roles.actions')}
        actionsHeader={t('roles.actions')}
        paginated
        emptyIcon={UserCog}
        emptyMessage={t('roles.empty')}
        emptyHint={t('roles.emptyHint')}
        emptyAction={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t('roles.addRole')}
          </Button>
        }
      />

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
