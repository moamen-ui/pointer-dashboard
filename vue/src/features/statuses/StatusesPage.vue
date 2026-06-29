<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiAdminStatuses,
  usePatchApiAdminStatusesValue,
  useDeleteApiAdminStatusesValue,
  getGetApiStatusesQueryKey,
  getGetApiAdminStatusesQueryKey,
  type StatusAdminItem,
} from '@moamen-ui/pointer-vue';
import { Save, RotateCcw } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { extractMessage } from '@/lib/error';
import { confirm } from '@/composables/useConfirm';
import { toast } from '@/composables/useToast';

const { t } = useI18n();
const queryClient = useQueryClient();

// ── Query ─────────────────────────────────────────────────────────────
const statusesQuery = useGetApiAdminStatuses();

// ── Local edit state (seeded from query; kept separate from query cache) ──
interface EditRow {
  value: number;
  name: string | null | undefined;
  label: string;
  color: string;
  order: number;
  isOverridden: boolean;
  defaultLabel: string | null | undefined;
  defaultColor: string | null | undefined;
  defaultOrder: number;
  saving: boolean;
  resetting: boolean;
}

const rows = ref<EditRow[]>([]);

watch(
  () => statusesQuery.data.value,
  (data) => {
    if (!data) return;
    rows.value = data.map((item: StatusAdminItem) => ({
      value: item.value ?? 0,
      name: item.name,
      label: item.label ?? item.defaultLabel ?? '',
      color: item.color ?? item.defaultColor ?? '#6b7280',
      order: item.order ?? item.defaultOrder ?? 0,
      isOverridden: item.isOverridden ?? false,
      defaultLabel: item.defaultLabel,
      defaultColor: item.defaultColor,
      defaultOrder: item.defaultOrder ?? 0,
      saving: false,
      resetting: false,
    }));
  },
  { immediate: true },
);

// ── Mutations ─────────────────────────────────────────────────────────
const patchMutation = usePatchApiAdminStatusesValue();
const deleteMutation = useDeleteApiAdminStatusesValue();

function invalidateCatalog() {
  void queryClient.invalidateQueries({ queryKey: getGetApiStatusesQueryKey() });
  void queryClient.invalidateQueries({ queryKey: getGetApiAdminStatusesQueryKey() });
}

// ── Save ─────────────────────────────────────────────────────────────
async function saveRow(row: EditRow) {
  row.saving = true;
  try {
    await patchMutation.mutateAsync({
      value: row.value,
      data: { label: row.label, color: row.color, order: row.order },
    });
    toast(t('statuses.savedOk'));
    invalidateCatalog();
  } catch (e) {
    toast(extractMessage(e));
  } finally {
    row.saving = false;
  }
}

// ── Reset ─────────────────────────────────────────────────────────────
async function resetRow(row: EditRow) {
  const ok = await confirm({
    message: t('statuses.confirmReset'),
    confirmLabel: t('statuses.reset'),
    confirmVariant: 'destructive',
  });
  if (!ok) return;
  row.resetting = true;
  try {
    await deleteMutation.mutateAsync({ value: row.value });
    toast(t('statuses.resetOk'));
    invalidateCatalog();
  } catch (e) {
    toast(extractMessage(e));
  } finally {
    row.resetting = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('statuses.title') }}</h2>

    <!-- Loading spinner (only when genuinely no data yet) -->
    <div
      v-if="statusesQuery.isLoading.value && rows.length === 0"
      class="h-0.5 w-full overflow-hidden rounded bg-muted"
    >
      <div class="h-full w-1/3 animate-pulse bg-primary" />
    </div>

    <!-- Error state -->
    <p v-if="statusesQuery.isError.value && rows.length === 0" class="py-6 text-destructive">
      {{ t('statuses.loadError') }}
    </p>

    <!-- Table — kept visible during refetch -->
    <Card v-if="rows.length > 0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ t('statuses.colName') }}</TableHead>
            <TableHead>{{ t('statuses.colLabel') }}</TableHead>
            <TableHead>{{ t('statuses.colColor') }}</TableHead>
            <TableHead>{{ t('statuses.colOrder') }}</TableHead>
            <TableHead>{{ t('statuses.colActions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="row in rows" :key="row.value">
            <!-- Name (read-only) -->
            <TableCell class="font-medium">{{ row.name }}</TableCell>

            <!-- Label -->
            <TableCell>
              <Input
                v-model="row.label"
                class="min-w-[120px]"
                :maxlength="64"
              />
            </TableCell>

            <!-- Color: swatch + hex input -->
            <TableCell>
              <div class="flex items-center gap-2">
                <input
                  v-model="row.color"
                  type="color"
                  class="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
                  :title="row.color"
                />
                <Input
                  v-model="row.color"
                  class="w-[96px] font-mono text-sm"
                  :maxlength="7"
                  placeholder="#000000"
                />
              </div>
            </TableCell>

            <!-- Order -->
            <TableCell>
              <Input
                v-model.number="row.order"
                type="number"
                class="w-[72px]"
                :min="0"
              />
            </TableCell>

            <!-- Actions -->
            <TableCell>
              <div class="flex items-center gap-2">
                <Button
                  size="sm"
                  :disabled="row.saving || row.resetting"
                  @click="saveRow(row)"
                >
                  <Save class="h-4 w-4" />
                  {{ t('statuses.save') }}
                </Button>
                <Button
                  v-if="row.isOverridden"
                  variant="destructive"
                  size="sm"
                  :disabled="row.saving || row.resetting"
                  @click="resetRow(row)"
                >
                  <RotateCcw class="h-4 w-4" />
                  {{ t('statuses.reset') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  </div>
</template>
