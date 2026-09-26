// Tenants admin page — super-admin only.
// List all tenants; create; approve / enable / disable; delete with cascade warning.
// Demo tenants: show expiry column, Extend demo button, Demo config dialog.
// v2: Plan column (planName + subscriptionStatus) + Change plan action.
// R1.8: Invite workspace (email, display name, plan, expiry days) with pending invites section.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useGetApiAdminTenants,
  usePostApiAdminTenants,
  usePatchApiAdminTenantsWorkspaceIdStatus,
  useDeleteApiAdminTenantsWorkspaceId,
  usePostApiAdminTenantsWorkspaceIdExtend,
  usePostApiAdminTenantsWorkspaceIdPause,
  usePostApiAdminTenantsWorkspaceIdResume,
  usePostApiAdminTenantsWorkspaceIdDeletionCancel,
  usePatchApiAdminTenantsWorkspaceIdDemoConfig,
  usePatchApiAdminTenantsWorkspaceIdPlan,
  usePostApiAdminTenantsWorkspaceIdImpersonate,
  useGetApiAdminPlans,
  useGetApiAdminTenantsInvites,
  usePostApiAdminTenantsInvites,
  usePostApiAdminTenantsInvitesIdResend,
  useDeleteApiAdminTenantsInvitesId,
  useDeleteApiAdminIdentitiesPublicId,
  // DB-20 (BILL-1): super-admin tenant billing drawer.
  useGetApiAdminTenantsWorkspaceIdBilling,
  usePostApiAdminTenantsWorkspaceIdPayments,
  usePostApiAdminTenantsWorkspaceIdPaymentsPaymentIdVoid,
  useDeleteApiAdminTenantsWorkspaceIdBillingRequest,
  useDeleteApiAdminTenantsWorkspaceIdComp,
  getGetApiAdminTenantsQueryKey,
  getGetApiAdminTenantsInvitesQueryKey,
  getGetApiAdminTenantsWorkspaceIdBillingQueryKey,
  PaymentMethod,
  type TenantResponse,
  type PlanAdminResponse,
  type TenantInviteResponse,
  type OperatorPaymentResponse,
} from '@moamen-ui/pointer-react';
import { Plus, Trash2, CheckCircle2, Ban, ShieldCheck, Clock, Settings2, CreditCard, Building2, Copy, Mail, UserX, Eye, PauseCircle, PlayCircle, XCircle, Receipt, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/shared/data-table/DataTable';
import { FormField } from '@/components/shared/FormField';
import { Textarea } from '@/components/ui/textarea';
import type { RowActionItem } from '@/components/shared/types';
import { formatMoney, formatDate, formatDateTime, localDateTimeToIso } from '@/lib/format';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useAuth } from '@/lib/auth';
import { extractMessage } from '@/lib/error';
import { emailError, passwordError, requiredError, lengthRangeError } from '@/lib/validators';

