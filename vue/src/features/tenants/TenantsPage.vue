<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
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
  useGetApiAdminTenantsInvites,
  usePostApiAdminTenantsInvites,
  usePostApiAdminTenantsInvitesIdResend,
  useDeleteApiAdminTenantsInvitesId,
  getGetApiAdminTenantsInvitesQueryKey,
  type TenantInviteResponse,
} from '@moamen-ui/pointer-vue';
import { Plus, Trash2, CheckCircle2, Ban, ShieldCheck, Clock, Settings2, CreditCard, Building2, Mail, Link, ChevronDown, ChevronRight, RotateCcw } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
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
import { isValidEmail } from '@/lib/validation';
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

// ── Invitations (R1.8) ─────────────────────────────────────
const { data: invitesData } = useGetApiAdminTenantsInvites();
const invites = computed<TenantInviteResponse[]>(
  () => (invitesData.value as unknown as TenantInviteResponse[] | undefined) ?? []
);
const createInvite = usePostApiAdminTenantsInvites();
const resendInvite = usePostApiAdminTenantsInvitesIdResend();
const revokeInvite = useDeleteApiAdminTenantsInvitesId();

const newInviteEmail = ref('');
const inviteCreating = ref(false);
const showManualCreate = ref(false);

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
  toast(extractMessage(e), 'danger');
}

// ── Create tenant ──────────────────────────────────────────────────────
const addOpen = ref(false);
const newEmail = ref('');
const newPassword = ref('');
const newDisplayName = ref('');
// Angular-parity validation: errors appear only after a field was touched
// (blurred), like FormControl.invalid && FormControl.touched. The Create
// button was already disabled on any blank/invalid field with no way for the
// user to see why.
const newTouched = reactive({ email: false, password: false, displayName: false });

const newEmailError = computed(() => {
  if (!newTouched.email) return '';
  if (!newEmail.value.trim()) return t('common.fieldRequired');
  if (!isValidEmail(newEmail.value)) return t('common.invalidEmail');
  return '';
});
const newPasswordError = computed(() =>
  newTouched.password && !newPassword.value ? t('common.fieldRequired') : '',
);
const newDisplayNameError = computed(() =>
  newTouched.displayName && !newDisplayName.value.trim() ? t('common.fieldRequired') : '',
);

function openAdd() {
  newEmail.value = '';
  newPassword.value = '';
  newDisplayName.value = '';
  newInviteEmail.value = '';
  inviteCreating.value = false;
  showManualCreate.value = false;
  newTouched.email = false;
  newTouched.password = false;
  newTouched.displayName = false;
  addOpen.value = true;
}

// Invite tenant (send quick-access link)
async function inviteTenant() {
  const email = newInviteEmail.value.trim();
  if (!email) return;

  inviteCreating.value = true;
  try {
    await createInvite.mutateAsync({ data: { email } });
    newInviteEmail.value = '';
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminTenantsInvitesQueryKey() });
    toast(t('tenants.invited'), 'success');
  } catch (e) {
    fail(e);
  } finally {
    inviteCreating.value = false;
  }
}

// Resend/rotate invite
async function doResendInvite(invite: TenantInviteResponse, rotate: boolean) {
  try {
    const result = await resendInvite.mutateAsync({
      id: invite.id!,
      params: { rotate },
    });
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminTenantsInvitesQueryKey() });
    toast(t('tenants.inviteResent'), 'success');
    if (rotate && (result as any).url) {
      copyInviteLink((result as any).url);
    }
  } catch (e) {
    fail(e);
  }
}

// Revoke invite
async function doRevokeInvite(invite: TenantInviteResponse) {
  const ok = await confirm({
    message: t('tenants.revokeConfirm', { email: invite.email }),
    confirmLabel: t('common.revoke'),
    confirmVariant: 'destructive',
  });
  if (!ok) return;
  try {
    await revokeInvite.mutateAsync({ id: invite.id! });
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminTenantsInvitesQueryKey() });
    toast(t('tenants.inviteRevoked'), 'success');
  } catch (e) {
    fail(e);
  }
}

