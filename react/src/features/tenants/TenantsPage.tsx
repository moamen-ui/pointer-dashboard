// Tenants admin page — super-admin only.
// List all tenants; create; approve / enable / disable; delete with cascade warning.
// Demo tenants: show expiry column, Extend demo button, Demo config dialog.
// v2: Plan column (planName + subscriptionStatus) + Change plan action.
// R1.8: Invite workspace (email, display name, plan, expiry days) with pending invites section.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useGetApiAdminTenants,
  usePostApiAdminTenants,
  usePatchApiAdminTenantsWorkspaceIdStatus,
  useDeleteApiAdminTenantsWorkspaceId,
  usePostApiAdminTenantsIdExtend,
  usePatchApiAdminTenantsIdDemoConfig,
  usePatchApiAdminTenantsWorkspaceIdPlan,
  useGetApiAdminPlans,
  useGetApiAdminTenantsInvites,
  usePostApiAdminTenantsInvites,
  usePostApiAdminTenantsInvitesIdResend,
  useDeleteApiAdminTenantsInvitesId,
  getGetApiAdminTenantsQueryKey,
  getGetApiAdminTenantsInvitesQueryKey,
  type TenantResponse,
  type PlanAdminResponse,
  type TenantInviteResponse,
} from '@moamen-ui/pointer-react';
import { Plus, Trash2, CheckCircle2, Ban, ShieldCheck, Clock, Settings2, CreditCard, Building2, Copy, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table/DataTable';
import { FormField } from '@/components/shared/FormField';
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
import { emailError, requiredError } from '@/lib/validators';

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
  const reloadInvites = () =>
    void qc.invalidateQueries({ queryKey: getGetApiAdminTenantsInvitesQueryKey() });
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // ---- Invites ----
  const { data: invitesData } = useGetApiAdminTenantsInvites();
  const invites: TenantInviteResponse[] = (invitesData as unknown as { data?: TenantInviteResponse[] })?.data
    ?? (Array.isArray(invitesData) ? (invitesData as TenantInviteResponse[]) : []);

  // ---- Create / Invite dialog ----
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<'invite' | 'create'>('invite');

  // Invite mode state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [invitePlanId, setInvitePlanId] = useState<string>('');
  const [inviteExpiryDays, setInviteExpiryDays] = useState<number>(30);
  const [inviteEmailTouched, setInviteEmailTouched] = useState(false);
  const [inviteShowSuccess, setInviteShowSuccess] = useState(false);
  const [inviteSuccessData, setInviteSuccessData] = useState<{ url?: string; emailSent: boolean } | null>(null);
  const inviteEmailErrorMsg = emailError(inviteEmail, t);
  const inviteInvalid = !!inviteEmailErrorMsg;

  // Create mode state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [showManualCreate, setShowManualCreate] = useState(false);
  const newEmailErrorMsg = emailError(newEmail, t);
  const newPasswordErrorMsg = requiredError(newPassword, t);
  const newDisplayNameErrorMsg = requiredError(newDisplayName, t);
  const addTenantInvalid = !!newEmailErrorMsg || !!newPasswordErrorMsg || !!newDisplayNameErrorMsg;

  // ---- Invite tenant mutation ----
  const inviteMut = usePostApiAdminTenantsInvites({
    mutation: {
      onSuccess: (res: any) => {
        const responseData = res.data ?? res;
        setInviteShowSuccess(true);
        setInviteSuccessData({
          url: responseData.url,
          emailSent: responseData.emailSent !== false,
        });
        reloadInvites();
      },
      onError,
    },
  });

  function sendInvite() {
    if (inviteInvalid) return;
    const payload: any = {
      email: inviteEmail.trim(),
    };
    if (inviteDisplayName.trim()) {
      payload.displayName = inviteDisplayName.trim();
    }
    if (invitePlanId) {
      payload.planId = Number(invitePlanId);
    }
    if (inviteExpiryDays) {
      payload.expiryDays = inviteExpiryDays;
    }
    inviteMut.mutate({ data: payload });
  }

  function copyInviteLink(url: string | null | undefined) {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(
      () => toast(t('common.copied'), 'success'),
      () => toast(t('common.copyFailed'), 'error'),
    );
  }

  // ---- Resend invite mutation ----
  const resendMut = usePostApiAdminTenantsInvitesIdResend({
    mutation: {
      onSuccess: (res: any) => {
        toast(t('tenants.inviteResent'));
        const responseData = res.data ?? res;
        if (responseData.url) {
          copyInviteLink(responseData.url);
        }
        reloadInvites();
      },
      onError,
    },
  });

  function resendInvite(inviteId: number, _rotate: boolean = false) {
    resendMut.mutate({ id: inviteId });
  }

  // ---- Revoke invite mutation ----
  const revokeMut = useDeleteApiAdminTenantsInvitesId({
    mutation: {
      onSuccess: () => {
        toast(t('tenants.inviteRevoked'));
        reloadInvites();
      },
      onError,
    },
  });

  function revokeInvite(invite: TenantInviteResponse) {
    if (!invite.id) return;
    revokeMut.mutate({ id: invite.id });
  }

  // ---- Create tenant mutation ----
  const createMut = usePostApiAdminTenants({
    mutation: {
      onSuccess: () => {
        setAddOpen(false);
        setNewEmail('');
        setNewPassword('');
        setNewDisplayName('');
        setShowManualCreate(false);
        toast(t('tenants.created'));
        reload();
      },
      onError,
    },
  });

  function openAdd() {
    setAddMode('invite');
    setInviteEmail('');
    setInviteDisplayName('');
    setInvitePlanId('');
    setInviteExpiryDays(30);
    setInviteEmailTouched(false);
    setInviteShowSuccess(false);
    setInviteSuccessData(null);
    setNewEmail('');
    setNewPassword('');
    setNewDisplayName('');
    setShowManualCreate(false);
    setAddOpen(true);
  }

  function addTenant() {
    if (addTenantInvalid) return;
    createMut.mutate({
      data: {
        email: newEmail.trim(),
        password: newPassword,
        displayName: newDisplayName.trim(),
      },
    });
  }

  // ---- Status mutations (approve / enable / disable) ----
  const patchMut = usePatchApiAdminTenantsWorkspaceIdStatus({
    mutation: {
      onSuccess: () => {
        toast(t('tenants.updated'));
        reload();
      },
      onError,
    },
  });

  function setStatus(tenant: AnyTenant, action: string) {
    patchMut.mutate({ workspaceId: tenant.workspaceId!, data: { action } });
  }

  // ---- Delete with cascade warning ----
  const [deleteTarget, setDeleteTarget] = useState<AnyTenant | null>(null);

  const deleteMut = useDeleteApiAdminTenantsWorkspaceId({
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
    if (deleteTarget?.workspaceId == null) return;
    deleteMut.mutate({ workspaceId: deleteTarget.workspaceId });
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

  const changePlanMut = usePatchApiAdminTenantsWorkspaceIdPlan({
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
    if (changePlanTarget?.workspaceId == null || !selectedPlanId) return;
    changePlanMut.mutate({
      workspaceId: changePlanTarget.workspaceId,
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
      meta: { mobile: 'primary' },
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-medium">{row.original.email}</span>
          {row.original.workspaceName && (
            <span className="text-[13px] text-muted-foreground">{row.original.workspaceName}</span>
          )}
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
          {t('tenants.inviteWorkspace')}
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
            {t('tenants.inviteWorkspace')}
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
            <FormField
              label={changePlanTarget?.email ?? changePlanTarget?.displayName ?? ''}
              htmlFor="change-plan-select"
            >
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger id="change-plan-select">
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
            </FormField>
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

      {/* Invite / Create tenant dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tenants.inviteWorkspace')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Invite mode */}
            {addMode === 'invite' && !inviteShowSuccess && (
              <>
                <FormField
                  label={t('tenants.emailToInvite')}
                  htmlFor="invite-email"
                  error={inviteEmailTouched ? inviteEmailErrorMsg || undefined : undefined}
                >
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onBlur={() => setInviteEmailTouched(true)}
                    autoFocus
                  />
                </FormField>
                <FormField
                  label={t('tenants.displayName')}
                  htmlFor="invite-display-name"
                >
                  <Input
                    id="invite-display-name"
                    value={inviteDisplayName}
                    onChange={(e) => setInviteDisplayName(e.target.value)}
                  />
                </FormField>
                <FormField
                  label={t('tenants.selectPlan')}
                  htmlFor="invite-plan-select"
                >
                  <Select value={invitePlanId} onValueChange={setInvitePlanId}>
                    <SelectTrigger id="invite-plan-select">
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
                </FormField>
                <FormField
                  label="Expiry (days)"
                  htmlFor="invite-expiry"
                >
                  <Input
                    id="invite-expiry"
                    type="number"
                    min={1}
                    max={30}
                    value={inviteExpiryDays}
                    onChange={(e) => setInviteExpiryDays(Number(e.target.value) || 30)}
                  />
                </FormField>
              </>
            )}

            {/* Success state with link */}
            {inviteShowSuccess && inviteSuccessData && (
              <div className="space-y-3">
                <p className="text-[13px] text-muted-foreground">
                  {t('tenants.inviteHint')}
                </p>
                {inviteSuccessData.url && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-gutter border border-border">
                    <code className="flex-1 text-[12px] font-mono break-all">{inviteSuccessData.url}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyInviteLink(inviteSuccessData.url)}
                    >
                      {t('common.copyLink')}
                    </Button>
                  </div>
                )}
                {!inviteSuccessData.emailSent && (
                  <p className="text-[12px] text-state-danger">
                    ⚠ {t('tenants.emailNotSent')}
                  </p>
                )}
              </div>
            )}

            {/* Pending invites section */}
            {invites.length > 0 && (
              <div className="space-y-2 mt-4 pt-4 border-t border-border">
                <div className="text-[13px] font-medium text-foreground">
                  {t('tenants.pendingInvites')}
                </div>
                <div className="rounded-md border border-border divide-y divide-border max-h-[200px] overflow-y-auto">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 text-[13px]">
                      <div className="flex-1">
                        <div className="font-medium">{inv.email}</div>
                        {inv.displayName && (
                          <div className="text-[12px] text-muted-foreground mt-0.5">
                            {inv.displayName}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {inv.url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteLink(inv.url)}
                            title={t('common.copyLink')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resendInvite(inv.id!, false)}
                          disabled={resendMut.isPending}
                          title={t('common.resend')}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-state-danger"
                          onClick={() => revokeInvite(inv)}
                          disabled={revokeMut.isPending}
                          title={t('common.revoke')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Disclosure for manual create */}
            <div className="border-t border-border pt-4">
              <button
                type="button"
                className="text-[13px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => setShowManualCreate(!showManualCreate)}
              >
                {showManualCreate ? '▼' : '▶'} {t('tenants.manualCreate')}
              </button>

              {showManualCreate && (
                <div className="mt-4 space-y-4 rounded-md bg-gutter p-4 border border-border">
                  <div className="text-[13px] text-muted-foreground mb-2">
                    {t('tenants.manualCreateHint')}
                  </div>
                  <FormField label={t('tenants.email')} htmlFor="create-email">
                    <Input
                      id="create-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </FormField>
                  <FormField
                    label={t('tenants.displayName')}
                    htmlFor="create-display-name"
                  >
                    <Input
                      id="create-display-name"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                    />
                  </FormField>
                  <FormField
                    label={t('tenants.password')}
                    htmlFor="create-password"
                  >
                    <PasswordInput
                      id="create-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </FormField>
                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={addTenantInvalid || createMut.isPending}
                      onClick={addTenant}
                    >
                      <Plus className="h-4 w-4" />
                      {t('tenants.createDirectly')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              {t('common.close')}
            </Button>
            {addMode === 'invite' && !inviteShowSuccess && (
              <Button
                disabled={inviteInvalid || inviteMut.isPending}
                onClick={sendInvite}
              >
                {t('common.sendInvite')}
              </Button>
            )}
            {inviteShowSuccess && (
              <Button onClick={() => setAddOpen(false)}>
                {t('common.close')}
              </Button>
            )}
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
            <FormField label={t('tenants.commentCapOverride')} htmlFor="demo-cap-override">
              <Input
                id="demo-cap-override"
                type="number"
                min={1}
                value={capInput}
                placeholder={t('tenants.overridePlaceholder')}
                onChange={(e) => setCapInput(e.target.value)}
              />
            </FormField>
            <FormField label={t('tenants.ttlHoursOverride')} htmlFor="demo-ttl-override">
              <Input
                id="demo-ttl-override"
                type="number"
                min={1}
                value={ttlInput}
                placeholder={t('tenants.overridePlaceholder')}
                onChange={(e) => setTtlInput(e.target.value)}
              />
            </FormField>
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
