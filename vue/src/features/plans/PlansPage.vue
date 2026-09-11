<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import type { ColumnDef } from '@tanstack/vue-table';
import {
  useGetApiAdminPlans,
  usePostApiAdminPlans,
  usePatchApiAdminPlansId,
  useDeleteApiAdminPlansId,
  getGetApiAdminPlansQueryKey,
  type PlanWriteDto as ApiPlanWriteDto,
} from '@moamen-ui/pointer-vue';
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge, type BadgeVariants } from '@/components/ui/badge';
import { DataTable, dataTableFeatures } from '@/components/shared/data-table';
import type { RowActionItem } from '@/components/shared/types';
import {
  Dialog,
  DialogContent,

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
import FormField from '@/components/shared/FormField.vue';
import { extractMessage } from '@/lib/error';
import { confirm } from '@/composables/useConfirm';
import { toast } from '@/composables/useToast';

// ─── Types (mirrors react model types; kept local to avoid ts-ignore sprawl) ──

interface PlanEntitlementsDto {
  maxProjects?: number | null;
  maxSeats?: number | null;
  maxCommentsPerMonth?: number | null;
  extensionEnabled?: boolean | null;
  maxExtensionSites?: number | null;
  maxPredefinedActionsPerProject?: number | null;
  maxTenantWidePredefinedActions?: number | null;
  retentionDays?: number | null;
  maxEnvironments?: number | null;
  maxActiveInvites?: number | null;
  emailsPerMonth?: number | null;
  extensionCommentsPerMonth?: number | null;
  maxPendingSuggestions?: number | null;
  exportImportEnabled?: boolean | null;
  promptSuggestionsEnabled?: boolean | null;
  customStatusesEnabled?: boolean | null;
  prioritySupport?: boolean | null;
}

interface PlanAdminResponse {
  id?: number;
  name?: string | null;
  slug?: string | null;
  priceMonthly?: number;
  currency?: string | null;
  interval?: number; // 0=Monthly, 1=Yearly
  sortOrder?: number;
  isActive?: boolean;
  displayState?: number; // 0=Visible, 1=ComingSoon, 2=Hidden
  featureBullets?: string[] | null;
  entitlements?: PlanEntitlementsDto;
  activeSubscriptions?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(plan: PlanAdminResponse): string {
  if (!plan.priceMonthly) return 'Free';
  const interval = plan.interval === 1 ? '/yr' : '/mo';
  return `${plan.priceMonthly} ${plan.currency ?? 'USD'}${interval}`;
}

function displayStateSeverity(state: number | undefined): BadgeVariants['variant'] {
  if (state === 1) return 'neutral';
  if (state === 2) return 'destructive';
  return 'success';
}

function displayStateKey(state: number | undefined): string {
  if (state === 1) return 'plans.displayState.coming-soon';
  if (state === 2) return 'plans.displayState.hidden';
  return 'plans.displayState.visible';
}

function intToStr(v: number | null | undefined): string {
  return v == null ? '' : String(v);
}
function strToInt(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
}

// ─── Form state ───────────────────────────────────────────────────────────────

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

function emptyEntitlements(): PlanEntitlementsDto {
  return {
    maxProjects: null, maxSeats: null, maxCommentsPerMonth: null,
    extensionEnabled: null, maxExtensionSites: null,
    maxPredefinedActionsPerProject: null, maxTenantWidePredefinedActions: null,
    retentionDays: null, maxEnvironments: null, maxActiveInvites: null,
    emailsPerMonth: null, extensionCommentsPerMonth: null,
    maxPendingSuggestions: null, exportImportEnabled: null,
    promptSuggestionsEnabled: null, customStatusesEnabled: null,
    prioritySupport: null,
  };
}

function emptyForm(): PlanFormState {
  return {
    name: '', slug: '', priceMonthly: '', currency: 'USD',
    interval: '0', sortOrder: '0', isActive: true,
    displayState: '0', featureBullets: '',
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

function formToDto(f: PlanFormState): ApiPlanWriteDto {
  return {
    name: f.name.trim(),
    slug: f.slug.trim(),
    priceMonthly: f.priceMonthly === '' ? 0 : Number(f.priceMonthly),
    currency: f.currency.trim(),
    // BillingInterval is 0 | 1 — cast the parsed number.
    interval: Number(f.interval) as 0 | 1,
    sortOrder: Number(f.sortOrder) || 0,
    isActive: f.isActive,
    // PlanDisplayState is 0 | 1 | 2 — cast the parsed number.
    displayState: Number(f.displayState) as 0 | 1 | 2,
    featureBullets: f.featureBullets.split('\n').map((s) => s.trim()).filter(Boolean),
    entitlements: f.entitlements,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

const { t } = useI18n();
const queryClient = useQueryClient();

const { data, isFetching, isError } = useGetApiAdminPlans();
const plans = computed<PlanAdminResponse[]>(
  () => (data.value as unknown as PlanAdminResponse[] | undefined) ?? [],
);

const createPlan = usePostApiAdminPlans();
const updatePlan = usePatchApiAdminPlansId();
const deletePlan = useDeleteApiAdminPlansId();

function reload() {
  void queryClient.invalidateQueries({ queryKey: getGetApiAdminPlansQueryKey() });
}
function fail(e: unknown) {
  toast(extractMessage(e), 'danger');
}

// ── Modal form ────────────────────────────────────────────────────────────────
const modalOpen = ref(false);
const editingPlan = ref<PlanAdminResponse | null>(null);
const form = ref<PlanFormState>(emptyForm());

function openCreate() {
  editingPlan.value = null;
  form.value = emptyForm();
  modalOpen.value = true;
}
function openEdit(plan: PlanAdminResponse) {
  editingPlan.value = plan;
  form.value = planToForm(plan);
  modalOpen.value = true;
}

async function saveForm() {
  if (!form.value.name.trim()) return;
  const dto = formToDto(form.value);
  try {
    if (editingPlan.value?.id != null) {
      await updatePlan.mutateAsync({ id: editingPlan.value.id, data: dto });
      toast(t('plans.updated'), 'success');
    } else {
      await createPlan.mutateAsync({ data: dto });
      toast(t('plans.created'), 'success');
    }
    modalOpen.value = false;
    reload();
  } catch (e) {
    fail(e);
  }
}

const isSaving = computed(
  () => createPlan.isPending.value || updatePlan.isPending.value,
);

// ── Delete ────────────────────────────────────────────────────────────────────
async function doDelete(plan: PlanAdminResponse) {
  const ok = await confirm({
    message: t('plans.deleteConfirm', { name: plan.name ?? String(plan.id) }),
    confirmLabel: t('plans.delete'),
    confirmVariant: 'destructive',
  });
  if (!ok) return;
  try {
    await deletePlan.mutateAsync({ id: plan.id! });
    toast(t('plans.deleted'), 'success');
    reload();
  } catch (e) {
    // On 409 (plan in use) surface the message and keep the plan
    fail(e);
  }
}

// A computed so headers follow live language switches.
const columns = computed<ColumnDef<typeof dataTableFeatures, PlanAdminResponse>[]>(() => [
  { accessorKey: 'name', header: t('plans.colName'), enableSorting: false },
  { accessorKey: 'slug', header: t('plans.colSlug'), enableSorting: false },
  { accessorKey: 'price', header: t('plans.colPrice'), enableSorting: false },
  { accessorKey: 'isActive', header: t('plans.colActive'), enableSorting: false },
  { accessorKey: 'displayState', header: t('plans.colDisplay'), enableSorting: false },
  { accessorKey: 'activeSubscriptions', header: t('plans.colSubs'), enableSorting: false },
]);

function actionsFor(plan: PlanAdminResponse): RowActionItem[] {
  return [
    { label: t('common.rename'), icon: Pencil, onClick: () => openEdit(plan) },
    {
      label: t('plans.delete'),
      icon: Trash2,
      severity: 'danger',
      disabled: deletePlan.isPending.value,
      onClick: () => void doDelete(plan),
    },
  ];
}

// ── Entitlements form helpers (called in template) ────────────────────────────
function setEntInt(key: keyof PlanEntitlementsDto, raw: string) {
  form.value.entitlements = { ...form.value.entitlements, [key]: strToInt(raw) };
}
function setEntBool(key: keyof PlanEntitlementsDto, val: string | null | undefined) {
  const s = val ?? '';
  const v = s === '' ? null : s === 'true';
  form.value.entitlements = { ...form.value.entitlements, [key]: v };
}
function entBoolVal(key: keyof PlanEntitlementsDto): string {
  const v = form.value.entitlements[key] as boolean | null | undefined;
  return v == null ? '' : v ? 'true' : 'false';
}

// reset featureBullets textarea binding helper (textarea needs a separate ref)
const bulletsRef = ref('');
watch(modalOpen, (open) => {
  if (open) bulletsRef.value = form.value.featureBullets;
});
watch(bulletsRef, (v) => {
  form.value.featureBullets = v;
});
</script>

<template>
  <div class="mx-auto w-full max-w-[1120px]">
    <div class="mb-4 flex items-center justify-between gap-4">
      <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
        {{ t('plans.title') }}
        <span v-if="isFetching" class="ms-2 text-[12px] font-normal text-muted-foreground">
          {{ t('common.loading') }}…
        </span>
      </h1>
      <Button @click="openCreate">
        <Plus class="h-4 w-4" />
        {{ t('plans.addPlan') }}
      </Button>
    </div>

    <p v-if="isError" class="text-[14px] text-state-danger">{{ t('plans.loadError') }}</p>

    <DataTable
      v-else
      :data="plans"
      :columns="columns"
      :actions="actionsFor"
      :actions-aria-label="t('tenants.actions')"
      :actions-header="t('tenants.actions')"
      gutter
      paginated
      :loading="isFetching"
      :empty-icon="CreditCard"
      :empty-message="t('plans.empty')"
      :empty-hint="t('plans.emptyHint')"
    >
      <template #cell-name="{ row }">
        <span class="font-medium">{{ row.name }}</span>
      </template>
      <template #cell-slug="{ row }">
        <span class="font-mono text-[13px] text-muted-foreground">{{ row.slug }}</span>
      </template>
      <template #cell-price="{ row }">
        <span class="font-mono text-[14px]">{{ formatPrice(row) }}</span>
      </template>
      <template #cell-isActive="{ row }">
        <Badge :variant="row.isActive ? 'success' : 'destructive'">
          {{ t(row.isActive ? 'common.active' : 'common.disabled') }}
        </Badge>
      </template>
      <template #cell-displayState="{ row }">
        <Badge :variant="displayStateSeverity(row.displayState)">
          {{ t(displayStateKey(row.displayState)) }}
        </Badge>
      </template>
      <template #cell-activeSubscriptions="{ row }">
        <span class="font-mono text-[14px]">{{ row.activeSubscriptions ?? 0 }}</span>
      </template>
    </DataTable>
  </div>

  <!-- Create / Edit dialog -->
  <Dialog v-model:open="modalOpen">
    <DialogContent class="max-h-[90vh] w-[min(520px,calc(100vw-32px))] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="text-[16px] font-semibold leading-6">
          {{ editingPlan ? t('plans.editPlan') : t('plans.addPlan') }}
        </DialogTitle>
      </DialogHeader>
      <div class="space-y-4">
        <!-- Basic fields -->
        <div class="space-y-4">
          <FormField :label="t('plans.colName')" html-for="plan-name">
            <Input id="plan-name" v-model="form.name" />
          </FormField>
          <FormField :label="t('plans.colSlug')" html-for="plan-slug">
            <Input id="plan-slug" v-model="form.slug" />
          </FormField>
          <FormField :label="t('plans.priceMonthly')" html-for="plan-price">
            <Input id="plan-price" v-model="form.priceMonthly" type="number" :min="0" />
          </FormField>
          <FormField :label="t('plans.currency')" html-for="plan-currency">
            <Input id="plan-currency" v-model="form.currency" />
          </FormField>
          <FormField :label="t('plans.interval')" html-for="plan-interval">
            <Select v-model="form.interval">
              <SelectTrigger id="plan-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{{ t('plans.intervalMonthly') }}</SelectItem>
                <SelectItem value="1">{{ t('plans.intervalYearly') }}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField :label="t('plans.sortOrder')" html-for="plan-sort">
            <Input id="plan-sort" v-model="form.sortOrder" type="number" />
          </FormField>
          <FormField :label="t('plans.displayStateLabel')" html-for="plan-display">
            <Select v-model="form.displayState">
              <SelectTrigger id="plan-display">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{{ t('plans.displayState.visible') }}</SelectItem>
                <SelectItem value="1">{{ t('plans.displayState.coming-soon') }}</SelectItem>
                <SelectItem value="2">{{ t('plans.displayState.hidden') }}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <div class="flex items-center gap-3">
            <Switch :model-value="form.isActive" @update:model-value="(v: boolean) => (form.isActive = v)" />
            <Label class="text-[13px] font-medium text-foreground">{{ t('plans.isActive') }}</Label>
          </div>
        </div>

        <!-- Feature bullets -->
        <FormField :label="t('plans.featureBullets')" html-for="plan-bullets">
          <textarea
            id="plan-bullets"
            v-model="bulletsRef"
            rows="4"
            class="flex w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] font-sans resize-none"
            :placeholder="t('plans.bulletsPlaceholder')"
          />
        </FormField>

        <!-- Entitlements -->
        <div>
          <h3 class="text-[13px] font-medium text-foreground mb-3">{{ t('plans.enforcedSection') }}</h3>
          <div class="space-y-3">
            <template v-for="key in ['maxProjects','maxSeats','maxCommentsPerMonth','maxExtensionSites','maxPredefinedActionsPerProject','maxTenantWidePredefinedActions']" :key="key">
              <FormField :label="t(`plans.ent.${key}`)" :html-for="`ent-${key}`">
                <Input
                  :id="`ent-${key}`"
                  type="number"
                  :placeholder="t('plans.entNull')"
                  :value="intToStr((form.entitlements as Record<string, unknown>)[key] as number | null)"
                  @change="(e: Event) => setEntInt(key as keyof PlanEntitlementsDto, (e.target as HTMLInputElement).value)"
                />
              </FormField>
            </template>
            <!-- extensionEnabled bool tri-state -->
            <FormField :label="t('plans.ent.extensionEnabled')" html-for="ent-extensionEnabled">
              <Select
                :model-value="entBoolVal('extensionEnabled')"
                @update:model-value="(v) => setEntBool('extensionEnabled', v as string)"
              >
                <SelectTrigger id="ent-extensionEnabled">
                  <SelectValue :placeholder="t('plans.entNull')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{{ t('plans.entNull') }}</SelectItem>
                  <SelectItem value="true">{{ t('common.yes') }}</SelectItem>
                  <SelectItem value="false">{{ t('common.no') }}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </div>

        <!-- Display-only entitlements -->
        <div>
          <h3 class="text-[13px] font-medium text-foreground mb-3">{{ t('plans.displayOnlySection') }}</h3>
          <div class="space-y-3">
            <template v-for="key in ['retentionDays','maxEnvironments','maxActiveInvites','emailsPerMonth','extensionCommentsPerMonth','maxPendingSuggestions']" :key="key">
              <FormField :label="t(`plans.ent.${key}`)" :html-for="`ent-${key}`">
                <Input
                  :id="`ent-${key}`"
                  type="number"
                  :placeholder="t('plans.entNull')"
                  :value="intToStr((form.entitlements as Record<string, unknown>)[key] as number | null)"
                  @change="(e: Event) => setEntInt(key as keyof PlanEntitlementsDto, (e.target as HTMLInputElement).value)"
                />
              </FormField>
            </template>
            <template v-for="key in ['exportImportEnabled','promptSuggestionsEnabled','customStatusesEnabled','prioritySupport']" :key="key">
              <FormField :label="t(`plans.ent.${key}`)" :html-for="`ent-${key}`">
                <Select
                  :model-value="entBoolVal(key as keyof PlanEntitlementsDto)"
                  @update:model-value="(v) => setEntBool(key as keyof PlanEntitlementsDto, v as string)"
                >
                  <SelectTrigger :id="`ent-${key}`">
                    <SelectValue :placeholder="t('plans.entNull')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{{ t('plans.entNull') }}</SelectItem>
                    <SelectItem value="true">{{ t('common.yes') }}</SelectItem>
                    <SelectItem value="false">{{ t('common.no') }}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </template>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <Button variant="secondary" @click="modalOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="!form.name.trim() || isSaving" @click="saveForm">
          {{ t('common.save') }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