// Copy invite link
function copyInviteLink(url: string | undefined) {
  if (!url) return;
  navigator.clipboard?.writeText(url).then(
    () => toast(t('common.copied'), 'success'),
    () => toast(t('common.copyFailed'), 'danger'),
  );
}

async function doCreate() {
  const email = newEmail.value.trim();
  const password = newPassword.value;
  const displayName = newDisplayName.value.trim();
  if (!email || !password || !displayName) return;
  try {
    await createTenant.mutateAsync({ data: { email, password, displayName } });
    addOpen.value = false;
    toast(t('tenants.created'), 'success');
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
    toast(t('tenants.deleted'), 'success');
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Extend demo ────────────────────────────────────────────────────────
async function doExtend(tenant: TenantResponse) {
  try {
    await extendTenant.mutateAsync({ id: tenant.id! });
    toast(t('tenants.extended'), 'success');
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
    toast(t('tenants.demoConfigSaved'), 'success');
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
// Same columns, order and sortability as React/Angular: identity is one cell (email over
// display name), and no tenant column sorts.
const columns = computed<ColumnDef<typeof dataTableFeatures, TenantResponse>[]>(() => [
  { accessorKey: 'email', header: t('tenants.email'), enableSorting: false, meta: { mobile: 'primary' } },
  { id: 'approvalStatus', header: t('tenants.approval'), enableSorting: false },
  { id: 'isActive', header: t('tenants.statusCol'), enableSorting: false },
  { accessorKey: 'projects', header: t('tenants.projects'), enableSorting: false },
  { accessorKey: 'comments', header: t('tenants.comments'), enableSorting: false },
  { id: 'plan', header: t('tenants.planCol'), enableSorting: false },
  { id: 'demoExpiry', header: t('tenants.demoExpiry'), enableSorting: false },
]);

// The API returns PascalCase ("Approved"), so normalize before comparing.
function approvalSeverity(status: string | null | undefined): BadgeVariants['variant'] {
  switch ((status ?? '').toLowerCase()) {
    case 'approved': return 'success';
    case 'rejected': return 'destructive';
    default: return 'warning';
  }
}

function approvalLabel(status: string | null | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'approved': return t('common.approved');
    case 'rejected': return t('common.rejected');
    case 'pending': return t('common.pending');
    default: return status ?? '—';
  }
}

// Per-row action menu, conditional logic matching the Angular reference exactly.
function actionsFor(tenant: TenantResponse): RowActionItem[] {
  const items: RowActionItem[] = [];
  if ((tenant.approvalStatus ?? '').toLowerCase() !== 'approved') {
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
    toast(t('tenants.planChanged'), 'success');
    reload();
  } catch (e) {
    fail(e);
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-[1120px]">
    <div class="mb-4 flex items-center justify-between gap-4">
      <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">{{ t('tenants.title') }}</h1>
      <Button @click="openAdd">
        <Plus class="h-4 w-4" />
        {{ t('tenants.inviteWorkspace') }}
      </Button>
    </div>

    <p v-if="isError" class="text-[14px] text-state-danger">{{ t('tenants.loadError') }}</p>

    <DataTable
      v-else
      :data="tenants"
      :columns="columns"
      :actions="actionsFor"
      :actions-aria-label="t('tenants.actions')"
      :actions-header="t('tenants.actions')"
      gutter
      paginated
      :loading="isFetching"
      :empty-icon="Building2"
      :empty-message="t('tenants.empty')"
      :empty-hint="t('tenants.emptyHint')"
    >
      <template #cell-email="{ row }">
        <div class="flex flex-col gap-0.5">
          <span class="text-[14px] font-medium">{{ row.email }}</span>
          <span class="text-[13px] text-muted-foreground">{{ row.displayName ?? '—' }}</span>
        </div>
      </template>
      <template #cell-approvalStatus="{ row }">
        <Badge :variant="approvalSeverity(row.approvalStatus)">{{ approvalLabel(row.approvalStatus) }}</Badge>
      </template>
      <template #cell-isActive="{ row }">
        <Badge :variant="row.isActive ? 'success' : 'destructive'">
          {{ t(row.isActive ? 'common.active' : 'common.disabled') }}
        </Badge>
      </template>
      <template #cell-projects="{ row }">
        <span class="font-mono text-[14px]">{{ row.projects ?? 0 }}</span>
      </template>
      <template #cell-comments="{ row }">
        <span class="font-mono text-[14px]">{{ row.comments ?? 0 }}</span>
      </template>
      <template #cell-plan="{ row }">
        <Badge variant="neutral">{{ row.planName ?? t('tenants.noPlan') }}</Badge>
        <Badge v-if="row.subscriptionStatus" variant="success" class="ms-1 text-[10px]">
          {{ row.subscriptionStatus }}
        </Badge>
      </template>
      <template #cell-demoExpiry="{ row }">
        <span class="font-mono text-[13px] text-muted-foreground">
          {{ row.isDemo ? formatExpiry(row.expiresAt) : '—' }}
        </span>
      </template>
    </DataTable>
  </div>

  <!-- Invite workspace dialog -->
  <Dialog v-model:open="addOpen">
    <DialogContent class="w-[min(520px,calc(100vw-32px))]">
      <DialogHeader>
        <DialogTitle class="text-[16px] font-semibold leading-6">{{ t('tenants.inviteWorkspace') }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-6">
        <!-- Quick-access invite section -->
        <div class="flex items-end gap-2">
          <div class="flex-1">
            <FormField :label="t('tenants.emailToInvite')" html-for="tenant-invite-email">
              <Input
                id="tenant-invite-email"
                v-model="newInviteEmail"
                type="email"
                :placeholder="t('tenants.email')"
                @keyup.enter="inviteTenant"
              />
            </FormField>
          </div>
          <Button
            :disabled="!newInviteEmail.trim() || inviteCreating"
            @click="inviteTenant"
            class="mb-[2px]"
          >
            <Mail class="h-4 w-4" />
            {{ t('common.sendInvite') }}
          </Button>
        </div>

        <!-- Pending invites list -->
        <div v-if="invites.length > 0" class="space-y-2 mt-4">
          <div class="text-[13px] font-medium text-foreground">{{ t('tenants.pendingInvites') }}</div>
          <div class="rounded-md border border-border divide-y divide-border">
            <div v-for="inv of invites" :key="inv.id" class="flex items-center justify-between gap-2 p-3 text-[13px]">
              <div class="min-w-0 flex-1">
                <div class="font-medium break-all">{{ inv.email }}</div>
                <div class="text-[12px] text-muted-foreground mt-0.5">
                  {{ t('tenants.invitedOn', { date: formatExpiry(inv.createdAt) }) }}
                </div>
                <!-- R2.5: Show magic link details if available -->
                <div v-if="(inv as any).magicLink" class="text-[12px] text-muted-foreground mt-1">
                  {{ t('invite.linkExpiresAt') }}: {{ formatExpiry((inv as any).linkExpiresAt) }}
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <Button
                  v-if="(inv as any).magicLink"
                  variant="ghost"
                  size="sm"
                  @click="doResendInvite(inv, true)"
                  :title="t('invite.rotateLink')"
                >
                  <RotateCcw class="h-4 w-4" />
                </Button>
                <Button
                  v-if="inv.url"
                  variant="ghost"
                  size="sm"
                  @click="copyInviteLink(inv.url)"
                  :title="t('common.copyLink')"
                >
                  <Link class="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  @click="doResendInvite(inv, false)"
                  :title="t('common.resend')"
                >
                  <Mail class="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-state-danger hover:text-state-danger"
                  @click="doRevokeInvite(inv)"
                  :title="t('common.revoke')"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Manual creation (collapsible) -->
        <div class="border-t border-border pt-4">
          <button
            type="button"
            class="text-[13px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            @click="showManualCreate = !showManualCreate"
          >
            <ChevronDown
              v-if="showManualCreate"
              class="h-3.5 w-3.5"
            />
            <ChevronRight
              v-else
              class="h-3.5 w-3.5"
            />
            {{ t('tenants.manualCreate') }}
          </button>

          <div v-if="showManualCreate" class="mt-4 space-y-4 rounded-md bg-gutter p-4 border border-border">
            <div class="text-[13px] text-muted-foreground mb-2">{{ t('tenants.manualCreateHint') }}</div>
            <FormField :label="t('tenants.email')" html-for="tenant-email" :error="newEmailError">
              <Input id="tenant-email" v-model="newEmail" type="email" @blur="newTouched.email = true" />
            </FormField>
            <FormField :label="t('tenants.displayName')" html-for="tenant-name" :error="newDisplayNameError">
              <Input id="tenant-name" v-model="newDisplayName" @blur="newTouched.displayName = true" />
            </FormField>
            <FormField :label="t('tenants.password')" html-for="tenant-password" :error="newPasswordError">
              <PasswordInput id="tenant-password" v-model="newPassword" @blur="newTouched.password = true" />
            </FormField>
            <div class="flex justify-end pt-2">
              <Button
                variant="secondary"
                :disabled="!newEmail.trim() || !newPassword || !newDisplayName.trim() || createTenant.isPending.value"
                @click="doCreate"
              >
                <Plus class="h-4 w-4" />
                {{ t('tenants.createDirectly') }}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <Button variant="secondary" @click="addOpen = false">{{ t('common.close') }}</Button>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Demo config dialog -->
  <Dialog v-model:open="demoConfigOpen">
    <DialogContent class="w-[min(520px,calc(100vw-32px))]">
      <DialogHeader>
        <DialogTitle class="text-[16px] font-semibold leading-6">{{ t('tenants.editDemoConfig') }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-4">
        <p class="text-[12px] text-muted-foreground max-w-[72ch]">{{ t('tenants.demoConfigHint') }}</p>
        <FormField :label="t('tenants.commentCapOverride')" html-for="demo-cap-override">
          <Input
            id="demo-cap-override"
            v-model="demoCapInput"
            type="number"
            :min="1"
            :placeholder="t('tenants.overridePlaceholder')"
          />
        </FormField>
        <FormField :label="t('tenants.ttlHoursOverride')" html-for="demo-ttl-override">
          <Input
            id="demo-ttl-override"
            v-model="demoTtlInput"
            type="number"
            :min="1"
            :placeholder="t('tenants.overridePlaceholder')"
          />
        </FormField>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <Button variant="secondary" @click="demoConfigOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="patchDemoConfig.isPending.value" @click="saveDemoConfig">
          {{ t('common.save') }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Change plan dialog -->
  <Dialog v-model:open="changePlanOpen">
    <DialogContent class="w-[min(520px,calc(100vw-32px))]">
      <DialogHeader>
        <DialogTitle class="text-[16px] font-semibold leading-6">{{ t('tenants.changePlan') }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-4">
        <p class="text-[14px] text-muted-foreground max-w-[72ch]">
          {{ t('tenants.changePlanFor', { name: changePlanTenant?.displayName ?? changePlanTenant?.email }) }}
        </p>
        <FormField :label="t('tenants.plan')" html-for="change-plan-select">
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
        </FormField>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <Button variant="secondary" @click="changePlanOpen = false">{{ t('common.cancel') }}</Button>
        <Button
          :disabled="!selectedPlanId || changePlanMut.isPending.value"
          @click="saveChangePlan"
        >
          {{ t('common.save') }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
