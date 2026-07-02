<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
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
import { Plus, Trash2, CheckCircle2, Ban, ShieldCheck, Clock, Settings2, CreditCard } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { extractMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
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

// ── Local edit state (seeded via watch, never mutates cache) ──────────
interface EditState {
  email: string;
  displayName: string;
}
const editMap = ref<Record<number, EditState>>({});

watch(
  tenants,
  (list) => {
    const next: Record<number, EditState> = {};
    for (const t of list) {
      const id = t.id!;
      // Preserve any in-flight edits; seed missing entries from fresh data.
      next[id] = editMap.value[id] ?? {
        email: t.email ?? '',
        displayName: t.displayName ?? '',
      };
    }
    editMap.value = next;
  },
  { immediate: true },
);

function approvalChip(status: string | null | undefined) {
  if (!status) return 'chip-neutral';
  if (status === 'approved') return 'chip-active';
  if (status === 'pending') return 'chip-pending';
  return 'chip-disabled';
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

    <Card v-if="tenants.length > 0 || isFetching">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ t('tenants.email') }}</TableHead>
            <TableHead>{{ t('tenants.displayName') }}</TableHead>
            <TableHead>{{ t('tenants.approval') }}</TableHead>
            <TableHead>{{ t('tenants.status') }}</TableHead>
            <TableHead>{{ t('tenants.projects') }}</TableHead>
            <TableHead>{{ t('tenants.comments') }}</TableHead>
            <TableHead>{{ t('tenants.demoExpiry') }}</TableHead>
            <TableHead>{{ t('tenants.plan') }}</TableHead>
            <TableHead>{{ t('tenants.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="tenant in tenants" :key="tenant.id">
            <TableCell class="text-sm">{{ tenant.email }}</TableCell>
            <TableCell class="text-sm">{{ tenant.displayName }}</TableCell>
            <TableCell>
              <span :class="cn('chip', approvalChip(tenant.approvalStatus))">
                {{ tenant.approvalStatus ?? 'pending' }}
              </span>
            </TableCell>
            <TableCell>
              <span :class="cn('chip', tenant.isActive ? 'chip-active' : 'chip-disabled')">
                {{ t(tenant.isActive ? 'common.active' : 'common.disabled') }}
              </span>
            </TableCell>
            <TableCell>{{ tenant.projects ?? 0 }}</TableCell>
            <TableCell>{{ tenant.comments ?? 0 }}</TableCell>
            <!-- Demo expiry column -->
            <TableCell class="text-sm">
              <template v-if="(tenant as any).isDemo">
                {{ formatExpiry((tenant as any).expiresAt) }}
              </template>
              <template v-else>—</template>
            </TableCell>
            <!-- Plan column -->
            <TableCell class="text-sm">
              <div class="flex flex-col gap-0.5">
                <span>{{ (tenant as any).planName ?? t('tenants.freePlan') }}</span>
                <span v-if="(tenant as any).subscriptionStatus" class="chip chip-neutral text-[10px]">
                  {{ (tenant as any).subscriptionStatus }}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex flex-wrap gap-2">
                <Button
                  v-if="tenant.approvalStatus !== 'approved'"
                  variant="default"
                  size="sm"
                  @click="approveTenant(tenant)"
                >
                  <ShieldCheck class="h-4 w-4" /> {{ t('tenants.approve') }}
                </Button>
                <Button
                  v-if="tenant.isActive"
                  variant="destructive"
                  size="sm"
                  @click="disableTenant(tenant)"
                >
                  <Ban class="h-4 w-4" /> {{ t('common.disable') }}
                </Button>
                <Button
                  v-else
                  variant="default"
                  size="sm"
                  @click="enableTenant(tenant)"
                >
                  <CheckCircle2 class="h-4 w-4" /> {{ t('common.enable') }}
                </Button>
                <Button variant="destructive" size="sm" @click="doDelete(tenant)">
                  <Trash2 class="h-4 w-4" /> {{ t('common.delete') }}
                </Button>
                <Button variant="outline" size="sm" @click="openChangePlan(tenant)">
                  <CreditCard class="h-4 w-4" /> {{ t('tenants.changePlan') }}
                </Button>
                <!-- Demo-only actions -->
                <template v-if="(tenant as any).isDemo">
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="(tenant as any).demoExtended"
                    :title="(tenant as any).demoExtended ? t('tenants.extendOnce') : undefined"
                    @click="doExtend(tenant)"
                  >
                    <Clock class="h-4 w-4" /> {{ t('tenants.extend') }}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    @click="openDemoConfig(tenant)"
                  >
                    <Settings2 class="h-4 w-4" /> {{ t('tenants.editDemoConfig') }}
                  </Button>
                </template>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>

    <p v-if="!isFetching && tenants.length === 0 && !isError" class="text-sm text-muted-foreground">
      {{ t('tenants.empty') }}
    </p>
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
          <Input id="tenant-password" v-model="newPassword" type="password" />
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
