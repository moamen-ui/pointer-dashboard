<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import type { ColumnDef } from '@tanstack/vue-table';
import {
  useGetApiAdminTenants,
  usePostApiAdminTenants,
  usePatchApiAdminTenantsId,
  useDeleteApiAdminTenantsId,
  getGetApiAdminTenantsQueryKey,
  type TenantResponse,
} from '@moamen-ui/pointer-vue';
import {
  usePostApiAdminTenantsIdExtend,
  usePatchApiAdminTenantsIdDemoConfig,
  useGetApiAdminPlans,
  usePatchApiAdminTenantsIdPlan,
} from '@moamen-ui/pointer-vue';
import { Plus, Trash2, CheckCircle2, Ban, ShieldCheck, Clock, Settings2, CreditCard, Building2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Badge, type BadgeVariants } from '@/components/ui/badge';
import { DataTable, dataTableFeatures } from '@/components/shared/data-table';
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
import { extractMessage } from '@/lib/error';
import { confirm } from '@/composables/useConfirm';
import { toast } from '@/composables/useToast';

const { t } = useI18n();
const queryClient = useQueryClient();

const { data, isFetching, isError } = useGetApiAdminTenants();
// The interceptor unwraps the envelope at runtime; data.value IS TenantResponse[].
// Bridge the TS type mismatch with a cast (mirrors the React dashboard pattern).
const tenants = computed<TenantResponse[]>(() => (data.value as unknown as TenantResponse[] | undefined) ?? []);

const createTenant = usePostApiAdminTenants();
const patchTenant = usePatchApiAdminTenantsId();
const deleteTenant = useDeleteApiAdminTenantsId();
const extendTenant = usePostApiAdminTenantsIdExtend();
const patchDemoConfig = usePatchApiAdminTenantsIdDemoConfig();
const changePlanMut = usePatchApiAdminTenantsIdPlan();

// ── Plans list (for change-plan dropdown) ─────────────────────────────────────
interface PlanOption { id: number; name: string; }
const { data: plansData } = useGetApiAdminPlans();
const planOptions = computed<PlanOption[]>(
  () => ((plansData.value as unknown as PlanOption[] | undefined) ?? []).map((p: PlanOption) => ({ id: p.id, name: p.name })),
);

function reload() {
  void queryClient.invalidateQueries({ queryKey: getGetApiAdminTenantsQueryKey() });
}
function fail(e: unknown) {
  toast(extractMessage(e));
}

// ── Create tenant ──────────────────────────────────────────────────────
const addOpen = ref(false);
const newEmail = ref('');
const newPassword = ref('');
const newDisplayName = ref('');

function openAdd() {
  newEmail.value = '';
  newPassword.value = '';
  newDisplayName.value = '';
  addOpen.value = true;
}

