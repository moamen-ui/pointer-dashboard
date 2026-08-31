<script setup lang="ts" generic="TData extends RowData">
import type { Component } from 'vue';
import { computed, h, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  FlexRender,
  useTable,
  type Column,
  type ColumnDef,
  type Header,
  type PaginationState,
  type RowData,
} from '@tanstack/vue-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-vue-next';
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
import EmptyState from '@/shared/EmptyState.vue';
import RowActionsMenu from '@/components/shared/RowActionsMenu.vue';
import type { RowActionItem } from '@/components/shared/types';
import { dataTableFeatures } from './features';

const PAGE_SIZE = 10;
// Non-paginated tables still run the pagination row model (the shared feature
// set registers it) — one enormous page makes it a no-op pass-through.
const MAX_PAGE_SIZE = 1_000_000;

interface Props<TData extends RowData> {
  data: TData[];
  /** TanStack column defs. Keys double as scoped-slot names: `#cell-<id>`. */
  columns: ColumnDef<typeof dataTableFeatures, TData>[];
  /** Trailing actions column. Permission gating stays inside this callback. */
  actions?: (row: TData) => RowActionItem[];
  actionsAriaLabel?: string;
  searchable?: boolean;
  paginated?: boolean;
  /** lucide icon for the empty state. */
  emptyIcon?: Component;
  emptyMessage?: string;
  emptyHint?: string;
  /** While true the empty state is suppressed (initial load in flight). */
  loading?: boolean;
}

const props = defineProps<Props<TData>>();
const { t } = useI18n();

// ── Column defs: caller's + an internal actions column ─────────────────
const columns = computed<ColumnDef<typeof dataTableFeatures, TData>[]>(() => {
  const cols = [...props.columns];
  if (props.actions) {
    cols.push({
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) =>
        h(RowActionsMenu, {
          items: props.actions!(row.original),
          ariaLabel: props.actionsAriaLabel ?? 'Actions',
        }),
    });
  }
  return cols;
});

// ── Controlled state slices ────────────────────────────────────────────
const globalFilter = ref('');
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });

watch(
  () => props.paginated,
  (paginated) => {
    pagination.value = {
      pageIndex: 0,
      pageSize: paginated ? PAGE_SIZE : MAX_PAGE_SIZE,
    };
  },
  { immediate: true },
);

// Refetches (add/rename/delete) shrink the data — snap back to page 1 rather
// than stranding the user on an out-of-range page.
watch(
  () => props.data,
  () => {
    pagination.value = { ...pagination.value, pageIndex: 0 };
  },
);

const state = computed(() => ({
  globalFilter: globalFilter.value,
  pagination: pagination.value,
}));

function resolve<T>(updater: T | ((old: T) => T), old: T): T {
  return typeof updater === 'function' ? (updater as (old: T) => T)(old) : updater;
}

// ── The table ──────────────────────────────────────────────────────────
// Computed refs (not getters) for every reactive option — the documented
// MaybeRef contract the Vue adapter watches and unwraps.
const table = useTable<typeof dataTableFeatures, TData>({
  features: dataTableFeatures,
  data: computed(() => props.data),
  columns,
  state,
  globalFilterFn: 'includesString',
  onGlobalFilterChange: (updater) => {
    globalFilter.value = resolve(updater, globalFilter.value);
  },
  onPaginationChange: (updater) => {
    pagination.value = resolve(updater, pagination.value);
  },
});

const rows = computed(() => table.getRowModel().rows);
const pageCount = computed(() => table.getPageCount());
const pageIndex = computed(() => table.atoms.pagination.get().pageIndex);

// ── Per-column presentation helpers ───────────────────────────────────
const isActionsColumn = (column: Column<typeof dataTableFeatures, TData>) =>
  column.id === 'actions';

function headerClass(header: Header<typeof dataTableFeatures, TData>): string {
  return [
    isActionsColumn(header.column) ? 'w-12 text-end' : '',
    header.column.getCanSort() ? 'cursor-pointer select-none' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function sortIcon(column: Column<typeof dataTableFeatures, TData>): Component {
  return column.getIsSorted() === 'asc' ? ArrowUp : column.getIsSorted() === 'desc' ? ArrowDown : ArrowUpDown;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Global search -->
    <div v-if="searchable" class="relative max-w-sm">
      <Search
        class="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input v-model="globalFilter" class="ps-8" :placeholder="t('common.search')" />
    </div>

    <Card v-if="rows.length > 0">
      <Table>
        <TableHeader>
          <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <TableHead
              v-for="header in headerGroup.headers"
              :key="header.id"
              :class="headerClass(header)"
              :aria-sort="
                header.column.getIsSorted() === 'asc'
                  ? 'ascending'
                  : header.column.getIsSorted() === 'desc'
                    ? 'descending'
                    : undefined
              "
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              <template v-if="!header.isPlaceholder">
                <FlexRender :header="header" />
                <component
                  :is="sortIcon(header.column)"
                  v-if="header.column.getCanSort()"
                  class="ms-1 inline h-3.5 w-3.5 text-muted-foreground"
                />
              </template>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="row in rows" :key="row.id">
            <TableCell
              v-for="cell in row.getAllCells()"
              :key="cell.id"
              :class="isActionsColumn(cell.column) ? 'text-end' : ''"
            >
              <!-- Named scoped slot per column key (`#cell-<id>`), falling back
                   to the column def's own TanStack cell template. -->
              <slot :name="`cell-${cell.column.id}`" :row="row.original" :cell="cell">
                <FlexRender :cell="cell" />
              </slot>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>

    <!-- Empty states: no data at all vs. a search that matched nothing. -->
    <template v-else-if="!loading">
      <EmptyState
        v-if="data.length === 0"
        :icon="emptyIcon"
        :message="emptyMessage ?? t('common.noResults')"
        :hint="emptyHint"
      >
        <slot />
      </EmptyState>
      <p v-else class="py-8 text-center text-sm text-muted-foreground">
        {{ t('common.noResults') }}
      </p>
    </template>

    <!-- Pagination footer -->
    <div v-if="paginated && rows.length > 0 && pageCount > 1" class="flex items-center justify-end gap-2">
      <span class="text-xs text-muted-foreground">{{ pageIndex + 1 }} / {{ pageCount }}</span>
      <Button
        variant="outline"
        size="icon"
        class="h-8 w-8"
        :disabled="!table.getCanPreviousPage()"
        :aria-label="t('common.previousPage')"
        @click="table.previousPage()"
      >
        <ChevronLeft class="h-4 w-4 rtl:-scale-x-100" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        class="h-8 w-8"
        :disabled="!table.getCanNextPage()"
        :aria-label="t('common.nextPage')"
        @click="table.nextPage()"
      >
        <ChevronRight class="h-4 w-4 rtl:-scale-x-100" />
      </Button>
    </div>
  </div>
</template>
