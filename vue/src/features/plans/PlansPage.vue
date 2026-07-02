<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiAdminPlans,
  usePostApiAdminPlans,
  usePatchApiAdminPlansId,
  useDeleteApiAdminPlansId,
  getGetApiAdminPlansQueryKey,
  type PlanWriteDto as ApiPlanWriteDto,
} from '@moamen-ui/pointer-vue';
import { Plus, Pencil, Trash2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { extractMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
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

function displayStateClass(state: number | undefined): string {
  if (state === 0) return 'chip-active';
  if (state === 1) return 'chip-neutral';
  return 'chip-disabled';
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
    name: f.name.trim() || null,
    slug: f.slug.trim() || null,
    priceMonthly: f.priceMonthly === '' ? 0 : Number(f.priceMonthly),
    currency: f.currency.trim() || null,
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
  toast(extractMessage(e));
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
      toast(t('plans.updated'));
    } else {
      await createPlan.mutateAsync({ data: dto });
      toast(t('plans.created'));
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
    toast(t('plans.deleted'));
    reload();
  } catch (e) {
    // On 409 (plan in use) surface the message and keep the plan
    fail(e);
  }
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
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-lg font-semibold">
        {{ t('plans.title') }}
        <span v-if="isFetching" class="ms-2 text-xs font-normal text-muted-foreground">
          {{ t('common.loading') }}…
        </span>
      </h2>
      <Button @click="openCreate">
        <Plus class="h-4 w-4" /> {{ t('plans.addPlan') }}
      </Button>
    </div>

    <p v-if="isError" class="text-sm text-destructive">{{ t('plans.loadError') }}</p>

    <Card v-if="plans.length > 0 || isFetching">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ t('plans.colName') }}</TableHead>
            <TableHead>{{ t('plans.colSlug') }}</TableHead>
            <TableHead>{{ t('plans.colPrice') }}</TableHead>
            <TableHead>{{ t('plans.colActive') }}</TableHead>
            <TableHead>{{ t('plans.colDisplay') }}</TableHead>
            <TableHead>{{ t('plans.colSubs') }}</TableHead>
            <TableHead>{{ t('tenants.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="plan in plans" :key="plan.id">
            <TableCell class="font-medium">{{ plan.name }}</TableCell>
            <TableCell class="text-muted-foreground">{{ plan.slug }}</TableCell>
            <TableCell>{{ formatPrice(plan) }}</TableCell>
            <TableCell>
              <span :class="cn('chip', plan.isActive ? 'chip-active' : 'chip-disabled')">
                {{ t(plan.isActive ? 'common.active' : 'common.disabled') }}
              </span>
            </TableCell>
            <TableCell>
              <span :class="cn('chip', displayStateClass(plan.displayState))">
                {{ t(displayStateKey(plan.displayState)) }}
              </span>
            </TableCell>
            <TableCell>{{ plan.activeSubscriptions ?? 0 }}</TableCell>
            <TableCell>
              <div class="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" @click="openEdit(plan)">
                  <Pencil class="h-4 w-4" /> {{ t('common.edit') }}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  :disabled="deletePlan.isPending.value"
                  @click="doDelete(plan)"
                >
                  <Trash2 class="h-4 w-4" /> {{ t('plans.delete') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>

    <p v-if="!isFetching && plans.length === 0 && !isError" class="text-sm text-muted-foreground">
      {{ t('plans.empty') }}
    </p>
  </div>

  <!-- Create / Edit dialog -->
  <Dialog v-model:open="modalOpen">
    <DialogContent class="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ editingPlan ? t('plans.editPlan') : t('plans.addPlan') }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-4 pt-1">
        <!-- Basic fields -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <Label for="plan-name">{{ t('plans.colName') }}</Label>
            <Input id="plan-name" v-model="form.name" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="plan-slug">{{ t('plans.colSlug') }}</Label>
            <Input id="plan-slug" v-model="form.slug" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="plan-price">{{ t('plans.priceMonthly') }}</Label>
            <Input id="plan-price" v-model="form.priceMonthly" type="number" :min="0" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="plan-currency">{{ t('plans.currency') }}</Label>
            <Input id="plan-currency" v-model="form.currency" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="plan-interval">{{ t('plans.interval') }}</Label>
            <Select v-model="form.interval">
              <SelectTrigger id="plan-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{{ t('plans.intervalMonthly') }}</SelectItem>
                <SelectItem value="1">{{ t('plans.intervalYearly') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-2">
            <Label for="plan-sort">{{ t('plans.sortOrder') }}</Label>
            <Input id="plan-sort" v-model="form.sortOrder" type="number" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="plan-display">{{ t('plans.displayStateLabel') }}</Label>
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
          </div>
          <div class="flex items-center gap-2 pt-6">
            <Switch :model-value="form.isActive" @update:model-value="(v: boolean) => (form.isActive = v)" />
            <Label>{{ t('plans.isActive') }}</Label>
          </div>
        </div>

        <!-- Feature bullets -->
        <div class="flex flex-col gap-2">
          <Label for="plan-bullets">{{ t('plans.featureBullets') }}</Label>
          <textarea
            id="plan-bullets"
            v-model="bulletsRef"
            rows="4"
            class="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            :placeholder="t('plans.bulletsPlaceholder')"
          />
        </div>

        <!-- Entitlements -->
        <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {{ t('plans.enforcedSection') }}
        </p>
        <div class="grid grid-cols-2 gap-3">
          <template v-for="key in ['maxProjects','maxSeats','maxCommentsPerMonth','maxExtensionSites','maxPredefinedActionsPerProject','maxTenantWidePredefinedActions']" :key="key">
            <div class="flex flex-col gap-1">
              <Label :for="`ent-${key}`" class="text-xs">{{ t(`plans.ent.${key}`) }}</Label>
              <Input
                :id="`ent-${key}`"
                type="number"
                class="h-8 text-sm"
                :placeholder="t('plans.entNull')"
                :value="intToStr((form.entitlements as Record<string, unknown>)[key] as number | null)"
                @change="(e: Event) => setEntInt(key as keyof PlanEntitlementsDto, (e.target as HTMLInputElement).value)"
              />
            </div>
          </template>
          <!-- extensionEnabled bool tri-state -->
          <div class="flex flex-col gap-1">
            <Label for="ent-extensionEnabled" class="text-xs">{{ t('plans.ent.extensionEnabled') }}</Label>
            <Select
              :model-value="entBoolVal('extensionEnabled')"
              @update:model-value="(v) => setEntBool('extensionEnabled', v as string)"
            >
              <SelectTrigger id="ent-extensionEnabled" class="h-8 text-sm">
                <SelectValue :placeholder="t('plans.entNull')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{{ t('plans.entNull') }}</SelectItem>
                <SelectItem value="true">{{ t('common.yes') }}</SelectItem>
                <SelectItem value="false">{{ t('common.no') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {{ t('plans.displayOnlySection') }}
        </p>
        <div class="grid grid-cols-2 gap-3">
          <template v-for="key in ['retentionDays','maxEnvironments','maxActiveInvites','emailsPerMonth','extensionCommentsPerMonth','maxPendingSuggestions']" :key="key">
            <div class="flex flex-col gap-1">
              <Label :for="`ent-${key}`" class="text-xs">{{ t(`plans.ent.${key}`) }}</Label>
              <Input
                :id="`ent-${key}`"
                type="number"
                class="h-8 text-sm"
                :placeholder="t('plans.entNull')"
                :value="intToStr((form.entitlements as Record<string, unknown>)[key] as number | null)"
                @change="(e: Event) => setEntInt(key as keyof PlanEntitlementsDto, (e.target as HTMLInputElement).value)"
              />
            </div>
          </template>
          <template v-for="key in ['exportImportEnabled','promptSuggestionsEnabled','customStatusesEnabled','prioritySupport']" :key="key">
            <div class="flex flex-col gap-1">
              <Label :for="`ent-${key}`" class="text-xs">{{ t(`plans.ent.${key}`) }}</Label>
              <Select
                :model-value="entBoolVal(key as keyof PlanEntitlementsDto)"
                @update:model-value="(v) => setEntBool(key as keyof PlanEntitlementsDto, v as string)"
              >
                <SelectTrigger :id="`ent-${key}`" class="h-8 text-sm">
                  <SelectValue :placeholder="t('plans.entNull')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{{ t('plans.entNull') }}</SelectItem>
                  <SelectItem value="true">{{ t('common.yes') }}</SelectItem>
                  <SelectItem value="false">{{ t('common.no') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </template>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="modalOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="!form.name.trim() || isSaving" @click="saveForm">
          {{ t('common.save') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
