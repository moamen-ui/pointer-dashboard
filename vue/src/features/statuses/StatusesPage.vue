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
import { Save, RotateCcw, EllipsisVertical, Tag } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import EmptyState from '@/shared/EmptyState.vue';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

    <!-- Empty state (not while loading) -->
    <EmptyState
      v-else-if="rows.length === 0 && !statusesQuery.isLoading.value"
      :icon="Tag"
      :message="t('statuses.empty')"
      :hint="t('statuses.emptyHint')"
    />

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

            <!-- Label — same slim box as the colour control below -->
            <TableCell>
              <div :class="[fieldClass, 'w-[132px]']">
                <input
                  v-model="row.label"
                  :maxlength="64"
                  :class="fieldInputClass"
                  :placeholder="t('statuses.colLabel')"
                  :aria-label="t('statuses.colLabel')"
                />
              </div>
            </TableCell>

            <!-- Color: single merged swatch + hex input -->
            <TableCell>
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
            </TableCell>

            <!-- Order — same slim box as the colour control above -->
            <TableCell>
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
            </TableCell>

            <!-- Actions -->
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon">
                    <span class="sr-only">{{ t('statuses.colActions') }}</span>
                    <EllipsisVertical class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem :disabled="row.saving || row.resetting" @select="saveRow(row)">
                    <Save class="h-4 w-4" />
                    {{ t('statuses.save') }}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="row.isOverridden"
                    :disabled="row.saving || row.resetting"
                    class="text-destructive focus:text-destructive"
                    @select="resetRow(row)"
                  >
                    <RotateCcw class="h-4 w-4" />
                    {{ t('statuses.reset') }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
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
