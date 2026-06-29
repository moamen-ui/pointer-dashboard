// Tenants admin page — super-admin only.
// List all tenants; create; approve / enable / disable; delete with cascade warning.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiAdminTenants,
  usePostApiAdminTenants,
  usePatchApiAdminTenantsId,
  useDeleteApiAdminTenantsId,
  getGetApiAdminTenantsQueryKey,
  type TenantResponse,
} from '@moamen-ui/pointer-react';
import { Plus, Trash2, CheckCircle2, Ban, ShieldCheck } from 'lucide-react';
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
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { extractMessage } from '@/lib/error';

export function TenantsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, isError, isFetching } = useGetApiAdminTenants();
  const tenants: TenantResponse[] = (data as unknown as { data?: TenantResponse[] })?.data
    ?? (Array.isArray(data) ? (data as TenantResponse[]) : []);

  const reload = () =>
    void qc.invalidateQueries({ queryKey: getGetApiAdminTenantsQueryKey() });
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // ---- Create ----
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');

  const createMut = usePostApiAdminTenants({
    mutation: {
      onSuccess: () => {
        setAddOpen(false);
        setNewEmail('');
        setNewPassword('');
        setNewDisplayName('');
        toast(t('tenants.created'));
        reload();
      },
      onError,
    },
  });

  function openAdd() {
    setNewEmail('');
    setNewPassword('');
    setNewDisplayName('');
    setAddOpen(true);
  }
  function addTenant() {
    if (!newEmail.trim() || !newPassword.trim()) return;
    createMut.mutate({
      data: {
        email: newEmail.trim(),
        password: newPassword,
        displayName: newDisplayName.trim() || undefined,
      },
    });
  }

  // ---- Status mutations (approve / enable / disable) ----
  const patchMut = usePatchApiAdminTenantsId({
    mutation: {
      onSuccess: () => {
        toast(t('tenants.updated'));
        reload();
      },
      onError,
    },
  });

  function setStatus(tenant: TenantResponse, action: string) {
    patchMut.mutate({ id: tenant.id!, data: { action } });
  }

  // ---- Delete with cascade warning ----
  const [deleteTarget, setDeleteTarget] = useState<TenantResponse | null>(null);

  const deleteMut = useDeleteApiAdminTenantsId({
    mutation: {
      onSuccess: () => {
        setDeleteTarget(null);
        toast(t('tenants.deleted'));
        reload();
      },
      onError: (e) => {
        setDeleteTarget(null);
        onError(e);
      },
    },
  });

  function confirmDelete() {
    if (deleteTarget?.id == null) return;
    deleteMut.mutate({ id: deleteTarget.id });
  }

  // ---- Render ----
  if (isLoading && !data) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {t('tenants.loading')}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-destructive">
        {t('tenants.loadError')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {t('tenants.title')}
          {isFetching && (
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              {t('common.refresh')}…
            </span>
          )}
        </h2>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          {t('tenants.addTenant')}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tenants.email')}</TableHead>
              <TableHead>{t('tenants.displayName')}</TableHead>
              <TableHead>{t('tenants.approval')}</TableHead>
              <TableHead>{t('tenants.statusCol')}</TableHead>
              <TableHead>{t('tenants.projects')}</TableHead>
              <TableHead>{t('tenants.comments')}</TableHead>
              <TableHead>{t('tenants.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">{tenant.email}</TableCell>
                <TableCell>{tenant.displayName ?? '—'}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'chip',
                      tenant.approvalStatus === 'approved'
                        ? 'chip-active'
                        : tenant.approvalStatus === 'pending'
                          ? 'chip-neutral'
                          : 'chip-disabled',
                    )}
                  >
                    {tenant.approvalStatus ?? '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={cn('chip', tenant.isActive ? 'chip-active' : 'chip-disabled')}>
                    {t(tenant.isActive ? 'common.active' : 'common.disabled')}
                  </span>
                </TableCell>
                <TableCell>{tenant.projects ?? 0}</TableCell>
                <TableCell>{tenant.comments ?? 0}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {tenant.approvalStatus === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={patchMut.isPending}
                        onClick={() => setStatus(tenant, 'approve')}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {t('tenants.approve')}
                      </Button>
                    )}
                    {tenant.isActive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={patchMut.isPending}
                        onClick={() => setStatus(tenant, 'disable')}
                      >
                        <Ban className="h-4 w-4" />
                        {t('common.disable')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={patchMut.isPending}
                        onClick={() => setStatus(tenant, 'enable')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t('common.enable')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deleteMut.isPending}
                      onClick={() => setDeleteTarget(tenant)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('tenants.delete')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {tenants.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {t('tenants.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create tenant dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('tenants.addTenant')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tenant-email">{t('tenants.email')}</Label>
              <Input
                id="tenant-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tenant-password">{t('tenants.password')}</Label>
              <Input
                id="tenant-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tenant-name">{t('tenants.displayName')}</Label>
              <Input
                id="tenant-name"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!newEmail.trim() || !newPassword.trim() || createMut.isPending}
              onClick={addTenant}
            >
              <Plus className="h-4 w-4" />
              {t('tenants.addTenant')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete with cascade warning */}
      <ConfirmDialog
        open={!!deleteTarget}
        message={t('tenants.deleteConfirm', {
          email: deleteTarget?.email ?? deleteTarget?.displayName ?? String(deleteTarget?.id),
        })}
        confirmLabel={t('tenants.delete')}
        confirmColor="warn"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
