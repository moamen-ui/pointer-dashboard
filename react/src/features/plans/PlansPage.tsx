// Plans admin CRUD page — super-admin only.
// Mirrors the Tenants page conventions: same guards, same table/modal/toast/confirm patterns.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiAdminPlans,
  usePostApiAdminPlans,
  usePatchApiAdminPlansId,
  useDeleteApiAdminPlansId,
  getGetApiAdminPlansQueryKey,
  type PlanAdminResponse,
  type PlanWriteDto,
  type PlanEntitlementsDto,
  BillingInterval,
  PlanDisplayState,
} from '@moamen-ui/pointer-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table/DataTable';
import type { RowActionItem } from '@/components/shared/types';
import { AppTabs } from '@/components/shared/Tabs';
import { TabsContent } from '@/components/ui/tabs';
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

// ---- helpers ----------------------------------------------------------------

function formatPrice(plan: PlanAdminResponse): string {
  if (!plan.priceMonthly) return 'Free';
  const interval = plan.interval === BillingInterval.NUMBER_1 ? '/yr' : '/mo';
  return `${plan.priceMonthly} ${plan.currency ?? 'USD'}${interval}`;
}

function displayStateBadge(state: number | undefined): string {
  if (state === PlanDisplayState.NUMBER_1) return 'coming-soon';
  if (state === PlanDisplayState.NUMBER_2) return 'hidden';
  return 'visible';
}

function displayStateSeverity(state: number | undefined): 'success' | 'neutral' | 'destructive' {
  if (state === PlanDisplayState.NUMBER_1) return 'neutral';
  if (state === PlanDisplayState.NUMBER_2) return 'destructive';
  return 'success';
}

// Blank entitlements form (all null = use platform default)
function emptyEntitlements(): PlanEntitlementsDto {
  return {
    maxProjects: null,
    maxSeats: null,
    maxCommentsPerMonth: null,
    extensionEnabled: null,
    maxExtensionSites: null,
    maxPredefinedActionsPerProject: null,
    maxTenantWidePredefinedActions: null,
    retentionDays: null,
    maxEnvironments: null,
    maxActiveInvites: null,
    emailsPerMonth: null,
    extensionCommentsPerMonth: null,
    maxPendingSuggestions: null,
    exportImportEnabled: null,
    promptSuggestionsEnabled: null,
    customStatusesEnabled: null,
    prioritySupport: null,
  };
}

// Convert nullable int field → string for <input>
function intToStr(v: number | null | undefined): string {
  return v == null ? '' : String(v);
}
// Parse input string → nullable int (empty=null, '-1'=unlimited, numeric=number)
function strToInt(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
}

// ---- blank form state -------------------------------------------------------

interface PlanFormState {
  name: string;
  slug: string;
  priceMonthly: string;
  currency: string;
  interval: string; // '0' | '1'
  sortOrder: string;
  isActive: boolean;
  displayState: string; // '0' | '1' | '2'
  featureBullets: string; // one per line
  entitlements: PlanEntitlementsDto;
}

function emptyForm(): PlanFormState {
  return {
    name: '',
    slug: '',
    priceMonthly: '',
    currency: 'USD',
    interval: '0',
    sortOrder: '0',
    isActive: true,
    displayState: '0',
    featureBullets: '',
    entitlements: emptyEntitlements(),
  };
}

function planToForm(plan: PlanAdminResponse): PlanFormState {
  return {
    name: plan.name ?? '',
    slug: plan.slug ?? '',
    priceMonthly: plan.priceMonthly != null ? String(plan.priceMonthly) : '',
    currency: plan.currency ?? 'USD',
    interval: String(plan.interval ?? 0),
    sortOrder: String(plan.sortOrder ?? 0),
    isActive: plan.isActive ?? true,
    displayState: String(plan.displayState ?? 0),
    featureBullets: (plan.featureBullets ?? []).join('\n'),
    entitlements: plan.entitlements ?? emptyEntitlements(),
  };
}

function formToDto(f: PlanFormState): PlanWriteDto {
  return {
    name: f.name.trim(),
    slug: f.slug.trim(),
    priceMonthly: f.priceMonthly === '' ? 0 : Number(f.priceMonthly),
    currency: f.currency.trim(),
    interval: Number(f.interval) as 0 | 1,
    sortOrder: Number(f.sortOrder) || 0,
    isActive: f.isActive,
    displayState: Number(f.displayState) as 0 | 1 | 2,
    featureBullets: f.featureBullets
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    entitlements: f.entitlements,
  };
}

