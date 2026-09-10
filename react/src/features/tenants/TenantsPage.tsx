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

  const { data, isLoading, isError } = useGetApiAdminTenants();
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

  // Column set per review-margin §3: email 14/500 + display name 13 muted;
  // plan as neutral chip; approval/status as chips with glyphs;
  // projects/comments as mono counts; demo expiry mono 13px.
  const columns: ColumnDef<AnyTenant>[] = [
    {
      accessorKey: 'email',
      enableSorting: false,
      header: t('tenants.email'),
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-medium">{row.original.email}</span>
          <span className="text-[13px] text-muted-foreground">{row.original.displayName ?? '—'}</span>
        </div>
      ),
    },
    {
      accessorKey: 'approvalStatus',
      enableSorting: false,
      header: t('tenants.approval'),
      cell: ({ row }) => {
        // The API returns PascalCase ("Approved"), so normalize before comparing.
        const status = (row.original.approvalStatus ?? '').toLowerCase();
        const isApproved = status === 'approved';
        const isRejected = status === 'rejected';
        const label =
          isApproved ? t('common.approved')
          : isRejected ? t('common.rejected')
          : status === 'pending' ? t('common.pending')
          : (row.original.approvalStatus ?? '—');
        return (
          <Badge variant={isApproved ? 'success' : isRejected ? 'destructive' : 'warning'}>
            <span>{label}</span>
          </Badge>
        );
      },
    },
    {
      accessorKey: 'isActive',
      enableSorting: false,
      header: t('tenants.statusCol'),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'destructive'}>
          <span>{t(row.original.isActive ? 'common.active' : 'common.disabled')}</span>
        </Badge>
      ),
    },
    {
      accessorKey: 'projects',
      enableSorting: false,
      header: t('tenants.projects'),
      cell: ({ row }) => (
        <span className="font-mono text-[14px]">{row.original.projects ?? 0}</span>
      ),
    },
    {
      accessorKey: 'comments',
      enableSorting: false,
      header: t('tenants.comments'),
      cell: ({ row }) => (
        <span className="font-mono text-[14px]">{row.original.comments ?? 0}</span>
      ),
    },
    {
      accessorKey: 'plan',
      enableSorting: false,
      header: t('tenants.planCol'),
      cell: ({ row }) => (
        <Badge variant="neutral">
          {row.original.planName ?? t('tenants.noPlan')}
        </Badge>
      ),
    },
    {
      accessorKey: 'demoExpiry',
      enableSorting: false,
      header: t('tenants.demoExpiry'),
      cell: ({ row }) => (
        <span className="font-mono text-[13px] text-muted-foreground">
          {row.original.isDemo ? formatExpiry(row.original.expiresAt) : '—'}
        </span>
      ),
    },
  ];

  const actionsFor = (tenant: AnyTenant): RowActionItem[] => {
    const items: RowActionItem[] = [];
    if ((tenant.approvalStatus ?? '').toLowerCase() !== 'approved') {
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
          {t('tenants.title')}
        </h1>
        <Button onClick={openAdd} size="sm">
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
        gutter
        emptyIcon={Building2}
        emptyMessage={t('tenants.empty')}
        emptyHint={t('tenants.emptyHint')}
        emptyAction={
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4" />
            {t('tenants.addTenant')}
          </Button>
        }
      />

      {/* Change plan dialog — §3 one-task dialog */}
      <Dialog open={!!changePlanTarget} onOpenChange={(open) => { if (!open) setChangePlanTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tenants.changePlan')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[13px] font-medium text-foreground">
                {changePlanTarget?.email ?? changePlanTarget?.displayName ?? ''}
              </Label>
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
          <DialogFooter>
            <Button variant="secondary" onClick={() => setChangePlanTarget(null)}>
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

      {/* Create tenant dialog — §3 one-task dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tenants.addTenant')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tenant-email" className="text-[13px] font-medium text-foreground">
                {t('tenants.email')}
              </Label>
              <Input
                id="tenant-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tenant-password" className="text-[13px] font-medium text-foreground">
                {t('tenants.password')}
              </Label>
              <PasswordInput
                id="tenant-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tenant-name" className="text-[13px] font-medium text-foreground">
                {t('tenants.displayName')}
              </Label>
              <Input
                id="tenant-name"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!newEmail.trim() || !newPassword.trim() || !newDisplayName.trim() || createMut.isPending}
              onClick={addTenant}
            >
              {t('tenants.addTenant')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Demo config dialog — §3 one-task dialog */}
      <Dialog open={!!demoConfigTarget} onOpenChange={(open) => { if (!open) setDemoConfigTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tenants.editDemoConfig')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-[12px] text-muted-foreground">{t('tenants.demoConfigHint')}</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="demo-cap-override" className="text-[13px] font-medium text-foreground">
                {t('tenants.commentCapOverride')}
              </Label>
              <Input
                id="demo-cap-override"
                type="number"
                min={1}
                value={capInput}
                placeholder={t('tenants.overridePlaceholder')}
                onChange={(e) => setCapInput(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="demo-ttl-override" className="text-[13px] font-medium text-foreground">
                {t('tenants.ttlHoursOverride')}
              </Label>
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
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDemoConfigTarget(null)}>
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
