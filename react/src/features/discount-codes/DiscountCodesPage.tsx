// DB-20 (BILL-1) — super-admin "Reference codes" page: percent/fixed discount codes redeemed
// against a workspace's billing quote. List (sortable by usage/newest/code, active filter),
// create/edit (code immutable after create — F-B8/F-B9), and a redemptions drill-down dialog.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useGetApiAdminDiscountCodes,
  usePostApiAdminDiscountCodes,
  usePatchApiAdminDiscountCodesId,
  useGetApiAdminDiscountCodesIdRedemptions,
  useGetApiAdminPlans,
  getGetApiAdminDiscountCodesQueryKey,
  DiscountKind,
  DiscountDuration,
  type DiscountCodeResponse,
  type DiscountRedemptionResponse,
  type PlanAdminResponse,
} from '@moamen-ui/pointer-react';
import { Plus, Pencil, Ticket, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/components/shared/FormField';
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
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';
import { requiredError } from '@/lib/validators';
import { formatMoney, formatDate, formatDateTime, localDateTimeToIso } from '@/lib/format';

// ---- helpers ----------------------------------------------------------------

function valueLabel(code: DiscountCodeResponse): string {
  if (code.kind === 'Percent') return `${code.value ?? 0}%`;
  return formatMoney(code.value, code.currency);
}

function windowLabel(code: DiscountCodeResponse, t: (k: string) => string): string {
  if (!code.validFrom && !code.validUntil) return t('discountCodes.alwaysValid');
  return `${formatDate(code.validFrom)} – ${formatDate(code.validUntil)}`;
}

interface CodeFormState {
  code: string;
  label: string;
  note: string;
  kind: string; // '1' Percent | '2' FixedAmount
  value: string;
  currency: string;
  duration: string; // '1' Once | '2' Forever
  validFrom: string;
  validUntil: string;
  maxRedemptions: string;
  isActive: boolean;
  planIds: number[];
}

function emptyForm(): CodeFormState {
  return {
    code: '',
    label: '',
    note: '',
    kind: '1',
    value: '',
    currency: 'USD',
    duration: '1',
    validFrom: '',
    validUntil: '',
    maxRedemptions: '',
    isActive: true,
    planIds: [],
  };
}

function codeToForm(c: DiscountCodeResponse): CodeFormState {
  return {
    code: c.code ?? '',
    label: c.label ?? '',
    note: c.note ?? '',
    kind: c.kind === 'FixedAmount' ? '2' : '1',
    value: c.value != null ? String(c.value) : '',
    currency: c.currency ?? 'USD',
    duration: c.duration === 'Forever' ? '2' : '1',
    validFrom: c.validFrom ? c.validFrom.slice(0, 16) : '',
    validUntil: c.validUntil ? c.validUntil.slice(0, 16) : '',
    maxRedemptions: c.maxRedemptions != null ? String(c.maxRedemptions) : '',
    isActive: c.isActive ?? true,
    planIds: c.planIds ?? [],
  };
}

export function DiscountCodesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [sort, setSort] = useState<'most_used' | 'newest' | 'code'>('most_used');
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');

  const { data, isLoading, isError } = useGetApiAdminDiscountCodes({
    sort,
    active: activeFilter === 'all' ? undefined : activeFilter === 'true',
  });
  const codes: DiscountCodeResponse[] =
    (data as unknown as { data?: DiscountCodeResponse[] })?.data ??
    (Array.isArray(data) ? (data as DiscountCodeResponse[]) : []);

  const { data: plansRaw } = useGetApiAdminPlans();
  const allPlans: PlanAdminResponse[] =
    (plansRaw as unknown as { data?: PlanAdminResponse[] })?.data ??
    (Array.isArray(plansRaw) ? (plansRaw as PlanAdminResponse[]) : []);

  const reload = () =>
    void qc.invalidateQueries({ queryKey: getGetApiAdminDiscountCodesQueryKey() });
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // ---- Create / edit dialog ----
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCodeResponse | null>(null);
  const [form, setForm] = useState<CodeFormState>(emptyForm());
  const [codeTouched, setCodeTouched] = useState(false);
  const codeErrorMsg = requiredError(form.code, t);

  function openCreate() {
    setEditingCode(null);
    setForm(emptyForm());
    setCodeTouched(false);
    setModalOpen(true);
  }
  function openEdit(code: DiscountCodeResponse) {
    setEditingCode(code);
    setForm(codeToForm(code));
    setCodeTouched(false);
    setModalOpen(true);
  }

  const createMut = usePostApiAdminDiscountCodes({
    mutation: {
      onSuccess: () => {
        setModalOpen(false);
        toast(t('discountCodes.created'));
        reload();
      },
      onError,
    },
  });
  const updateMut = usePatchApiAdminDiscountCodesId({
    mutation: {
      onSuccess: () => {
        setModalOpen(false);
        toast(t('discountCodes.updated'));
        reload();
      },
      onError,
    },
  });

  function togglePlan(planId: number) {
    setForm((f) => ({
      ...f,
      planIds: f.planIds.includes(planId)
        ? f.planIds.filter((id) => id !== planId)
        : [...f.planIds, planId],
    }));
  }

  function saveForm() {
    const isFixed = form.kind === '2';
    const shared = {
      label: form.label.trim() || null,
      note: form.note.trim() || null,
      kind: (Number(form.kind) as unknown) as (typeof DiscountKind)[keyof typeof DiscountKind],
      value: Number(form.value) || 0,
      currency: isFixed ? form.currency.trim().toUpperCase() || null : null,
      duration: (Number(form.duration) as unknown) as (typeof DiscountDuration)[keyof typeof DiscountDuration],
      validFrom: localDateTimeToIso(form.validFrom),
      validUntil: localDateTimeToIso(form.validUntil),
      maxRedemptions: form.maxRedemptions === '' ? null : Number(form.maxRedemptions),
      isActive: form.isActive,
      planIds: form.planIds.length > 0 ? form.planIds : null,
    };
    if (editingCode?.id != null) {
      updateMut.mutate({ id: editingCode.id, data: shared });
    } else {
      if (!form.code.trim()) return;
      createMut.mutate({ data: { code: form.code.trim(), ...shared } });
    }
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  // ---- Redemptions drill-down ----
  const [redemptionsTarget, setRedemptionsTarget] = useState<DiscountCodeResponse | null>(null);
  const { data: redemptionsRaw, isLoading: redemptionsLoading } = useGetApiAdminDiscountCodesIdRedemptions(
    redemptionsTarget?.id ?? 0,
    { query: { enabled: redemptionsTarget?.id != null } },
  );
  const redemptions: DiscountRedemptionResponse[] =
    (redemptionsRaw as unknown as { data?: DiscountRedemptionResponse[] })?.data ??
    (Array.isArray(redemptionsRaw) ? (redemptionsRaw as DiscountRedemptionResponse[]) : []);

  // ---- Columns ----
  const columns: ColumnDef<DiscountCodeResponse>[] = [
    {
      accessorKey: 'code',
      enableSorting: false,
      header: t('discountCodes.colCode'),
      meta: { mobile: 'primary' },
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[14px] font-medium">{row.original.code}</span>
          {row.original.label && (
            <span className="text-[13px] text-muted-foreground">{row.original.label}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'value',
      enableSorting: false,
      header: t('discountCodes.colValue'),
      cell: ({ row }) => <span className="font-mono text-[14px]">{valueLabel(row.original)}</span>,
    },
    {
      accessorKey: 'duration',
      enableSorting: false,
      header: t('discountCodes.colDuration'),
      cell: ({ row }) => (
        <span>
          {row.original.duration === 'Forever'
            ? t('discountCodes.durationForever')
            : t('discountCodes.durationOnce')}
        </span>
      ),
    },
    {
      accessorKey: 'window',
      enableSorting: false,
      header: t('discountCodes.colWindow'),
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">{windowLabel(row.original, t)}</span>
      ),
    },
    {
      accessorKey: 'usage',
      enableSorting: false,
      header: t('discountCodes.colUsage'),
      cell: ({ row }) => (
        <span className="font-mono text-[13px]">
          {t('discountCodes.usageCounts', {
            applied: row.original.appliedCount ?? 0,
            pending: row.original.pendingCount ?? 0,
          })}
          {row.original.maxRedemptions != null ? ` / ${row.original.maxRedemptions}` : ''}
        </span>
      ),
    },
    {
      accessorKey: 'isActive',
      enableSorting: false,
      header: t('discountCodes.colActive'),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'destructive'}>
          {t(row.original.isActive ? 'common.active' : 'common.disabled')}
        </Badge>
      ),
    },
  ];

  const actionsFor = (code: DiscountCodeResponse): RowActionItem[] => [
    { label: t('common.edit'), icon: Pencil, onClick: () => openEdit(code) },
    {
      label: t('discountCodes.viewRedemptions'),
      icon: ListOrdered,
      onClick: () => setRedemptionsTarget(code),
    },
  ];

  // ---- Render ----
  if (isLoading && !data) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {t('discountCodes.loading')}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-destructive">
        {t('discountCodes.loadError')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
          {t('discountCodes.title')}
        </h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          {t('discountCodes.addCode')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="most_used">{t('discountCodes.sortMostUsed')}</SelectItem>
            <SelectItem value="newest">{t('discountCodes.sortNewest')}</SelectItem>
            <SelectItem value="code">{t('discountCodes.sortCode')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as typeof activeFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('discountCodes.filterAll')}</SelectItem>
            <SelectItem value="true">{t('common.active')}</SelectItem>
            <SelectItem value="false">{t('common.disabled')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={codes}
        columns={columns}
        actions={actionsFor}
        actionsAriaLabel={t('tenants.actions')}
        actionsHeader={t('tenants.actions')}
        paginated
        gutter
        emptyIcon={Ticket}
        emptyMessage={t('discountCodes.empty')}
        emptyHint={t('discountCodes.emptyHint')}
        emptyAction={
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            {t('discountCodes.addCode')}
          </Button>
        }
      />

      {/* Create / edit dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCode ? t('discountCodes.editCode') : t('discountCodes.addCode')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormField
              label={t('discountCodes.colCode')}
              htmlFor="code-value"
              hint={editingCode ? t('discountCodes.codeImmutableHint') : undefined}
              error={codeTouched ? codeErrorMsg || undefined : undefined}
            >
              <Input
                id="code-value"
                value={form.code}
                disabled={!!editingCode}
                autoFocus={!editingCode}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                onBlur={() => setCodeTouched(true)}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={t('discountCodes.label')} htmlFor="code-label">
                <Input
                  id="code-label"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </FormField>
              <FormField label={t('discountCodes.kind')} htmlFor="code-kind">
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger id="code-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t('discountCodes.kindPercent')}</SelectItem>
                    <SelectItem value="2">{t('discountCodes.kindFixed')}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t('discountCodes.value')} htmlFor="code-value-amount">
                <Input
                  id="code-value-amount"
                  type="number"
                  min={0}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </FormField>
              {form.kind === '2' && (
                <FormField label={t('discountCodes.currency')} htmlFor="code-currency">
                  <Input
                    id="code-currency"
                    value={form.currency}
                    maxLength={3}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                  />
                </FormField>
              )}
              <FormField label={t('discountCodes.duration')} htmlFor="code-duration">
                <Select value={form.duration} onValueChange={(v) => setForm({ ...form, duration: v })}>
                  <SelectTrigger id="code-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t('discountCodes.durationOnce')}</SelectItem>
                    <SelectItem value="2">{t('discountCodes.durationForever')}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t('discountCodes.maxRedemptions')} htmlFor="code-max">
                <Input
                  id="code-max"
                  type="number"
                  min={1}
                  placeholder={t('discountCodes.unlimited')}
                  value={form.maxRedemptions}
                  onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                />
              </FormField>
              <FormField label={t('discountCodes.validFrom')} htmlFor="code-valid-from">
                <Input
                  id="code-valid-from"
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                />
              </FormField>
              <FormField label={t('discountCodes.validUntil')} htmlFor="code-valid-until">
                <Input
                  id="code-valid-until"
                  type="datetime-local"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                />
              </FormField>
            </div>

            <FormField
              label={t('discountCodes.note')}
              htmlFor="code-note"
              hint={t('discountCodes.noPersonalDataHint')}
            >
              <Textarea
                id="code-note"
                rows={2}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </FormField>

            <div className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
              <Label htmlFor="code-active" className="text-[13px] font-medium">
                {t('discountCodes.isActive')}
              </Label>
              <Switch
                id="code-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
            </div>

            <div>
              <Label className="text-[13px] font-medium">{t('discountCodes.planScope')}</Label>
              <p className="text-[12px] text-muted-foreground mt-0.5 mb-2">
                {t('discountCodes.planScopeHint')}
              </p>
              <div className="rounded-md border border-border divide-y divide-border max-h-[160px] overflow-y-auto">
                {allPlans.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 p-2 text-[13px] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={p.id != null && form.planIds.includes(p.id)}
                      onChange={() => p.id != null && togglePlan(p.id)}
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!form.code.trim() || isSaving} onClick={saveForm}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redemptions drill-down */}
      <Dialog open={!!redemptionsTarget} onOpenChange={(o) => !o && setRedemptionsTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('discountCodes.redemptionsFor', { code: redemptionsTarget?.code ?? '' })}
            </DialogTitle>
          </DialogHeader>
          {redemptionsLoading ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              {t('discountCodes.loading')}
            </div>
          ) : (
            <div className="rounded-md border border-border divide-y divide-border max-h-[420px] overflow-y-auto">
              {redemptions.length === 0 && (
                <p className="p-3 text-[13px] text-muted-foreground">
                  {t('discountCodes.noRedemptions')}
                </p>
              )}
              {redemptions.map((r) => (
                <div key={r.id} className="p-3 flex flex-col gap-1 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.workspaceName}</span>
                    <Badge
                      variant={
                        r.status === 'Applied'
                          ? 'success'
                          : r.status === 'Pending'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {r.status === 'Applied'
                        ? t('discountCodes.redemptionApplied')
                        : r.status === 'Pending'
                          ? t('discountCodes.redemptionPending')
                          : t('discountCodes.redemptionReleased')}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {r.planName} · {formatMoney(r.originalPrice, r.priceCurrency)} →{' '}
                    {formatMoney(r.finalPrice, r.priceCurrency)}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {formatDateTime(r.createdAt)}
                    {r.releaseReason ? ` · ${r.releaseReason}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