async function doCreate() {
  const email = newEmail.value.trim();
  const password = newPassword.value;
  const displayName = newDisplayName.value.trim();
  if (!email || !password || !displayName) return;
  try {
    await createTenant.mutateAsync({ data: { email, password, displayName } });
    addOpen.value = false;
    toast(t('tenants.created'));
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Status actions ────────────────────────────────────────────────────
async function patchStatus(tenant: TenantResponse, action: string) {
  try {
    await patchTenant.mutateAsync({ id: tenant.id!, data: { action } });
    reload();
  } catch (e) {
    fail(e);
  }
}

async function approveTenant(tenant: TenantResponse) {
  await patchStatus(tenant, 'approve');
}

async function enableTenant(tenant: TenantResponse) {
  await patchStatus(tenant, 'enable');
}

async function disableTenant(tenant: TenantResponse) {
  const ok = await confirm({
    message: t('tenants.confirmDisable', { name: tenant.displayName ?? tenant.email }),
    confirmLabel: t('common.disable'),
    confirmVariant: 'destructive',
  });
  if (ok) await patchStatus(tenant, 'disable');
}

// ── Delete ────────────────────────────────────────────────────────────
async function doDelete(tenant: TenantResponse) {
  const ok = await confirm({
    message: t('tenants.confirmDelete', { name: tenant.displayName ?? tenant.email }),
    confirmLabel: t('common.delete'),
    confirmVariant: 'destructive',
  });
  if (!ok) return;
  try {
    await deleteTenant.mutateAsync({ id: tenant.id! });
    toast(t('tenants.deleted'));
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Extend demo ────────────────────────────────────────────────────────
async function doExtend(tenant: TenantResponse) {
  try {
    await extendTenant.mutateAsync({ id: tenant.id! });
    toast(t('tenants.extended'));
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Demo config dialog ────────────────────────────────────────────────
const demoConfigOpen = ref(false);
const demoConfigTenant = ref<TenantResponse | null>(null);
const demoCapInput = ref('');
const demoTtlInput = ref('');

function openDemoConfig(tenant: TenantResponse) {
  demoConfigTenant.value = tenant;
  const cap = (tenant as any).demoCommentCapOverride;
  const ttl = (tenant as any).demoTtlHoursOverride;
  demoCapInput.value = cap != null ? String(cap) : '';
  demoTtlInput.value = ttl != null ? String(ttl) : '';
  demoConfigOpen.value = true;
}

async function saveDemoConfig() {
  if (!demoConfigTenant.value) return;
  try {
    await patchDemoConfig.mutateAsync({
      id: demoConfigTenant.value.id!,
      data: {
        commentCapOverride: demoCapInput.value === '' ? null : Number(demoCapInput.value),
        ttlHoursOverride: demoTtlInput.value === '' ? null : Number(demoTtlInput.value),
      },
    });
    demoConfigOpen.value = false;
    toast(t('tenants.demoConfigSaved'));
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Helper: format ISO expiry ─────────────────────────────────────────
function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// A computed so headers follow live language switches (Angular re-evaluates
// its columns() every pass for the same reason).
const columns = computed<ColumnDef<typeof dataTableFeatures, TenantResponse>[]>(() => [
  { accessorKey: 'displayName', header: t('tenants.displayName'), sortingFn: 'alphanumeric' },
  { accessorKey: 'email', header: t('tenants.email'), sortingFn: 'alphanumeric' },
  { id: 'approvalStatus', header: t('tenants.approvalStatus'), enableSorting: false },
  { id: 'isActive', header: t('tenants.status'), enableSorting: false },
  { accessorKey: 'projects', header: t('tenants.projects') },
  { accessorKey: 'comments', header: t('tenants.comments') },
  { id: 'plan', header: t('tenants.plan'), enableSorting: false },
  { id: 'demoExpiry', header: t('tenants.demoExpiry'), enableSorting: false },
]);

function approvalSeverity(status: string | null | undefined): BadgeVariants['variant'] {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'destructive';
  return 'neutral';
}

// Per-row action menu, conditional logic matching the Angular reference exactly.
function actionsFor(tenant: TenantResponse): RowActionItem[] {
  const items: RowActionItem[] = [];
  if (tenant.approvalStatus !== 'approved') {
    items.push({ label: t('tenants.approve'), icon: ShieldCheck, onClick: () => void approveTenant(tenant) });
  }
  if (tenant.isActive) {
    items.push({ label: t('common.disable'), icon: Ban, severity: 'danger', onClick: () => void disableTenant(tenant) });
  } else {
    items.push({ label: t('common.enable'), icon: CheckCircle2, onClick: () => void enableTenant(tenant) });
  }
  items.push({ label: t('tenants.changePlan'), icon: CreditCard, onClick: () => openChangePlan(tenant) });
  if (tenant.isDemo) {
    items.push({
      label: t('tenants.extend'),
      icon: Clock,
      disabled: !!tenant.demoExtended,
      tooltip: tenant.demoExtended ? t('tenants.extendOnce') : undefined,
      onClick: () => void doExtend(tenant),
    });
    items.push({ label: t('tenants.editDemoConfig'), icon: Settings2, onClick: () => openDemoConfig(tenant) });
  }
  // Delete stays last in every menu (Pointer feedback #137).
  items.push({ label: t('common.delete'), icon: Trash2, severity: 'danger', onClick: () => void doDelete(tenant) });
  return items;
}

// ── Change plan dialog ────────────────────────────────────────────────────────
const changePlanOpen = ref(false);
const changePlanTenant = ref<TenantResponse | null>(null);
const selectedPlanId = ref<string>('');

function openChangePlan(tenant: TenantResponse) {
  changePlanTenant.value = tenant;
  selectedPlanId.value = '';
  changePlanOpen.value = true;
}

async function saveChangePlan() {
  if (!changePlanTenant.value || !selectedPlanId.value) return;
  try {
    await changePlanMut.mutateAsync({
      id: changePlanTenant.value.id!,
      data: { planId: Number(selectedPlanId.value) },
    });
    changePlanOpen.value = false;
    toast(t('tenants.planChanged'));
    reload();
  } catch (e) {
    fail(e);
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-lg font-semibold">{{ t('tenants.title') }}</h2>
      <Button @click="openAdd">
        <Plus class="h-4 w-4" /> {{ t('tenants.addTenant') }}
      </Button>
    </div>

    <p v-if="isError" class="text-sm text-destructive">{{ t('tenants.loadError') }}</p>

    <DataTable
      v-else
      :data="tenants"
      :columns="columns"
      :actions="actionsFor"
      :actions-aria-label="t('tenants.actions')"
      paginated
      :loading="isFetching"
      :empty-icon="Building2"
      :empty-message="t('tenants.empty')"
      :empty-hint="t('tenants.emptyHint')"
    >
      <template #cell-displayName="{ row }">{{ row.displayName ?? '—' }}</template>
      <template #cell-email="{ row }">{{ row.email ?? '—' }}</template>
      <template #cell-approvalStatus="{ row }">
        <Badge :variant="approvalSeverity(row.approvalStatus)">{{ row.approvalStatus ?? '—' }}</Badge>
      </template>
      <template #cell-isActive="{ row }">
        <Badge :variant="row.isActive ? 'success' : 'destructive'">
          {{ t(row.isActive ? 'common.active' : 'common.disabled') }}
        </Badge>
      </template>
      <template #cell-projects="{ row }">{{ row.projects ?? 0 }}</template>
      <template #cell-comments="{ row }">{{ row.comments ?? 0 }}</template>
      <template #cell-plan="{ row }">
        <Badge variant="neutral">{{ row.planName ?? t('tenants.noPlan') }}</Badge>
        <Badge v-if="row.subscriptionStatus" variant="success" class="ms-1 text-[10px]">
          {{ row.subscriptionStatus }}
        </Badge>
      </template>
      <template #cell-demoExpiry="{ row }">
        <template v-if="row.isDemo">{{ formatExpiry(row.expiresAt) }}</template>
        <template v-else>—</template>
      </template>
    </DataTable>
  </div>

  <!-- Create tenant dialog -->
  <Dialog v-model:open="addOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('tenants.addTenant') }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-2">
          <Label for="tenant-email">{{ t('tenants.email') }}</Label>
          <Input id="tenant-email" v-model="newEmail" type="email" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="tenant-name">{{ t('tenants.displayName') }}</Label>
          <Input id="tenant-name" v-model="newDisplayName" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="tenant-password">{{ t('tenants.password') }}</Label>
          <PasswordInput id="tenant-password" v-model="newPassword" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="addOpen = false">{{ t('common.cancel') }}</Button>
        <Button
          :disabled="!newEmail.trim() || !newPassword || !newDisplayName.trim()"
          @click="doCreate"
        >
          <Plus class="h-4 w-4" /> {{ t('tenants.addTenant') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Demo config dialog -->
  <Dialog v-model:open="demoConfigOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('tenants.editDemoConfig') }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-4 pt-2">
        <p class="text-xs text-muted-foreground">{{ t('tenants.demoConfigHint') }}</p>
        <div class="flex flex-col gap-2">
          <Label for="demo-cap-override">{{ t('tenants.commentCapOverride') }}</Label>
          <Input
            id="demo-cap-override"
            v-model="demoCapInput"
            type="number"
            :min="1"
            :placeholder="t('tenants.overridePlaceholder')"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="demo-ttl-override">{{ t('tenants.ttlHoursOverride') }}</Label>
          <Input
            id="demo-ttl-override"
            v-model="demoTtlInput"
            type="number"
            :min="1"
            :placeholder="t('tenants.overridePlaceholder')"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="demoConfigOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="patchDemoConfig.isPending.value" @click="saveDemoConfig">
          {{ t('common.save') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Change plan dialog -->
  <Dialog v-model:open="changePlanOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('tenants.changePlan') }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-4 pt-2">
        <p class="text-sm text-muted-foreground">
          {{ t('tenants.changePlanFor', { name: changePlanTenant?.displayName ?? changePlanTenant?.email }) }}
        </p>
        <div class="flex flex-col gap-2">
          <Label for="change-plan-select">{{ t('tenants.plan') }}</Label>
          <Select v-model="selectedPlanId">
            <SelectTrigger id="change-plan-select">
              <SelectValue :placeholder="t('tenants.selectPlan')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="plan in planOptions" :key="plan.id" :value="String(plan.id)">
                {{ plan.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="changePlanOpen = false">{{ t('common.cancel') }}</Button>
        <Button
          :disabled="!selectedPlanId || changePlanMut.isPending.value"
          @click="saveChangePlan"
        >
          {{ t('common.save') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
