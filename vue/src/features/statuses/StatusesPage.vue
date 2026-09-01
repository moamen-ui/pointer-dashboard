<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import type { ColumnDef } from '@tanstack/vue-table';
import {
  useGetApiAdminStatuses,
  usePatchApiAdminStatusesValue,
  useDeleteApiAdminStatusesValue,
  getGetApiStatusesQueryKey,
  getGetApiAdminStatusesQueryKey,
  type StatusAdminItem,
} from '@moamen-ui/pointer-vue';
import { Save, RotateCcw, Tag } from 'lucide-vue-next';
import { DataTable, dataTableFeatures } from '@/components/shared/data-table';
import type { RowActionItem } from '@/components/shared/types';
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

// Every in-table control — label, colour, order — is the same slim box: 36px
// tall, 1px border, 6px radius, 8px inline padding, brand border + ring on
// focus, and a borderless transparent inner input at ~0.8rem. Matches the
// Angular statuses table so the row reads as one set of controls.
const fieldClass =
  'flex h-9 items-center gap-1.5 rounded-[6px] border border-input bg-transparent px-2 shadow-sm focus-within:border-brand focus-within:outline-none focus-within:ring-1 focus-within:ring-ring';
const fieldInputClass =
  'w-full min-w-0 border-none bg-transparent p-0 text-[0.8rem] outline-none placeholder:text-muted-foreground';

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

// A computed so headers follow live language switches.
const columns = computed<ColumnDef<typeof dataTableFeatures, EditRow>[]>(() => [
  { accessorKey: 'name', header: t('statuses.colName'), enableSorting: false },
  { accessorKey: 'label', header: t('statuses.colLabel'), enableSorting: false },
  { accessorKey: 'color', header: t('statuses.colColor'), enableSorting: false },
  { accessorKey: 'order', header: t('statuses.colOrder'), enableSorting: false },
]);

function actionsFor(row: EditRow): RowActionItem[] {
  const items: RowActionItem[] = [
    { label: t('statuses.save'), icon: Save, disabled: row.saving || row.resetting, onClick: () => void saveRow(row) },
  ];
  if (row.isOverridden) {
    items.push({
      label: t('statuses.reset'),
      icon: RotateCcw,
      severity: 'danger',
      disabled: row.saving || row.resetting,
      onClick: () => void resetRow(row),
    });
  }
  return items;
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

    <!-- Table — kept visible during refetch. Every column but "name" is a live
         inline-edit control bound to local per-row state -- the escape hatch
         this page needs instead of DataTable's plain display-only cells. -->
    <DataTable
      :data="rows"
      :columns="columns"
      :actions="actionsFor"
      :actions-aria-label="t('statuses.colActions')"
      :loading="statusesQuery.isLoading.value"
      :empty-icon="Tag"
      :empty-message="t('statuses.empty')"
      :empty-hint="t('statuses.emptyHint')"
    >
      <template #cell-name="{ row }">
        <span class="font-medium">{{ row.name }}</span>
      </template>

      <!-- Label — same slim box as the colour control below -->
      <template #cell-label="{ row }">
        <div :class="[fieldClass, 'w-[132px]']">
          <input
            v-model="row.label"
            :maxlength="64"
            :class="fieldInputClass"
            :placeholder="t('statuses.colLabel')"
            :aria-label="t('statuses.colLabel')"
          />
        </div>
      </template>

      <!-- Color: single merged swatch + hex input -->
      <template #cell-color="{ row }">
        <div :class="[fieldClass, 'w-[124px] ps-1.5']">
          <input
            v-model="row.color"
            type="color"
            class="color-swatch h-6 w-6 flex-shrink-0 cursor-pointer rounded border-none bg-transparent p-0"
            :title="row.color"
            :aria-label="t('statuses.colColor')"
          />
          <input
            v-model="row.color"
            type="text"
            :maxlength="7"
            :class="[fieldInputClass, 'font-mono']"
            placeholder="#rrggbb"
          />
        </div>
      </template>

      <!-- Order — same slim box as the colour control above -->
      <template #cell-order="{ row }">
        <div :class="[fieldClass, 'w-16']">
          <input
            v-model.number="row.order"
            type="number"
            :min="0"
            :class="fieldInputClass"
            placeholder="0"
            :aria-label="t('statuses.colOrder')"
          />
        </div>
      </template>
    </DataTable>
  </div>
</template>

<style scoped>
/* Native colour input: drop the browser's chrome so it reads as a plain
   swatch inside the merged colour control. */
.color-swatch {
  appearance: none;
  -webkit-appearance: none;
}
.color-swatch::-webkit-color-swatch-wrapper { padding: 0; }
.color-swatch::-webkit-color-swatch { border: none; border-radius: 3px; }
.color-swatch::-moz-color-swatch { border: none; border-radius: 3px; }
</style>
