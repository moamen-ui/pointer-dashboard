// Tenants admin page — super-admin only.
// List all tenants; create; approve / enable / disable; delete with cascade warning.
// Demo tenants: show expiry column, Extend demo button, Demo config dialog.
// v2: Plan column (planName + subscriptionStatus) + Change plan action.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useGetApiAdminTenants,
  usePostApiAdminTenants,
  usePatchApiAdminTenantsId,
  useDeleteApiAdminTenantsId,
  usePostApiAdminTenantsIdExtend,
  usePatchApiAdminTenantsIdDemoConfig,
  usePatchApiAdminTenantsIdPlan,
  useGetApiAdminPlans,
  getGetApiAdminTenantsQueryKey,
  type TenantResponse,
  type PlanAdminResponse,
} from '@moamen-ui/pointer-react';
import { Plus, Trash2, CheckCircle2, Ban, ShieldCheck, Clock, Settings2, CreditCard, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
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
import { extractMessage } from '@/lib/error';

// The new TenantResponse fields are not in ^1.0.7 yet — cast via this helper type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTenant = TenantResponse & Record<string, any>;

/** Badge variant for a tenant's approval status. */
function approvalSeverity(status: string | null | undefined): 'success' | 'neutral' | 'destructive' {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'destructive';
  return 'neutral';
}

/** Format a demo expiry timestamp; blank/absent renders as an em-dash. */
function formatExpiry(expiresAt: string | null | undefined): string {
  if (!expiresAt) return '—';
  try {
    return new Date(expiresAt).toLocaleString();
  } catch {
    return expiresAt;
  }
}

export function TenantsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, isError, isFetching } = useGetApiAdminTenants();
  const tenants: AnyTenant[] = (data as unknown as { data?: AnyTenant[] })?.data
    ?? (Array.isArray(data) ? (data as AnyTenant[]) : []);

  // Fetch all plans for the change-plan dropdown
  const { data: plansData } = useGetApiAdminPlans();
  const allPlans: PlanAdminResponse[] =
    (plansData as unknown as { data?: PlanAdminResponse[] })?.data ??
    (Array.isArray(plansData) ? (plansData as PlanAdminResponse[]) : []);

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
    if (!newEmail.trim() || !newPassword.trim() || !newDisplayName.trim()) return;
    createMut.mutate({
      data: {
        email: newEmail.trim(),
        password: newPassword,
        displayName: newDisplayName.trim(),
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

  function setStatus(tenant: AnyTenant, action: string) {
    patchMut.mutate({ id: tenant.id!, data: { action } });
  }

  // ---- Delete with cascade warning ----
  const [deleteTarget, setDeleteTarget] = useState<AnyTenant | null>(null);

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

  // ---- Extend demo ----
  const extendMut = usePostApiAdminTenantsIdExtend({
    mutation: {
      onSuccess: () => {
        toast(t('tenants.extended'));
        reload();
      },
      onError,
    },
  });

  // ---- Demo config dialog ----
  const [demoConfigTarget, setDemoConfigTarget] = useState<AnyTenant | null>(null);
  const [capInput, setCapInput] = useState('');
  const [ttlInput, setTtlInput] = useState('');

  function openDemoConfig(tenant: AnyTenant) {
    setCapInput(tenant.demoCommentCapOverride != null ? String(tenant.demoCommentCapOverride) : '');
    setTtlInput(tenant.demoTtlHoursOverride != null ? String(tenant.demoTtlHoursOverride) : '');
    setDemoConfigTarget(tenant);
  }

  const demoConfigMut = usePatchApiAdminTenantsIdDemoConfig({
    mutation: {
      onSuccess: () => {
        setDemoConfigTarget(null);
        toast(t('tenants.demoConfigSaved'));
        reload();
      },
      onError: (e) => {
        setDemoConfigTarget(null);
        onError(e);
      },
    },
  });

  function saveDemoConfig() {
    if (demoConfigTarget?.id == null) return;
    demoConfigMut.mutate({
      id: demoConfigTarget.id,
      data: {
        commentCapOverride: capInput === '' ? null : Number(capInput),
        ttlHoursOverride: ttlInput === '' ? null : Number(ttlInput),
      },
    });
  }

  // ---- Change plan ----
  const [changePlanTarget, setChangePlanTarget] = useState<AnyTenant | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  function openChangePlan(tenant: AnyTenant) {
    setChangePlanTarget(tenant);
    // pre-select current plan if resolvable
    setSelectedPlanId('');
  }

  const changePlanMut = usePatchApiAdminTenantsIdPlan({
    mutation: {
      onSuccess: () => {
        setChangePlanTarget(null);
        toast(t('tenants.planChanged'));
        reload();
      },
      onError: (e) => {
        setChangePlanTarget(null);
        onError(e);
      },
    },
  });

  function saveChangePlan() {
    if (changePlanTarget?.id == null || !selectedPlanId) return;
    changePlanMut.mutate({
      id: changePlanTarget.id,
      data: { planId: Number(selectedPlanId) },
    });
  }

  // Column set mirrors the angular reference: none of these sort; custom cells
  // carry the approval/status badges, the plan chip pair, and the demo expiry.
  const columns: ColumnDef<AnyTenant>[] = [
    { accessorKey: 'displayName', enableSorting: false, header: t('tenants.displayName'),
      cell: ({ row }) => row.original.displayName ?? '—' },
    { accessorKey: 'email', enableSorting: false, header: t('tenants.email') },
    {
      accessorKey: 'approvalStatus',
      enableSorting: false,
      header: t('tenants.approval'),
      cell: ({ row }) => (
        <Badge variant={approvalSeverity(row.original.approvalStatus)}>
          {row.original.approvalStatus ?? '—'}
        </Badge>
      ),
    },
    {
      accessorKey: 'isActive',
      enableSorting: false,
      header: t('tenants.statusCol'),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'destructive'}>
          {t(row.original.isActive ? 'common.active' : 'common.disabled')}
        </Badge>
      ),
    },
    { accessorKey: 'projects', enableSorting: false, header: t('tenants.projects'),
      cell: ({ row }) => row.original.projects ?? 0 },
    { accessorKey: 'comments', enableSorting: false, header: t('tenants.comments'),
      cell: ({ row }) => row.original.comments ?? 0 },
    {
      accessorKey: 'plan',
      enableSorting: false,
      header: t('tenants.planCol'),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{row.original.planName ?? t('tenants.freePlan')}</span>
          {row.original.subscriptionStatus && (
            <span className="chip chip-neutral text-[10px]">{row.original.subscriptionStatus}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'demoExpiry',
      enableSorting: false,
      header: t('tenants.demoExpiry'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.isDemo ? formatExpiry(row.original.expiresAt) : '—'}
        </span>
      ),
    },
  ];

  const actionsFor = (tenant: AnyTenant): RowActionItem[] => {
    const items: RowActionItem[] = [];
    if (tenant.approvalStatus === 'pending') {
      items.push({ label: t('tenants.approve'), icon: ShieldCheck, onClick: () => setStatus(tenant, 'approve') });
    }
    if (tenant.isActive) {
      items.push({ label: t('common.disable'), icon: Ban, severity: 'danger', onClick: () => setStatus(tenant, 'disable') });
    } else {
      items.push({ label: t('common.enable'), icon: CheckCircle2, onClick: () => setStatus(tenant, 'enable') });
    }
    if (tenant.isDemo) {
      items.push({
        label: t('tenants.extend'),
        icon: Clock,
        disabled: tenant.demoExtended === true,
        tooltip: tenant.demoExtended ? t('tenants.extendOnce') : undefined,
        onClick: () => extendMut.mutate({ id: tenant.id! }),
      });
      items.push({ label: t('tenants.editDemoConfig'), icon: Settings2, onClick: () => openDemoConfig(tenant) });
    }
    items.push({ label: t('tenants.changePlan'), icon: CreditCard, onClick: () => openChangePlan(tenant) });
    items.push({ label: t('tenants.delete'), icon: Trash2, severity: 'danger', onClick: () => setDeleteTarget(tenant) });
    return items;
  };

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

      <DataTable
        data={tenants}
        columns={columns}
        actions={actionsFor}
        actionsAriaLabel={t('tenants.actions')}
        actionsHeader={t('tenants.actions')}
        paginated
        emptyIcon={Building2}
        emptyMessage={t('tenants.empty')}
        emptyHint={t('tenants.emptyHint')}
        emptyAction={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t('tenants.addTenant')}
          </Button>
        }
      />

      {/* Change plan dialog */}
      <Dialog open={!!changePlanTarget} onOpenChange={(open) => { if (!open) setChangePlanTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('tenants.changePlan')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <p className="text-sm text-muted-foreground">
              {changePlanTarget?.email ?? changePlanTarget?.displayName ?? ''}
            </p>
            <div className="flex flex-col gap-2">
              <Label>{t('tenants.selectPlan')}</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('tenants.selectPlanPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {allPlans.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setChangePlanTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!selectedPlanId || changePlanMut.isPending}
              onClick={saveChangePlan}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <PasswordInput
                id="tenant-password"
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
              disabled={!newEmail.trim() || !newPassword.trim() || !newDisplayName.trim() || createMut.isPending}
              onClick={addTenant}
            >
              <Plus className="h-4 w-4" />
              {t('tenants.addTenant')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Demo config dialog */}
      <Dialog open={!!demoConfigTarget} onOpenChange={(open) => { if (!open) setDemoConfigTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('tenants.editDemoConfig')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <p className="text-xs text-muted-foreground">{t('tenants.demoConfigHint')}</p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="demo-cap-override">{t('tenants.commentCapOverride')}</Label>
              <Input
                id="demo-cap-override"
                type="number"
                min={1}
                value={capInput}
                placeholder={t('tenants.overridePlaceholder')}
                onChange={(e) => setCapInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="demo-ttl-override">{t('tenants.ttlHoursOverride')}</Label>
              <Input
                id="demo-ttl-override"
                type="number"
                min={1}
                value={ttlInput}
                placeholder={t('tenants.overridePlaceholder')}
                onChange={(e) => setTtlInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDemoConfigTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={demoConfigMut.isPending}
              onClick={saveDemoConfig}
            >
              {t('common.save')}
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
