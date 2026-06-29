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
import { Plus, Trash2, CheckCircle2, Ban, ShieldCheck } from 'lucide-vue-next';
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
import { extractMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import { confirm } from '@/composables/useConfirm';
import { toast } from '@/composables/useToast';

const { t } = useI18n();
const queryClient = useQueryClient();

const { data, isFetching, isError } = useGetApiAdminTenants();
const tenants = computed<TenantResponse[]>(() => data.value ?? []);

const createTenant = usePostApiAdminTenants();
const patchTenant = usePatchApiAdminTenantsId();
const deleteTenant = useDeleteApiAdminTenantsId();

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
</template>
