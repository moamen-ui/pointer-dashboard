// Tenants admin page — super-admin only.
// List all tenants; create; approve / enable / disable; delete with cascade warning.
// Demo tenants: show expiry column, Extend demo button, Demo config dialog.
// v2: Plan column (planName + subscriptionStatus) + Change plan action.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
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
import { Plus, Trash2, CheckCircle2, Ban, ShieldCheck, Clock, Settings2, CreditCard, EllipsisVertical, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
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

// The new TenantResponse fields are not in ^1.0.7 yet — cast via this helper type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTenant = TenantResponse & Record<string, any>;

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

  // ---- Helpers ----
  function formatExpiry(expiresAt: string | null | undefined): string {
    if (!expiresAt) return '—';
    try {
      return new Date(expiresAt).toLocaleString();
    } catch {
      return expiresAt;
    }
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

      {tenants.length === 0 ? (
        <EmptyState
          icon={Building2}
          message={t('tenants.empty')}
          hint={t('tenants.emptyHint')}
        />
      ) : (
        <Card>
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tenants.email')}</TableHead>
              <TableHead>{t('tenants.displayName')}</TableHead>
              <TableHead>{t('tenants.approval')}</TableHead>
              <TableHead>{t('tenants.statusCol')}</TableHead>
              <TableHead>{t('tenants.planCol')}</TableHead>
              <TableHead>{t('tenants.projects')}</TableHead>
              <TableHead>{t('tenants.comments')}</TableHead>
              <TableHead>{t('tenants.demoExpiry')}</TableHead>
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
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{tenant.planName ?? t('tenants.freePlan')}</span>
                    {tenant.subscriptionStatus && (
                      <span className="chip chip-neutral text-[10px]">{tenant.subscriptionStatus}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{tenant.projects ?? 0}</TableCell>
                <TableCell>{tenant.comments ?? 0}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {tenant.isDemo ? formatExpiry(tenant.expiresAt) : '—'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <EllipsisVertical className="h-4 w-4" />
                        <span className="sr-only">{t('tenants.actions')}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {tenant.approvalStatus === 'pending' && (
                        <DropdownMenuItem
                          disabled={patchMut.isPending}
                          onSelect={() => setStatus(tenant, 'approve')}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {t('tenants.approve')}
                        </DropdownMenuItem>
                      )}
                      {tenant.isActive ? (
                        <DropdownMenuItem
                          disabled={patchMut.isPending}
                          onSelect={() => setStatus(tenant, 'disable')}
                          className="text-destructive focus:text-destructive"
                        >
                          <Ban className="h-4 w-4" />
                          {t('common.disable')}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          disabled={patchMut.isPending}
                          onSelect={() => setStatus(tenant, 'enable')}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {t('common.enable')}
                        </DropdownMenuItem>
                      )}
                      {tenant.isDemo && (
                        <>
                          <DropdownMenuItem
                            disabled={extendMut.isPending || tenant.demoExtended === true}
                            title={tenant.demoExtended ? t('tenants.extendOnce') : undefined}
                            className={cn(
                              // Radix still blocks selection when disabled; keep pointer
                              // events so the extend-once tooltip remains visible.
                              tenant.demoExtended === true && 'data-[disabled]:pointer-events-auto',
                            )}
                            onSelect={() => extendMut.mutate({ id: tenant.id! })}
                          >
                            <Clock className="h-4 w-4" />
                            {t('tenants.extend')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openDemoConfig(tenant)}>
                            <Settings2 className="h-4 w-4" />
                            {t('tenants.editDemoConfig')}
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onSelect={() => openChangePlan(tenant)}>
                        <CreditCard className="h-4 w-4" />
                        {t('tenants.changePlan')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={deleteMut.isPending}
                        onSelect={() => setDeleteTarget(tenant)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t('tenants.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      )}

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
