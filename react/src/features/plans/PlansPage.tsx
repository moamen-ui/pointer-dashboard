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
import { Plus, Pencil, Trash2 } from 'lucide-react';
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

// ---- Entitlements form subcomponent ----------------------------------------

interface EntitlementsFormProps {
  value: PlanEntitlementsDto;
  onChange: (v: PlanEntitlementsDto) => void;
}

function EntitlementsForm({ value, onChange }: EntitlementsFormProps) {
  const { t } = useTranslation();

  function setInt(key: keyof PlanEntitlementsDto, raw: string) {
    onChange({ ...value, [key]: strToInt(raw) });
  }
  function setBool(key: keyof PlanEntitlementsDto, checked: boolean | null) {
    onChange({ ...value, [key]: checked });
  }

  const intField = (key: keyof PlanEntitlementsDto, labelKey: string) => (
    <div className="flex flex-col gap-1" key={key}>
      <Label htmlFor={`ent-${key}`} className="text-xs">
        {t(labelKey)}
      </Label>
      <Input
        id={`ent-${key}`}
        type="number"
        className="h-8 text-sm"
        placeholder={t('plans.entNull')}
        value={intToStr(value[key] as number | null)}
        onChange={(e) => setInt(key, e.target.value)}
      />
    </div>
  );

  // Tri-state bool: null (unset/default), true, false
  const boolField = (key: keyof PlanEntitlementsDto, labelKey: string) => {
    const raw = value[key] as boolean | null;
    const triVal = raw == null ? '' : raw ? 'true' : 'false';
    return (
      <div className="flex flex-col gap-1" key={key}>
        <Label htmlFor={`ent-${key}`} className="text-xs">
          {t(labelKey)}
        </Label>
        <Select
          value={triVal}
          onValueChange={(v) =>
            setBool(key, v === '' ? null : v === 'true')
          }
        >
          <SelectTrigger id={`ent-${key}`} className="h-8 text-sm">
            <SelectValue placeholder={t('plans.entNull')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('plans.entNull')}</SelectItem>
            <SelectItem value="true">{t('common.yes')}</SelectItem>
            <SelectItem value="false">{t('common.no')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('plans.enforcedSection')}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {intField('maxProjects', 'plans.ent.maxProjects')}
        {intField('maxSeats', 'plans.ent.maxSeats')}
        {intField('maxCommentsPerMonth', 'plans.ent.maxCommentsPerMonth')}
        {boolField('extensionEnabled', 'plans.ent.extensionEnabled')}
        {intField('maxExtensionSites', 'plans.ent.maxExtensionSites')}
        {intField('maxPredefinedActionsPerProject', 'plans.ent.maxPredefinedActionsPerProject')}
        {intField('maxTenantWidePredefinedActions', 'plans.ent.maxTenantWidePredefinedActions')}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('plans.displayOnlySection')}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {intField('retentionDays', 'plans.ent.retentionDays')}
        {intField('maxEnvironments', 'plans.ent.maxEnvironments')}
        {intField('maxActiveInvites', 'plans.ent.maxActiveInvites')}
        {intField('emailsPerMonth', 'plans.ent.emailsPerMonth')}
        {intField('extensionCommentsPerMonth', 'plans.ent.extensionCommentsPerMonth')}
        {intField('maxPendingSuggestions', 'plans.ent.maxPendingSuggestions')}
        {boolField('exportImportEnabled', 'plans.ent.exportImportEnabled')}
        {boolField('promptSuggestionsEnabled', 'plans.ent.promptSuggestionsEnabled')}
        {boolField('customStatusesEnabled', 'plans.ent.customStatusesEnabled')}
        {boolField('prioritySupport', 'plans.ent.prioritySupport')}
      </div>
    </div>
  );
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
    name: f.name.trim() || null,
    slug: f.slug.trim() || null,
    priceMonthly: f.priceMonthly === '' ? 0 : Number(f.priceMonthly),
    currency: f.currency.trim() || null,
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

  const { data, isLoading, isError, isFetching } = useGetApiAdminPlans();
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {t('plans.title')}
          {isFetching && (
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              {t('common.refresh')}…
            </span>
          )}
        </h2>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('plans.addPlan')}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('plans.colName')}</TableHead>
              <TableHead>{t('plans.colSlug')}</TableHead>
              <TableHead>{t('plans.colPrice')}</TableHead>
              <TableHead>{t('plans.colActive')}</TableHead>
              <TableHead>{t('plans.colDisplay')}</TableHead>
              <TableHead>{t('plans.colSubs')}</TableHead>
              <TableHead>{t('tenants.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell className="text-muted-foreground">{plan.slug}</TableCell>
                <TableCell>{formatPrice(plan)}</TableCell>
                <TableCell>
                  <span className={cn('chip', plan.isActive ? 'chip-active' : 'chip-disabled')}>
                    {t(plan.isActive ? 'common.active' : 'common.disabled')}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'chip',
                      plan.displayState === PlanDisplayState.NUMBER_0
                        ? 'chip-active'
                        : plan.displayState === PlanDisplayState.NUMBER_1
                          ? 'chip-neutral'
                          : 'chip-disabled',
                    )}
                  >
                    {t(`plans.displayState.${displayStateBadge(plan.displayState)}`)}
                  </span>
                </TableCell>
                <TableCell>{plan.activeSubscriptions ?? 0}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>
                      <Pencil className="h-4 w-4" />
                      {t('common.rename')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deleteMut.isPending}
                      onClick={() => setDeleteTarget(plan)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('plans.delete')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {t('plans.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? t('plans.editPlan') : t('plans.addPlan')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            {/* Basic fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-name">{t('plans.colName')}</Label>
                <Input
                  id="plan-name"
                  value={form.name}
                  autoFocus
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-slug">{t('plans.colSlug')}</Label>
                <Input
                  id="plan-slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-price">{t('plans.priceMonthly')}</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min={0}
                  value={form.priceMonthly}
                  onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-currency">{t('plans.currency')}</Label>
                <Input
                  id="plan-currency"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-interval">{t('plans.interval')}</Label>
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-sort">{t('plans.sortOrder')}</Label>
                <Input
                  id="plan-sort"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-display">{t('plans.displayStateLabel')}</Label>
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
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="plan-active"
                  className="h-4 w-4"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <Label htmlFor="plan-active">{t('plans.isActive')}</Label>
              </div>
            </div>
            {/* Feature bullets (one per line) */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-bullets">{t('plans.featureBullets')}</Label>
              <textarea
                id="plan-bullets"
                rows={4}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={t('plans.bulletsPlaceholder')}
                value={form.featureBullets}
                onChange={(e) => setForm({ ...form, featureBullets: e.target.value })}
              />
            </div>
            {/* Entitlements */}
            <EntitlementsForm
              value={form.entitlements}
              onChange={(ent) => setForm({ ...form, entitlements: ent })}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
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