const IMPERSONATE_REASON_MIN = 10;
const IMPERSONATE_REASON_MAX = 500;
const IMPERSONATE_MINUTES_OPTIONS = [15, 30, 60] as const;
const IMPERSONATE_MINUTES_DEFAULT = 30;

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
  const navigate = useNavigate();
  const { beginImpersonation } = useAuth();

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
  // DB-20 §11: "Complimentary (free)" checkbox + reason + optional end date, shown once a paid
  // plan is chosen (CreateTenantInviteRequest.Complimentary requires a live, positive-price plan).
  const [inviteComplimentary, setInviteComplimentary] = useState(false);
  const [inviteCompReason, setInviteCompReason] = useState('');
  const [inviteCompEndsAt, setInviteCompEndsAt] = useState('');
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
  // DB-14: server policy is 10-128 chars, not a common password, not the e-mail address
  // (enforced server-side only — TenantService.CreateAsync/CreateTenantValidator); 10 here
  // only drives the client-side "too short" check, see `common.passwordPolicyHint`.
  const newPasswordErrorMsg = passwordError(newPassword, 10, t);
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

  const invitePlan = allPlans.find((p) => String(p.id) === invitePlanId);
  const invitePlanIsPaid = (invitePlan?.priceMonthly ?? 0) > 0;

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
    if (invitePlanIsPaid && inviteComplimentary) {
      payload.complimentary = true;
      payload.compReason = inviteCompReason.trim() || null;
      payload.compEndsAt = localDateTimeToIso(inviteCompEndsAt);
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
    setInviteComplimentary(false);
    setInviteCompReason('');
    setInviteCompEndsAt('');
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

  // ---- Lifecycle (DB-18): operator pause/resume/cancel-deletion, distinct from the
  // membership-scoped approve/enable/disable above (which never touches the workspace row). ----
  const pauseMut = usePostApiAdminTenantsWorkspaceIdPause({
    mutation: {
      onSuccess: () => {
        toast(t('workspaceLifecycle.pause'));
        reload();
      },
      onError,
    },
  });
  const resumeMut = usePostApiAdminTenantsWorkspaceIdResume({
    mutation: {
      onSuccess: () => {
        toast(t('workspaceLifecycle.resume'));
        reload();
      },
      onError,
    },
  });
  const cancelDeletionMut = usePostApiAdminTenantsWorkspaceIdDeletionCancel({
    mutation: {
      onSuccess: () => {
        toast(t('workspaceLifecycle.cancelDeletion'));
        reload();
      },
      onError,
    },
  });

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

  // ---- Erase admin identity (DB-11c) — distinct from "Delete tenant" above: this erases the
  // PERSON (name/e-mail/secrets, tombstoned as "Deleted user"; their comments stay) without
  // touching the workspace row itself. Blocked while they are the sole Workspace Admin anywhere
  // (§3.2) — same guard as UsersPage's remove/disable, surfaced the same way: inline, not a toast.
  const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';
  const [eraseTarget, setEraseTarget] = useState<AnyTenant | null>(null);
  const [eraseConfirmText, setEraseConfirmText] = useState('');
  const [eraseError, setEraseError] = useState<string | null>(null);

  const eraseMut = useDeleteApiAdminIdentitiesPublicId({
    mutation: {
      onSuccess: () => {
        setEraseTarget(null);
        toast(t('tenants.eraseIdentityDone'), 'success');
        reload();
      },
      onError: (e) => setEraseError(extractMessage(e)),
    },
  });

  function openErase(tenant: AnyTenant) {
    setEraseError(null);
    setEraseConfirmText('');
    setEraseTarget(tenant);
  }
  function confirmErase() {
    if (!eraseTarget?.publicId) return;
    eraseMut.mutate({ publicId: eraseTarget.publicId });
  }

  // ---- View as workspace… (DB-13 impersonation) ----
  const [viewAsTarget, setViewAsTarget] = useState<AnyTenant | null>(null);
  const [viewAsReason, setViewAsReason] = useState('');
  const [viewAsReasonTouched, setViewAsReasonTouched] = useState(false);
  const [viewAsMinutes, setViewAsMinutes] = useState<number>(IMPERSONATE_MINUTES_DEFAULT);
  const [viewAsError, setViewAsError] = useState<string | null>(null);
  const viewAsReasonErrorMsg = lengthRangeError(viewAsReason, IMPERSONATE_REASON_MIN, IMPERSONATE_REASON_MAX, t);

  function openViewAs(tenant: AnyTenant) {
    setViewAsReason('');
    setViewAsReasonTouched(false);
    setViewAsMinutes(IMPERSONATE_MINUTES_DEFAULT);
    setViewAsError(null);
    setViewAsTarget(tenant);
  }

  const impersonateMut = usePostApiAdminTenantsWorkspaceIdImpersonate({
    mutation: {
      onSuccess: (res) => {
        setViewAsTarget(null);
        beginImpersonation(res, viewAsReason.trim());
        navigate('/', { replace: true });
      },
      onError: (e: unknown) => setViewAsError(extractMessage(e)),
    },
  });

  function confirmViewAs() {
    if (!viewAsTarget?.workspaceId || viewAsReasonErrorMsg) return;
    setViewAsError(null);
    impersonateMut.mutate({
      workspaceId: viewAsTarget.workspaceId,
      data: { reason: viewAsReason.trim(), minutes: viewAsMinutes },
    });
  }

  // ---- Extend demo ---- (DB-17: keyed by workspaceId now — the {id:int} route stays wired
  // one release for anything still on the older client, removed by DB-11e)
  const extendMut = usePostApiAdminTenantsWorkspaceIdExtend({
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

  const demoConfigMut = usePatchApiAdminTenantsWorkspaceIdDemoConfig({
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
    if (demoConfigTarget?.workspaceId == null) return;
    demoConfigMut.mutate({
      workspaceId: demoConfigTarget.workspaceId,
      data: {
        commentCapOverride: capInput === '' ? null : Number(capInput),
        ttlHoursOverride: ttlInput === '' ? null : Number(ttlInput),
      },
    });
  }

  // ---- Change plan ----
  const [changePlanTarget, setChangePlanTarget] = useState<AnyTenant | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  // DB-20 §3.6e: "Make complimentary" rides the same PATCH .../plan action — a paid plan selection
  // gains an optional comp reason + end date (blank reason ⇒ server default "Assigned by operator").
  const [changePlanCompReason, setChangePlanCompReason] = useState('');
  const [changePlanCompEndsAt, setChangePlanCompEndsAt] = useState('');

  function openChangePlan(tenant: AnyTenant) {
    setChangePlanTarget(tenant);
    // pre-select current plan if resolvable
    setSelectedPlanId('');
    setChangePlanCompReason('');
    setChangePlanCompEndsAt('');
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

  const selectedChangePlan = allPlans.find((p) => String(p.id) === selectedPlanId);
  const changePlanIsPaid = (selectedChangePlan?.priceMonthly ?? 0) > 0;

  function saveChangePlan() {
    if (changePlanTarget?.workspaceId == null || !selectedPlanId) return;
    changePlanMut.mutate({
      workspaceId: changePlanTarget.workspaceId,
      data: {
        planId: Number(selectedPlanId),
        compReason: changePlanIsPaid ? changePlanCompReason.trim() || null : null,
        compEndsAt: changePlanIsPaid ? localDateTimeToIso(changePlanCompEndsAt) : null,
      },
    });
  }

  // ---- Billing drawer (DB-20 §3.9/§3.6): summary + payments + redemptions, "Mark as paid",
  // "Void" (latest payment only), "Reject request", "End complimentary". ----
  const [billingTarget, setBillingTarget] = useState<AnyTenant | null>(null);

  const { data: operatorBilling, isLoading: billingLoading } = useGetApiAdminTenantsWorkspaceIdBilling(
    billingTarget?.workspaceId ?? '',
    { query: { enabled: !!billingTarget?.workspaceId } },
  );
  const billingSummary = operatorBilling?.summary;
  const operatorPayments: OperatorPaymentResponse[] = operatorBilling?.payments ?? [];
  const latestPaymentId = operatorPayments
    .filter((p) => p.kind === 'Payment')
    .sort((a, b) => new Date(b.recordedAt ?? 0).getTime() - new Date(a.recordedAt ?? 0).getTime())[0]?.id;

  const reloadBillingDrawer = () => {
    if (billingTarget?.workspaceId) {
      void qc.invalidateQueries({
        queryKey: getGetApiAdminTenantsWorkspaceIdBillingQueryKey(billingTarget.workspaceId),
      });
    }
    reload();
  };

  // ---- Mark as paid ----
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>(String(PaymentMethod.NUMBER_1));
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  function openRecordPayment() {
    const quoted = billingSummary?.quotedPrice ?? billingSummary?.renewalPrice ?? null;
    setPaymentAmount(quoted != null ? String(quoted) : '');
    setPaymentCurrency(billingSummary?.quotedCurrency ?? billingSummary?.renewalCurrency ?? '');
    setPaymentDate(new Date().toISOString().slice(0, 16));
    setPaymentMethod(String(PaymentMethod.NUMBER_1));
    setPaymentReference('');
    setPaymentNote('');
    setRecordPaymentOpen(true);
  }

  const recordPaymentMut = usePostApiAdminTenantsWorkspaceIdPayments({
    mutation: {
      onSuccess: () => {
        setRecordPaymentOpen(false);
        toast(t('tenants.billingPaymentRecorded'));
        reloadBillingDrawer();
      },
      onError,
    },
  });

  function saveRecordPayment() {
    if (billingTarget?.workspaceId == null || !paymentAmount || !paymentDate) return;
    recordPaymentMut.mutate({
      workspaceId: billingTarget.workspaceId,
      data: {
        amount: Number(paymentAmount),
        currency: paymentCurrency.trim() || undefined,
        paidAt: localDateTimeToIso(paymentDate) ?? new Date().toISOString(),
        method: Number(paymentMethod) as (typeof PaymentMethod)[keyof typeof PaymentMethod],
        reference: paymentReference.trim() || null,
        note: paymentNote.trim() || null,
      },
    });
  }

  // ---- Void latest payment ----
  const [voidTarget, setVoidTarget] = useState<OperatorPaymentResponse | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const voidMut = usePostApiAdminTenantsWorkspaceIdPaymentsPaymentIdVoid({
    mutation: {
      onSuccess: () => {
        setVoidTarget(null);
        toast(t('tenants.billingPaymentVoided'));
        reloadBillingDrawer();
      },
      onError,
    },
  });

  function confirmVoid() {
    if (billingTarget?.workspaceId == null || voidTarget?.id == null || !voidReason.trim()) return;
    voidMut.mutate({
      workspaceId: billingTarget.workspaceId,
      paymentId: voidTarget.id,
      data: { reason: voidReason.trim() },
    });
  }

  // ---- Reject request / end complimentary ----
  const rejectRequestMut = useDeleteApiAdminTenantsWorkspaceIdBillingRequest({
    mutation: {
      onSuccess: () => {
        toast(t('tenants.billingRequestRejected'));
        reloadBillingDrawer();
      },
      onError,
    },
  });
  const endCompMut = useDeleteApiAdminTenantsWorkspaceIdComp({
    mutation: {
      onSuccess: () => {
        toast(t('tenants.billingCompEnded'));
        reloadBillingDrawer();
      },
      onError,
    },
  });

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
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={row.original.isActive ? 'success' : 'destructive'}>
            <span>{t(row.original.isActive ? 'common.active' : 'common.disabled')}</span>
          </Badge>
          {row.original.deletionScheduledFor ? (
            <Badge variant="destructive">
              <span>{t('workspaceLifecycle.badgeScheduled')}</span>
            </Badge>
          ) : row.original.pausedAt ? (
            <Badge variant="warning">
              <span>
                {t(
                  row.original.pausedByOperator
                    ? 'workspaceLifecycle.badgePausedOperator'
                    : 'workspaceLifecycle.badgePaused',
                )}
              </span>
            </Badge>
          ) : null}
        </div>
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
    // DB-20 §11: tenant list gains the at-a-glance billing state — pending request + quoted
    // price, complimentary badge, and the current paid period's end.
    {
      accessorKey: 'billing',
      enableSorting: false,
      header: t('tenants.billingCol'),
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          {row.original.isComplimentary && (
            <Badge variant="success" hideGlyph>
              {t('tenants.complimentaryBadge')}
              {row.original.compEndsAt ? ` · ${formatDate(row.original.compEndsAt)}` : ''}
            </Badge>
          )}
          {row.original.requestedPlanName && (
            <Badge variant="warning">
              {t('tenants.pendingRequestBadge', { plan: row.original.requestedPlanName })}
              {row.original.quotedPrice != null
                ? ` · ${formatMoney(row.original.quotedPrice, row.original.quotedCurrency)}`
                : ''}
            </Badge>
          )}
          {row.original.currentPeriodEnd && (
            <span className="font-mono text-[12px] text-muted-foreground">
              {t('tenants.periodEndsShort', { date: formatDate(row.original.currentPeriodEnd) })}
            </span>
          )}
          {!row.original.isComplimentary && !row.original.requestedPlanName && !row.original.currentPeriodEnd && (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
  ];

  const actionsFor = (tenant: AnyTenant): RowActionItem[] => {
    const items: RowActionItem[] = [];
    if ((tenant.approvalStatus ?? '').toLowerCase() !== 'approved') {
      items.push({ label: t('tenants.approve'), icon: ShieldCheck, onClick: () => setStatus(tenant, 'approve') });
    }
    if (tenant.isActive) {
      items.push({
        label: t('workspaceLifecycle.tenantsDisableAdmin'),
        icon: Ban,
        severity: 'danger',
        onClick: () => setStatus(tenant, 'disable'),
      });
    } else {
      items.push({ label: t('common.enable'), icon: CheckCircle2, onClick: () => setStatus(tenant, 'enable') });
    }
    // DB-18 operator lifecycle actions — distinct from the membership-scoped enable/disable above.
    if (tenant.deletionScheduledFor) {
      items.push({
        label: t('workspaceLifecycle.cancelDeletion'),
        icon: XCircle,
        onClick: () => cancelDeletionMut.mutate({ workspaceId: tenant.workspaceId! }),
      });
    }
    if (tenant.pausedAt) {
      items.push({
        label: t('workspaceLifecycle.resume'),
        icon: PlayCircle,
        onClick: () => resumeMut.mutate({ workspaceId: tenant.workspaceId! }),
      });
    } else {
      items.push({
        label: t('workspaceLifecycle.pause'),
        icon: PauseCircle,
        onClick: () => pauseMut.mutate({ workspaceId: tenant.workspaceId! }),
      });
    }
    if (tenant.isDemo) {
      items.push({
        label: t('tenants.extend'),
        icon: Clock,
        disabled: tenant.demoExtended === true,
        tooltip: tenant.demoExtended ? t('tenants.extendOnce') : undefined,
        onClick: () => extendMut.mutate({ workspaceId: tenant.workspaceId! }),
      });
      items.push({ label: t('tenants.editDemoConfig'), icon: Settings2, onClick: () => openDemoConfig(tenant) });
    }
    items.push({ label: t('tenants.changePlan'), icon: CreditCard, onClick: () => openChangePlan(tenant) });
    items.push({ label: t('tenants.billing'), icon: Receipt, onClick: () => setBillingTarget(tenant) });
    items.push({ label: t('tenants.viewAs'), icon: Eye, onClick: () => openViewAs(tenant) });
    const hasAdmin = !!tenant.publicId && tenant.publicId !== EMPTY_GUID;
    items.push({
      label: t('tenants.eraseIdentity'),
      icon: UserX,
      severity: 'danger',
      disabled: !hasAdmin,
      tooltip: hasAdmin ? undefined : t('tenants.eraseIdentityNoAdmin'),
      onClick: () => openErase(tenant),
    });
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
            {/* DB-20 §3.6e: assigning a paid plan here always marks it complimentary — this IS the
                "Make complimentary" flow (there is no other way to assign a paid plan for free). */}
            {changePlanIsPaid && (
              <>
                <p className="text-[12px] text-muted-foreground">{t('tenants.compHint')}</p>
                <FormField
                  label={t('tenants.compReason')}
                  htmlFor="change-plan-comp-reason"
                  hint={t('tenants.noPersonalDataHint')}
                >
                  <Input
                    id="change-plan-comp-reason"
                    value={changePlanCompReason}
                    maxLength={200}
                    placeholder={t('tenants.compReasonPlaceholder')}
                    onChange={(e) => setChangePlanCompReason(e.target.value)}
                  />
                </FormField>
                <FormField label={t('tenants.compEndsAt')} htmlFor="change-plan-comp-ends">
                  <Input
                    id="change-plan-comp-ends"
                    type="date"
                    value={changePlanCompEndsAt}
                    onChange={(e) => setChangePlanCompEndsAt(e.target.value)}
                  />
                </FormField>
              </>
            )}
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
                {/* DB-20 §11: complimentary (free) new-workspace invite — only meaningful once a
                    paid plan is chosen above. */}
                {invitePlanIsPaid && (
                  <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="invite-complimentary" className="text-[13px] font-medium">
                        {t('tenants.complimentaryInvite')}
                      </Label>
                      <Switch
                        id="invite-complimentary"
                        checked={inviteComplimentary}
                        onCheckedChange={setInviteComplimentary}
                      />
                    </div>
                    {inviteComplimentary && (
                      <>
                        <FormField
                          label={t('tenants.compReason')}
                          htmlFor="invite-comp-reason"
                          hint={t('tenants.noPersonalDataHint')}
                        >
                          <Input
                            id="invite-comp-reason"
                            value={inviteCompReason}
                            maxLength={200}
                            placeholder={t('tenants.compReasonPlaceholder')}
                            onChange={(e) => setInviteCompReason(e.target.value)}
                          />
                        </FormField>
                        <FormField label={t('tenants.compEndsAt')} htmlFor="invite-comp-ends">
                          <Input
                            id="invite-comp-ends"
                            type="date"
                            value={inviteCompEndsAt}
                            onChange={(e) => setInviteCompEndsAt(e.target.value)}
                          />
                        </FormField>
                      </>
                    )}
                  </div>
                )}
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
                    hint={t('common.passwordPolicyHint')}
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

      {/* View as workspace… (DB-13) — one-task dialog: reason (10–500 chars, e-mailed to the
          workspace's admins) + duration, then an audited, time-boxed read-only session. */}
      <Dialog open={!!viewAsTarget} onOpenChange={(open) => { if (!open) setViewAsTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tenants.viewAsTitle')}</DialogTitle>
            <DialogDescription>
              {t('tenants.viewAsHint', {
                workspace: viewAsTarget?.workspaceName ?? viewAsTarget?.email ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {viewAsError && (
              <p role="alert" className="text-[13px] text-state-danger">
                {viewAsError}
              </p>
            )}
            <FormField
              label={t('tenants.viewAsReason')}
              htmlFor="view-as-reason"
              hint={t('tenants.viewAsReasonHint')}
              error={viewAsReasonTouched ? viewAsReasonErrorMsg || undefined : undefined}
            >
              <Textarea
                id="view-as-reason"
                value={viewAsReason}
                maxLength={IMPERSONATE_REASON_MAX}
                onChange={(e) => setViewAsReason(e.target.value)}
                onBlur={() => setViewAsReasonTouched(true)}
                autoFocus
              />
            </FormField>
            <FormField label={t('tenants.viewAsDuration')} htmlFor="view-as-minutes">
              <Select value={String(viewAsMinutes)} onValueChange={(v) => setViewAsMinutes(Number(v))}>
                <SelectTrigger id="view-as-minutes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPERSONATE_MINUTES_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {t('tenants.viewAsMinutes', { count: m })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setViewAsTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!!viewAsReasonErrorMsg || impersonateMut.isPending}
              onClick={confirmViewAs}
            >
              <Eye className="h-4 w-4" />
              {t('tenants.viewAsConfirm')}
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

      {/* Erase admin identity (DB-11c) — typed confirmation: this is irreversible and distinct
          from "Delete tenant" (the workspace itself is untouched), so it asks for more than a
          click. Blocked while the admin is the sole Workspace Admin anywhere; the server names
          the workspace(s) — shown inline in this same dialog rather than nested/toast. */}
      <Dialog open={!!eraseTarget} onOpenChange={(o) => !o && setEraseTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('tenants.eraseIdentityTitle')}</DialogTitle>
            <DialogDescription>
              {t('tenants.eraseIdentityHint', { email: eraseTarget?.email ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            {eraseError && (
              <p role="alert" className="text-[13px] text-state-danger">
                {eraseError}
              </p>
            )}
            <FormField label={t('tenants.eraseIdentityTypeToConfirm', { email: eraseTarget?.email ?? '' })} htmlFor="erase-confirm-text">
              <Input
                id="erase-confirm-text"
                value={eraseConfirmText}
                onChange={(e) => setEraseConfirmText(e.target.value)}
                autoFocus
              />
            </FormField>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEraseTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={
                eraseMut.isPending ||
                eraseConfirmText.trim().toLowerCase() !== (eraseTarget?.email ?? '').toLowerCase()
              }
              onClick={confirmErase}
            >
              {t('tenants.eraseIdentityConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Billing drawer (DB-20 §3.9) — summary, payments (incl. note/recorded-by), redemptions */}
      <Dialog open={!!billingTarget} onOpenChange={(o) => !o && setBillingTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('tenants.billingFor', {
                name: billingTarget?.workspaceName ?? billingTarget?.email ?? '',
              })}
            </DialogTitle>
          </DialogHeader>

          {billingLoading ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              {t('billing.loading')}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-md border border-border p-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium">
                    {billingSummary?.planName ?? t('tenants.noPlan')}
                  </span>
                  <Badge
                    variant={
                      billingSummary?.status === 'Active'
                        ? 'success'
                        : billingSummary?.status === 'PastDue'
                          ? 'destructive'
                          : billingSummary?.status === 'PendingActivation'
                            ? 'warning'
                            : 'neutral'
                    }
                  >
                    {billingSummary?.status ?? 'None'}
                  </Badge>
                  {billingSummary?.isComplimentary && (
                    <Badge variant="success" hideGlyph>
                      {t('billing.complimentary')}
                      {billingSummary?.compEndsAt
                        ? ` · ${t('billing.until', { date: formatDate(billingSummary.compEndsAt) })}`
                        : ''}
                    </Badge>
                  )}
                </div>
                {billingSummary?.currentPeriodEnd && (
                  <p className="text-[13px] text-muted-foreground">
                    {t('billing.periodEnds', { date: formatDate(billingSummary.currentPeriodEnd) })}
                  </p>
                )}
                {billingSummary?.status === 'PastDue' && billingSummary?.graceEndsAt && (
                  <div className="flex items-start gap-2 rounded-md border border-state-danger/30 bg-state-danger-tint p-2 text-[12px] text-state-danger">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{t('billing.gracePeriodWarning', { date: formatDate(billingSummary.graceEndsAt) })}</span>
                  </div>
                )}
                {billingSummary?.requestedPlanId != null && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-gutter p-2">
                    <div className="text-[13px]">
                      <span className="font-medium">
                        {t('billing.pendingRequest', { plan: billingSummary?.requestedPlanName ?? '' })}
                      </span>
                      {billingSummary?.quotedPrice != null && (
                        <span className="text-muted-foreground ms-2">
                          {formatMoney(billingSummary.quotedPrice, billingSummary.quotedCurrency)}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={rejectRequestMut.isPending}
                      onClick={() => rejectRequestMut.mutate({ workspaceId: billingTarget!.workspaceId! })}
                    >
                      {t('tenants.rejectRequest')}
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {!billingSummary?.isComplimentary && (
                    <Button size="sm" onClick={openRecordPayment}>
                      {t('tenants.markAsPaid')}
                    </Button>
                  )}
                  {billingSummary?.isComplimentary && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={endCompMut.isPending}
                      onClick={() => endCompMut.mutate({ workspaceId: billingTarget!.workspaceId! })}
                    >
                      {t('tenants.endComplimentary')}
                    </Button>
                  )}
                </div>
              </div>

              {/* Payments — operator view includes note + recordedBy (R17) */}
              <div className="flex flex-col gap-2">
                <h3 className="text-[13px] font-semibold">{t('billing.paymentHistory')}</h3>
                <div className="rounded-md border border-border divide-y divide-border max-h-[260px] overflow-y-auto">
                  {operatorPayments.length === 0 && (
                    <p className="p-3 text-[13px] text-muted-foreground">{t('billing.noPayments')}</p>
                  )}
                  {operatorPayments.map((p) => (
                    <div key={p.id} className="p-3 flex flex-col gap-1 text-[13px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {p.kind === 'Void' ? t('billing.paymentKind.void') : p.planName}
                        </span>
                        <span className="font-mono">{formatMoney(p.amount, p.currency)}</span>
                      </div>
                      <div className="text-muted-foreground text-[12px] flex flex-wrap gap-x-2">
                        <span>{p.method ?? '—'}</span>
                        {p.reference && <span>· {p.reference}</span>}
                        <span>· {formatDateTime(p.paidAt ?? p.recordedAt)}</span>
                      </div>
                      {p.note && <div className="text-[12px] text-muted-foreground">{p.note}</div>}
                      {p.kind === 'Payment' && p.id === latestPaymentId && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto min-h-0 self-start p-0 text-state-danger"
                          onClick={() => {
                            setVoidReason('');
                            setVoidTarget(p);
                          }}
                        >
                          {t('tenants.voidPayment')}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Redemptions */}
              {(operatorBilling?.redemptions?.length ?? 0) > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-[13px] font-semibold">{t('discountCodes.title')}</h3>
                  <div className="rounded-md border border-border divide-y divide-border max-h-[200px] overflow-y-auto">
                    {operatorBilling!.redemptions!.map((r) => (
                      <div key={r.id} className="p-2 flex items-center justify-between gap-2 text-[12px]">
                        <span>
                          {r.codeSnapshot} · {r.planName}
                        </span>
                        <span className="text-muted-foreground">{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setBillingTarget(null)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as paid */}
      <Dialog open={recordPaymentOpen} onOpenChange={setRecordPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tenants.markAsPaid')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('billing.colAmount')} htmlFor="payment-amount">
                <Input
                  id="payment-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </FormField>
              <FormField label={t('discountCodes.currency')} htmlFor="payment-currency">
                <Input
                  id="payment-currency"
                  value={paymentCurrency}
                  maxLength={3}
                  onChange={(e) => setPaymentCurrency(e.target.value.toUpperCase())}
                />
              </FormField>
              <FormField label={t('billing.colPaidAt')} htmlFor="payment-date">
                <Input
                  id="payment-date"
                  type="datetime-local"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </FormField>
              <FormField label={t('billing.colMethod')} htmlFor="payment-method">
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={String(PaymentMethod.NUMBER_1)}>{t('billing.method.cash')}</SelectItem>
                    <SelectItem value={String(PaymentMethod.NUMBER_2)}>{t('billing.method.bankTransfer')}</SelectItem>
                    <SelectItem value={String(PaymentMethod.NUMBER_3)}>{t('billing.method.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label={t('billing.colReference')} htmlFor="payment-reference">
              <Input
                id="payment-reference"
                value={paymentReference}
                maxLength={128}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </FormField>
            <FormField
              label={t('tenants.paymentNote')}
              htmlFor="payment-note"
              hint={t('tenants.noPersonalDataHint')}
            >
              <Textarea
                id="payment-note"
                rows={2}
                maxLength={500}
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRecordPaymentOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!paymentAmount || !paymentDate || recordPaymentMut.isPending}
              onClick={saveRecordPayment}
            >
              {t('tenants.markAsPaid')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void latest payment */}
      <Dialog open={!!voidTarget} onOpenChange={(o) => !o && setVoidTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('tenants.voidPayment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormField label={t('tenants.voidReason')} htmlFor="void-reason">
              <Textarea
                id="void-reason"
                rows={3}
                maxLength={500}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                autoFocus
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setVoidTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={!voidReason.trim() || voidMut.isPending}
              onClick={confirmVoid}
            >
              {t('tenants.voidPaymentConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
