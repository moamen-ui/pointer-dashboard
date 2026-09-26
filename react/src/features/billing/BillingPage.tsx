// DB-20 (BILL-1) — Workspace Admin's own "Billing" page: current plan/status, a manual-payment
// plan picker (optional reference code, explicit "Apply" quote), and payment history (redacted:
// no operator note/recordedBy — see WorkspacePaymentResponse).
//
// NOTE (found while building this page, not fixed here — API repo is read-only from this pass):
// "choose a plan" needs each plan's integer id, but the only plans list a Workspace Admin's own
// token can call is `useGetApiAdminPlans()` (`GET /api/admin/plans`), which is
// `[Authorize(Policy = Policies.SuperAdmin)]` server-side (API/Controllers/Admin/PlansController.cs).
// The anonymous `GET /api/plans` (`useGetApiPlans`) never carries an id (marketing-only DTO, see
// SignupPage.tsx's identical note). Wired against the documented "existing plans query" per the
// DB-20 execution doc §11 checklist; a real Workspace Admin session will 403 loading this list
// until the API adds an authenticated (Policies.Admin) plans-with-id read — flagged in the
// hand-back report for a backend follow-up.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiAdminBilling,
  useGetApiAdminBillingPayments,
  useGetApiAdminPlans,
  usePostApiAdminBillingQuote,
  usePostApiAdminBillingRequest,
  useDeleteApiAdminBillingRequest,
  getGetApiAdminBillingQueryKey,
  getGetApiAdminBillingPaymentsQueryKey,
  PlanDisplayState,
  type PlanAdminResponse,
  type WorkspacePaymentResponse,
  type BillingQuoteResponse,
} from '@moamen-ui/pointer-react';
import { CreditCard, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/shared/FormField';
import { DataTable } from '@/components/shared/data-table/DataTable';
import type { ColumnDef } from '@tanstack/react-table';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';
import { formatMoney, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

function subscriptionStatusBadge(status: string | null | undefined): {
  variant: 'success' | 'warning' | 'destructive' | 'neutral';
  key: string;
} {
  switch (status) {
    case 'Active':
      return { variant: 'success', key: 'billing.status.active' };
    case 'PendingActivation':
      return { variant: 'warning', key: 'billing.status.pendingActivation' };
    case 'PastDue':
      return { variant: 'destructive', key: 'billing.status.pastDue' };
    case 'Canceled':
      return { variant: 'neutral', key: 'billing.status.canceled' };
    case 'Trialing':
      return { variant: 'warning', key: 'billing.status.trialing' };
    default:
      return { variant: 'neutral', key: 'billing.status.none' };
  }
}

function paymentKindLabel(kind: string | null | undefined, t: (k: string) => string): string {
  if (kind === 'Void') return t('billing.paymentKind.void');
  return t('billing.paymentKind.payment');
}

function methodLabel(method: string | null | undefined, t: (k: string) => string): string {
  switch (method) {
    case 'Cash':
      return t('billing.method.cash');
    case 'BankTransfer':
      return t('billing.method.bankTransfer');
    case 'Other':
      return t('billing.method.other');
    default:
      return '—';
  }
}

export function BillingPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: summary, isLoading, isError } = useGetApiAdminBilling();
  const { data: paymentsRaw } = useGetApiAdminBillingPayments();
  const payments: WorkspacePaymentResponse[] =
    (paymentsRaw as unknown as { data?: WorkspacePaymentResponse[] })?.data ??
    (Array.isArray(paymentsRaw) ? (paymentsRaw as WorkspacePaymentResponse[]) : []);

  // See file-level note: this is the only plans-with-id query the app has, but it is
  // SuperAdmin-gated server-side — a plain Workspace Admin caller will get an error here.
  const { data: plansRaw, isError: plansError } = useGetApiAdminPlans();
  const allPlans: PlanAdminResponse[] =
    (plansRaw as unknown as { data?: PlanAdminResponse[] })?.data ??
    (Array.isArray(plansRaw) ? (plansRaw as PlanAdminResponse[]) : []);
  const visiblePlans = allPlans.filter(
    (p) => p.isActive && p.displayState !== PlanDisplayState.NUMBER_2 && (p.priceMonthly ?? 0) > 0,
  );

  const reloadBilling = () => {
    void qc.invalidateQueries({ queryKey: getGetApiAdminBillingQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetApiAdminBillingPaymentsQueryKey() });
  };
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // ---- Plan picker + reference code + quote ----
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [referenceCode, setReferenceCode] = useState('');
  const [quote, setQuote] = useState<BillingQuoteResponse | null>(null);

  const quoteMut = usePostApiAdminBillingQuote({
    mutation: {
      onSuccess: (res) => setQuote(res as unknown as BillingQuoteResponse),
      onError: (e) => {
        setQuote(null);
        onError(e);
      },
    },
  });

  function selectPlan(planId: number) {
    setSelectedPlanId(planId);
    setQuote(null);
    // DB-20 §11: quote is called on an explicit code Apply AND on plan change, never per keystroke.
    quoteMut.mutate({ data: { planId, referenceCode: referenceCode.trim() || undefined } });
  }

  function applyCode() {
    if (selectedPlanId == null) return;
    quoteMut.mutate({ data: { planId: selectedPlanId, referenceCode: referenceCode.trim() || undefined } });
  }

  const requestMut = usePostApiAdminBillingRequest({
    mutation: {
      onSuccess: () => {
        toast(t('billing.requestSent'));
        setSelectedPlanId(null);
        setReferenceCode('');
        setQuote(null);
        reloadBilling();
      },
      onError,
    },
  });

  function requestPlan() {
    if (selectedPlanId == null) return;
    requestMut.mutate({
      data: { planId: selectedPlanId, referenceCode: referenceCode.trim() || undefined },
    });
  }

  const cancelMut = useDeleteApiAdminBillingRequest({
    mutation: {
      onSuccess: () => {
        toast(t('billing.requestCancelled'));
        reloadBilling();
      },
      onError,
    },
  });

  // ---- Render ----
  if (isLoading && !summary) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {t('billing.loading')}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-destructive">
        {t('billing.loadError')}
      </div>
    );
  }

  const statusBadge = subscriptionStatusBadge(summary?.status);
  const hasPendingRequest = summary?.requestedPlanId != null;

  const paymentColumns: ColumnDef<WorkspacePaymentResponse>[] = [
    {
      accessorKey: 'plan',
      enableSorting: false,
      header: t('billing.colPlan'),
      meta: { mobile: 'primary' },
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-medium">{row.original.planName ?? '—'}</span>
          <span className="text-[13px] text-muted-foreground">
            {paymentKindLabel(row.original.kind, t)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      enableSorting: false,
      header: t('billing.colAmount'),
      cell: ({ row }) => (
        <span className="font-mono text-[14px]">
          {formatMoney(row.original.amount, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: 'method',
      enableSorting: false,
      header: t('billing.colMethod'),
      cell: ({ row }) => <span>{methodLabel(row.original.method, t)}</span>,
    },
    {
      accessorKey: 'reference',
      enableSorting: false,
      header: t('billing.colReference'),
      cell: ({ row }) => (
        <span className="font-mono text-[13px] text-muted-foreground">
          {row.original.reference ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'paidAt',
      enableSorting: false,
      header: t('billing.colPaidAt'),
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">{formatDate(row.original.paidAt)}</span>
      ),
    },
    {
      accessorKey: 'period',
      enableSorting: false,
      header: t('billing.colPeriod'),
      cell: ({ row }) =>
        row.original.periodStart || row.original.periodEnd ? (
          <span className="text-[13px] text-muted-foreground">
            {formatDate(row.original.periodStart)} – {formatDate(row.original.periodEnd)}
          </span>
        ) : (
          <span className="text-[13px] text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
          {t('billing.title')}
        </h1>
      </div>

      {/* Current plan/status card */}
      <Card className="p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-semibold">{summary?.planName ?? t('billing.freePlan')}</span>
          <Badge variant={statusBadge.variant}>{t(statusBadge.key)}</Badge>
          {summary?.isComplimentary && (
            <Badge variant="success" hideGlyph>
              {t('billing.complimentary')}
              {summary?.compEndsAt ? ` · ${t('billing.until', { date: formatDate(summary.compEndsAt) })}` : ''}
            </Badge>
          )}
        </div>

        {summary?.currentPeriodEnd && (
          <p className="text-[13px] text-muted-foreground">
            {t('billing.periodEnds', { date: formatDate(summary.currentPeriodEnd) })}
          </p>
        )}

        {summary?.status === 'PastDue' && summary?.graceEndsAt && (
          <div className="flex items-start gap-2 rounded-md border border-state-danger/30 bg-state-danger-tint p-3 text-[13px] text-state-danger">
            <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t('billing.gracePeriodWarning', { date: formatDate(summary.graceEndsAt) })}</span>
          </div>
        )}

        {hasPendingRequest && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-gutter p-3">
            <div className="text-[13px]">
              <span className="font-medium">{t('billing.pendingRequest', { plan: summary?.requestedPlanName ?? '' })}</span>
              {summary?.quotedPrice != null && (
                <span className="text-muted-foreground ms-2">
                  {formatMoney(summary.quotedPrice, summary.quotedCurrency)}
                </span>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
            >
              {t('billing.cancelRequest')}
            </Button>
          </div>
        )}

        {summary?.renewalPrice != null && !hasPendingRequest && !summary?.isComplimentary && (
          <p className="text-[13px] text-muted-foreground">
            {t('billing.renewalQuote', { price: formatMoney(summary.renewalPrice, summary.renewalCurrency) })}
          </p>
        )}
      </Card>

      {/* Choose a plan */}
      {!summary?.isComplimentary && (
        <Card className="p-4 flex flex-col gap-4">
          <div>
            <h2 className="text-[15px] font-semibold">{t('billing.choosePlan')}</h2>
            <p className="text-[13px] text-muted-foreground mt-1">{t('billing.manualPaymentHint')}</p>
          </div>

          {plansError && (
            <p className="text-[13px] text-destructive">{t('billing.plansLoadError')}</p>
          )}

          {visiblePlans.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visiblePlans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => p.id != null && selectPlan(p.id)}
                  className={cn(
                    'rounded-md border p-3 text-start transition-colors',
                    selectedPlanId === p.id
                      ? 'border-brand bg-brand-tint'
                      : 'border-border hover:bg-gutter-strong',
                  )}
                >
                  <div className="text-[14px] font-medium">{p.name}</div>
                  <div className="font-mono text-[13px] text-muted-foreground">
                    {formatMoney(p.priceMonthly, p.currency)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedPlanId != null && (
            <div className="flex flex-col gap-3 border-t border-border-muted pt-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <FormField label={t('billing.referenceCode')} htmlFor="reference-code">
                    <Input
                      id="reference-code"
                      value={referenceCode}
                      onChange={(e) => setReferenceCode(e.target.value)}
                      placeholder={t('billing.referenceCodePlaceholder')}
                    />
                  </FormField>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={quoteMut.isPending}
                  onClick={applyCode}
                >
                  {t('billing.apply')}
                </Button>
              </div>

              {quote && (
                <div className="rounded-md border border-border bg-gutter p-3 text-[13px] flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('billing.quotePrice')}</span>
                    <span className="font-mono">{formatMoney(quote.price, quote.currency)}</span>
                  </div>
                  {(quote.discount ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('billing.quoteDiscount')}
                        {quote.discountCodeLabel ? ` (${quote.discountCodeLabel})` : ''}
                      </span>
                      <span className="font-mono">-{formatMoney(quote.discount, quote.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium">
                    <span>{t('billing.quoteFinal')}</span>
                    <span className="font-mono">{formatMoney(quote.final, quote.currency)}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={requestPlan}
                disabled={requestMut.isPending}
                className="self-start"
              >
                <CreditCard className="h-4 w-4" />
                {t('billing.requestPlan')}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Payment history */}
      <div className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold">{t('billing.paymentHistory')}</h2>
        <DataTable
          data={payments}
          columns={paymentColumns}
          paginated
          gutter
          emptyMessage={t('billing.noPayments')}
          emptyHint={t('billing.noPaymentsHint')}
        />
      </div>
    </div>
  );
}