// ---- Page component ---------------------------------------------------------

export function PlansPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tabValue, setTabValue] = useState('details');

  const { data, isLoading, isError } = useGetApiAdminPlans();
  // The generated hook resolves via the customInstance unwrapper; data may be
  // the inner array directly or still wrapped.
  const plans: PlanAdminResponse[] =
    (data as unknown as { data?: PlanAdminResponse[] })?.data ??
    (Array.isArray(data) ? (data as PlanAdminResponse[]) : []);

  const reload = () =>
    void qc.invalidateQueries({ queryKey: getGetApiAdminPlansQueryKey() });
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // ---- Form modal ----
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanAdminResponse | null>(null);
  const [form, setForm] = useState<PlanFormState>(emptyForm());

  function openCreate() {
    setEditingPlan(null);
    setForm(emptyForm());
    setModalOpen(true);
  }
  function openEdit(plan: PlanAdminResponse) {
    setEditingPlan(plan);
    setForm(planToForm(plan));
    setModalOpen(true);
  }

  const createMut = usePostApiAdminPlans({
    mutation: {
      onSuccess: () => {
        setModalOpen(false);
        toast(t('plans.created'));
        reload();
      },
      onError,
    },
  });

  const updateMut = usePatchApiAdminPlansId({
    mutation: {
      onSuccess: () => {
        setModalOpen(false);
        toast(t('plans.updated'));
        reload();
      },
      onError,
    },
  });

  function saveForm() {
    if (!form.name.trim()) return;
    const dto = formToDto(form);
    if (editingPlan?.id != null) {
      updateMut.mutate({ id: editingPlan.id, data: dto });
    } else {
      createMut.mutate({ data: dto });
    }
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  // ---- Delete ----
  const [deleteTarget, setDeleteTarget] = useState<PlanAdminResponse | null>(null);

  const deleteMut = useDeleteApiAdminPlansId({
    mutation: {
      onSuccess: () => {
        setDeleteTarget(null);
        toast(t('plans.deleted'));
        reload();
      },
      onError: (e) => {
        // On 409 (plan in use) surface the message and keep the plan
        setDeleteTarget(null);
        onError(e);
      },
    },
  });

  function confirmDelete() {
    if (deleteTarget?.id == null) return;
    deleteMut.mutate({ id: deleteTarget.id });
  }

  const columns: ColumnDef<PlanAdminResponse>[] = [
    { accessorKey: 'name', enableSorting: false, header: t('plans.colName'),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'slug', enableSorting: false, header: t('plans.colSlug'),
      cell: ({ row }) => <span className="font-mono text-[13px] text-muted-foreground">{row.original.slug}</span> },
    { accessorKey: 'price', enableSorting: false, header: t('plans.colPrice'),
      cell: ({ row }) => <span className="font-mono text-[14px]">{formatPrice(row.original)}</span> },
    {
      accessorKey: 'isActive',
      enableSorting: false,
      header: t('plans.colActive'),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'destructive'}>
          <span>{t(row.original.isActive ? 'common.active' : 'common.disabled')}</span>
        </Badge>
      ),
    },
    {
      accessorKey: 'displayState',
      enableSorting: false,
      header: t('plans.colDisplay'),
      cell: ({ row }) => (
        <Badge variant={displayStateSeverity(row.original.displayState)}>
          {t(`plans.displayState.${displayStateBadge(row.original.displayState)}`)}
        </Badge>
      ),
    },
    { accessorKey: 'activeSubscriptions', enableSorting: false, header: t('plans.colSubs'),
      cell: ({ row }) => <span className="font-mono text-[14px]">{row.original.activeSubscriptions ?? 0}</span> },
  ];

  const actionsFor = (plan: PlanAdminResponse): RowActionItem[] => [
    { label: t('common.rename'), icon: Pencil, onClick: () => openEdit(plan) },
    { label: t('plans.delete'), icon: Trash2, severity: 'danger', disabled: deleteMut.isPending, onClick: () => setDeleteTarget(plan) },
  ];

  // ---- Render ----
  if (isLoading && !data) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {t('plans.loading')}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-destructive">
        {t('plans.loadError')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
          {t('plans.title')}
        </h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          {t('plans.addPlan')}
        </Button>
      </div>

      <DataTable
        data={plans}
        columns={columns}
        actions={actionsFor}
        actionsAriaLabel={t('tenants.actions')}
        actionsHeader={t('tenants.actions')}
        paginated
        gutter
        emptyIcon={CreditCard}
        emptyMessage={t('plans.empty')}
        emptyHint={t('plans.emptyHint')}
        emptyAction={
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            {t('plans.addPlan')}
          </Button>
        }
      />

      {/* Create / Edit dialog with Tabs: Details / Enforced / Display-only */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? t('plans.editPlan') : t('plans.addPlan')}
            </DialogTitle>
          </DialogHeader>
          <AppTabs
            tabs={[
              { value: 'details', label: t('plans.details') },
              { value: 'enforced', label: t('plans.enforcedSection') },
              { value: 'display', label: t('plans.displayOnlySection') },
            ]}
            value={tabValue}
            onValueChange={setTabValue}
          >
            <TabsContent value="details" className="space-y-4 py-2">
              {/* Basic fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plan-name" className="text-[13px] font-medium text-foreground">
                    {t('plans.colName')}
                  </Label>
                  <Input
                    id="plan-name"
                    value={form.name}
                    autoFocus
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plan-slug" className="text-[13px] font-medium text-foreground">
                    {t('plans.colSlug')}
                  </Label>
                  <Input
                    id="plan-slug"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plan-price" className="text-[13px] font-medium text-foreground">
                    {t('plans.priceMonthly')}
                  </Label>
                  <Input
                    id="plan-price"
                    type="number"
                    min={0}
                    value={form.priceMonthly}
                    onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plan-currency" className="text-[13px] font-medium text-foreground">
                    {t('plans.currency')}
                  </Label>
                  <Input
                    id="plan-currency"
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plan-interval" className="text-[13px] font-medium text-foreground">
                    {t('plans.interval')}
                  </Label>
                  <Select
                    value={form.interval}
                    onValueChange={(v) => setForm({ ...form, interval: v })}
                  >
                    <SelectTrigger id="plan-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t('plans.intervalMonthly')}</SelectItem>
                      <SelectItem value="1">{t('plans.intervalYearly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plan-sort" className="text-[13px] font-medium text-foreground">
                    {t('plans.sortOrder')}
                  </Label>
                  <Input
                    id="plan-sort"
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="plan-display" className="text-[13px] font-medium text-foreground">
                    {t('plans.displayStateLabel')}
                  </Label>
                  <Select
                    value={form.displayState}
                    onValueChange={(v) => setForm({ ...form, displayState: v })}
                  >
                    <SelectTrigger id="plan-display">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t('plans.displayState.visible')}</SelectItem>
                      <SelectItem value="1">{t('plans.displayState.coming-soon')}</SelectItem>
                      <SelectItem value="2">{t('plans.displayState.hidden')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="plan-active"
                  className="h-4 w-4"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <Label htmlFor="plan-active" className="text-[13px] font-medium text-foreground">
                  {t('plans.isActive')}
                </Label>
              </div>
              {/* Feature bullets (one per line) */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-bullets" className="text-[13px] font-medium text-foreground">
                  {t('plans.featureBullets')}
                </Label>
                <textarea
                  id="plan-bullets"
                  rows={4}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={t('plans.bulletsPlaceholder')}
                  value={form.featureBullets}
                  onChange={(e) => setForm({ ...form, featureBullets: e.target.value })}
                />
              </div>
            </TabsContent>
            <TabsContent value="enforced" className="space-y-4 py-2">
              {/* Enforced entitlements only */}
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'maxProjects', label: 'plans.ent.maxProjects' },
                    { key: 'maxSeats', label: 'plans.ent.maxSeats' },
                    { key: 'maxCommentsPerMonth', label: 'plans.ent.maxCommentsPerMonth' },
                    { key: 'extensionEnabled', label: 'plans.ent.extensionEnabled', isBool: true },
                    { key: 'maxExtensionSites', label: 'plans.ent.maxExtensionSites' },
                    { key: 'maxPredefinedActionsPerProject', label: 'plans.ent.maxPredefinedActionsPerProject' },
                    { key: 'maxTenantWidePredefinedActions', label: 'plans.ent.maxTenantWidePredefinedActions' },
                  ].map((field) => {
                    const key = field.key as keyof PlanEntitlementsDto;
                    const isBool = 'isBool' in field && field.isBool;
                    return (
                      <div key={key} className="flex flex-col gap-1.5">
                        <Label htmlFor={`ent-${key}`} className="text-[13px] font-medium text-foreground">
                          {t(field.label)}
                        </Label>
                        {isBool ? (
                          <Select
                            value={form.entitlements[key] == null ? '' : form.entitlements[key] ? 'true' : 'false'}
                            onValueChange={(v) =>
                              setForm({
                                ...form,
                                entitlements: { ...form.entitlements, [key]: v === '' ? null : v === 'true' },
                              })
                            }
                          >
                            <SelectTrigger id={`ent-${key}`}>
                              <SelectValue placeholder={t('plans.entNull')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">{t('plans.entNull')}</SelectItem>
                              <SelectItem value="true">{t('common.yes')}</SelectItem>
                              <SelectItem value="false">{t('common.no')}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={`ent-${key}`}
                            type="number"
                            placeholder={t('plans.entNull')}
                            value={intToStr(form.entitlements[key] as number | null)}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                entitlements: { ...form.entitlements, [key]: strToInt(e.target.value) },
                              })
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[12px] text-muted-foreground">{t('plans.entitlementsHint')}</p>
              </div>
            </TabsContent>
            <TabsContent value="display" className="space-y-4 py-2">
              {/* Display-only entitlements */}
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'retentionDays', label: 'plans.ent.retentionDays' },
                    { key: 'maxEnvironments', label: 'plans.ent.maxEnvironments' },
                    { key: 'maxActiveInvites', label: 'plans.ent.maxActiveInvites' },
                    { key: 'emailsPerMonth', label: 'plans.ent.emailsPerMonth' },
                    { key: 'extensionCommentsPerMonth', label: 'plans.ent.extensionCommentsPerMonth' },
                    { key: 'maxPendingSuggestions', label: 'plans.ent.maxPendingSuggestions' },
                    { key: 'exportImportEnabled', label: 'plans.ent.exportImportEnabled', isBool: true },
                    { key: 'promptSuggestionsEnabled', label: 'plans.ent.promptSuggestionsEnabled', isBool: true },
                    { key: 'customStatusesEnabled', label: 'plans.ent.customStatusesEnabled', isBool: true },
                    { key: 'prioritySupport', label: 'plans.ent.prioritySupport', isBool: true },
                  ].map((field) => {
                    const key = field.key as keyof PlanEntitlementsDto;
                    const isBool = 'isBool' in field && field.isBool;
                    return (
                      <div key={key} className="flex flex-col gap-1.5">
                        <Label htmlFor={`ent-${key}`} className="text-[13px] font-medium text-foreground">
                          {t(field.label)}
                        </Label>
                        {isBool ? (
                          <Select
                            value={form.entitlements[key] == null ? '' : form.entitlements[key] ? 'true' : 'false'}
                            onValueChange={(v) =>
                              setForm({
                                ...form,
                                entitlements: { ...form.entitlements, [key]: v === '' ? null : v === 'true' },
                              })
                            }
                          >
                            <SelectTrigger id={`ent-${key}`}>
                              <SelectValue placeholder={t('plans.entNull')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">{t('plans.entNull')}</SelectItem>
                              <SelectItem value="true">{t('common.yes')}</SelectItem>
                              <SelectItem value="false">{t('common.no')}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={`ent-${key}`}
                            type="number"
                            placeholder={t('plans.entNull')}
                            value={intToStr(form.entitlements[key] as number | null)}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                entitlements: { ...form.entitlements, [key]: strToInt(e.target.value) },
                              })
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[12px] text-muted-foreground">{t('plans.entitlementsHint')}</p>
              </div>
            </TabsContent>
          </AppTabs>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!form.name.trim() || isSaving}
              onClick={saveForm}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        message={t('plans.deleteConfirm', { name: deleteTarget?.name ?? String(deleteTarget?.id) })}
        confirmLabel={t('plans.delete')}
        confirmColor="warn"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
