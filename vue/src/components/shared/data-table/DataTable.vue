<script setup lang="ts" generic="TData extends RowData">
import type { Component } from 'vue';
import { computed, h, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  FlexRender,
  useTable,
  type Cell,
  type Column,
  type ColumnDef,
  type Header,
  type PaginationState,
  type Row,
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
import RowActionsMenu from '@/components/shared/RowActionsMenu.vue';
import type { RowActionItem } from '@/components/shared/types';
import { MOBILE_QUERY, useMediaQuery } from '@/composables/useMediaQuery';
import { cn } from '@/lib/utils';
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
  /** When provided, every data row becomes clickable (cursor + Enter/Space), calling this with the
   *  row's original data. The trailing actions column (if any) stops the click from bubbling up. */
  rowClick?: (row: TData) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  paginated?: boolean;
  /** When true, adds a gutter column (w-10, 1-based row numbers, mono, muted). */
  gutter?: boolean;
  /** Declared for callers migrating from an icon-based empty state; never rendered —
   *  DESIGN.md bans icon-in-circle empty states, so the ghost-row grammar stays text only. */
  emptyIcon?: Component;
  emptyMessage?: string;
  emptyHint?: string;
  /** While true the empty state is suppressed (initial load in flight). */
  loading?: boolean;
  /** Header label over the trailing actions column (blank when omitted). */
  actionsHeader?: string;
}

const props = defineProps<Props<TData>>();
const { t } = useI18n();

// ── Column defs: gutter (if enabled) + caller's + actions (if enabled) ───
const columns = computed<ColumnDef<typeof dataTableFeatures, TData>[]>(() => {
  const cols: ColumnDef<typeof dataTableFeatures, TData>[] = [];

  // Leading gutter column (row numbers, 1-based) if enabled
  if (props.gutter) {
    cols.push({
      id: '__gutter__',
      enableSorting: false,
      enableGlobalFilter: false,
      header: () => '',
      cell: ({ row }) =>
        h('div', { class: 'w-10 text-end font-mono text-[12px] text-faint-foreground' }, String(row.index + 1)),
    });
  }

  cols.push(...props.columns);

  // Trailing actions column if enabled
  if (props.actions) {
    cols.push({
      id: '__actions__',
      header: () => props.actionsHeader ?? '',
      enableSorting: false,
      enableGlobalFilter: false,
      cell: ({ row }) =>
        // Stops the click from also firing the row's own click handler (rowClick) below.
        h('div', { class: 'flex justify-end', onClick: (e: Event) => e.stopPropagation() }, [
          h(RowActionsMenu, {
            items: props.actions!(row.original),
            ariaLabel: props.actionsAriaLabel ?? 'Actions',
          }),
        ]),
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
  column.id === '__actions__';

function headerClass(header: Header<typeof dataTableFeatures, TData>): string {
  const classes = [];
  // The gutter needs an explicit width or auto table layout hands it slack on narrow tables.
  if (header.column.id === '__gutter__') {
    classes.push('w-10');
  }
  if (isActionsColumn(header.column)) {
    classes.push(props.actionsHeader ? 'text-right' : 'w-12');
  }
  if (header.column.getCanSort()) {
    classes.push('cursor-pointer select-none');
  }
  // A column may claim its own header band (a status column's state tint, say).
  const meta = header.column.columnDef.meta as { headerClass?: string } | undefined;
  if (meta?.headerClass) classes.push(meta.headerClass);
  return classes.filter(Boolean).join(' ');
}

function sortIcon(column: Column<typeof dataTableFeatures, TData>): Component {
  return column.getIsSorted() === 'asc' ? ArrowUp : column.getIsSorted() === 'desc' ? ArrowDown : ArrowUpDown;
}

// ── Mobile card view (< md): each row becomes a card instead of a table
// row. A column opts in to the layout via `meta.mobile`: 'primary' picks the
// card's title (falls back to the first non-gutter/actions column when none
// is marked), 'hide' drops a redundant column (index, ids, duplicated info)
// from the card body entirely. Row actions render as a full-width button
// row at the card's bottom instead of the desktop's trailing kebab menu, so
// no capability is hidden behind an extra tap.
const isMobile = useMediaQuery(MOBILE_QUERY);

type MobileColumnMeta = { mobile?: 'primary' | 'hide'; headerClass?: string };

function mobileMetaOf(column: Column<typeof dataTableFeatures, TData>): MobileColumnMeta {
  return (column.columnDef.meta as MobileColumnMeta | undefined) ?? {};
}

function bodyCells(row: Row<typeof dataTableFeatures, TData>): Cell<typeof dataTableFeatures, TData>[] {
  return row.getAllCells().filter((c) => c.column.id !== '__gutter__' && c.column.id !== '__actions__');
}

function primaryCell(
  row: Row<typeof dataTableFeatures, TData>,
): Cell<typeof dataTableFeatures, TData> | undefined {
  const cells = bodyCells(row);
  return cells.find((c) => mobileMetaOf(c.column).mobile === 'primary') ?? cells[0];
}

// A column with a real accessor (accessorKey/accessorFn) and a genuinely empty
// scalar value is skipped on mobile per the spec ("skip empty"). Id-only
// columns (custom-cell escape hatch — status badges, inline-edit controls,
// toggle buttons) have no reliable scalar to test and always show: hiding one
// would silently remove a capability, which the spec forbids.
function hasAccessor(cell: Cell<typeof dataTableFeatures, TData>): boolean {
  const def = cell.column.columnDef as { accessorKey?: string; accessorFn?: unknown };
  return typeof def.accessorKey === 'string' || typeof def.accessorFn === 'function';
}

function isEmptyValue(cell: Cell<typeof dataTableFeatures, TData>): boolean {
  if (!hasAccessor(cell)) return false;
  try {
    const v = cell.getValue();
    return v === null || v === undefined || v === '';
  } catch {
    return false;
  }
}

function secondaryCells(
  row: Row<typeof dataTableFeatures, TData>,
): Cell<typeof dataTableFeatures, TData>[] {
  const primary = primaryCell(row);
  return bodyCells(row).filter(
    (c) => c !== primary && mobileMetaOf(c.column).mobile !== 'hide' && !isEmptyValue(c),
  );
}

function headerFor(
  cell: Cell<typeof dataTableFeatures, TData>,
): Header<typeof dataTableFeatures, TData> | undefined {
  return table.getHeaderGroups()[0]?.headers.find((h) => h.column.id === cell.column.id);
}

function actionsForRow(row: Row<typeof dataTableFeatures, TData>): RowActionItem[] {
  return props.actions?.(row.original) ?? [];
}

// Same severity → color mapping as RowActionsMenu, for the mobile action row's
// icon-only buttons.
function actionSeverityClass(severity?: RowActionItem['severity']): string {
  switch (severity) {
    case 'danger':
      return 'text-destructive';
    case 'success':
      return 'text-success';
    case 'warning':
      return 'text-warning';
    default:
      return 'text-muted-foreground';
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Global search (§3 grammar: 240px wide, h-8) -->
    <div v-if="searchable" class="relative max-w-sm">
      <Search
        class="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        v-model="globalFilter"
        class="ps-9"
        :placeholder="searchPlaceholder ?? t('common.search')"
      />
    </div>

    <!-- Desktop / tablet: the full table, unchanged. -->
    <template v-if="!isMobile">
    <!-- Empty state (when data.length === 0): three ghost rows with dashed borders -->
    <template v-if="data.length === 0">
      <Card class="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                v-for="header in table.getHeaderGroups()[0]?.headers ?? []"
                :key="header.id"
                :class="headerClass(header)"
              >
                <template v-if="!header.isPlaceholder">
                  <FlexRender :header="header" />
                </template>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <!-- Three ghost rows (dashed borders) per §3 -->
            <TableRow v-for="idx in 3" :key="`ghost-${idx}`" class="border-dashed">
              <TableCell
                v-for="col in columns"
                :key="col.id"
              >
                <!-- Empty message (+ optional hint) in first row, first data column (not gutter/actions) -->
                <template v-if="idx === 0 && col.id !== '__gutter__' && col.id !== '__actions__' && emptyMessage">
                  <div class="flex flex-col gap-1">
                    <span class="text-[14px] text-muted-foreground">{{ emptyMessage }}</span>
                    <span v-if="emptyHint" class="text-[12px] text-muted-foreground">{{ emptyHint }}</span>
                  </div>
                </template>
                <!-- Empty action button at the end of the first row -->
                <template v-if="idx === 0 && col.id === '__actions__'">
                  <div class="flex justify-end">
                    <slot name="empty-action" />
                  </div>
                </template>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </template>

    <!-- Normal table (when data.length > 0) -->
    <template v-else-if="!loading">
      <Card class="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                v-for="header in table.getHeaderGroups()[0]?.headers ?? []"
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
                  <button
                    v-if="header.column.getCanSort()"
                    type="button"
                    class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    <FlexRender :header="header" />
                    <component
                      :is="sortIcon(header.column)"
                      class="h-3.5 w-3.5"
                      :class="
                        header.column.getIsSorted() === false
                          ? 'opacity-40'
                          : ''
                      "
                    />
                  </button>
                  <template v-else>
                    <FlexRender :header="header" />
                  </template>
                </template>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <!-- Data rows -->
            <template v-if="rows.length > 0">
              <TableRow
                v-for="row in rows"
                :key="row.id"
                :class="rowClick ? 'cursor-pointer' : ''"
                :tabindex="rowClick ? 0 : undefined"
                :role="rowClick ? 'button' : undefined"
                @click="rowClick?.(row.original)"
                @keydown.enter="rowClick?.(row.original)"
              >
                <TableCell
                  v-for="cell in row.getAllCells()"
                  :key="cell.id"
                  :class="isActionsColumn(cell.column) ? 'flex justify-end' : ''"
                >
                  <!-- Named scoped slot per column key (`#cell-<id>`), falling back
                       to the column def's own TanStack cell template. -->
                  <slot :name="`cell-${cell.column.id}`" :row="row.original" :cell="cell">
                    <FlexRender :cell="cell" />
                  </slot>
                </TableCell>
              </TableRow>
            </template>
            <!-- No search match: rows exist, the filter just found none of them — a single
                 row at normal height, start-aligned, distinct from the three-ghost-row
                 true-empty state above (that means "nothing here yet"; this means "try a
                 different search"). -->
            <TableRow v-else class="h-11">
              <TableCell :colspan="columns.length" class="px-3">
                <div class="flex items-center gap-2 text-[14px] text-muted-foreground">
                  <span>{{ t('table.noResultsFor', { query: globalFilter }) }}</span>
                  <span class="text-faint-foreground" aria-hidden="true">·</span>
                  <Button
                    type="button"
                    variant="link"
                    class="h-auto p-0 text-[14px]"
                    @click="globalFilter = ''"
                  >
                    {{ t('table.clearSearch') }}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <!-- Pagination footer (§3 grammar: h-11, border-t, flex justify-between) -->
        <div
          v-if="paginated && pageCount > 1"
          class="h-11 border-t border-border bg-background px-3 flex items-center justify-between text-[13px] text-muted-foreground"
        >
          <span>
            {{ t('table.rowsOf', { shown: rows.length, total: table.getFilteredRowModel().rows.length }) }}
          </span>
          <div class="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              :aria-label="t('table.previousPage')"
              :disabled="!table.getCanPreviousPage()"
              @click="table.previousPage()"
            >
              <ChevronLeft class="h-4 w-4 rtl:-scale-x-100" />
            </Button>
            <span>
              {{ t('table.pageOf', { page: pageIndex + 1, pages: pageCount }) }}
            </span>
            <Button
              variant="secondary"
              size="sm"
              :aria-label="t('table.nextPage')"
              :disabled="!table.getCanNextPage()"
              @click="table.nextPage()"
            >
              <ChevronRight class="h-4 w-4 rtl:-scale-x-100" />
            </Button>
          </div>
        </div>
      </Card>
    </template>

    <!-- Loading skeleton (when loading: true) -->
    <template v-else>
      <Card class="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                v-for="header in table.getHeaderGroups()[0]?.headers ?? []"
                :key="header.id"
                :class="headerClass(header)"
              >
                <template v-if="!header.isPlaceholder">
                  <FlexRender :header="header" />
                </template>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <!-- Skeleton rows (h-11 with animated bg-gutter bar) -->
            <TableRow v-for="idx in 5" :key="`skeleton-${idx}`">
              <TableCell v-for="col in columns" :key="col.id">
                <div class="h-3 w-[40%] rounded bg-gutter animate-pulse" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </template>
    </template>

    <!-- Mobile (< md): one card per row. Header hidden, sorting disabled — the
         card grammar replaces both. -->
    <template v-else>
      <!-- Empty state -->
      <div
        v-if="data.length === 0"
        class="rounded-md border border-dashed border-border-muted p-4 flex flex-col gap-2"
      >
        <div v-if="emptyMessage" class="flex flex-col gap-1">
          <span class="text-[14px] text-muted-foreground">{{ emptyMessage }}</span>
          <span v-if="emptyHint" class="text-[12px] text-muted-foreground">{{ emptyHint }}</span>
        </div>
        <slot name="empty-action" />
      </div>

      <!-- Loading skeleton -->
      <div v-else-if="loading" class="flex flex-col gap-3">
        <div
          v-for="idx in 3"
          :key="`m-skeleton-${idx}`"
          class="rounded-md border border-border p-3 flex flex-col gap-2"
        >
          <div class="h-3 w-2/3 rounded bg-gutter animate-pulse" />
          <div class="h-3 w-1/2 rounded bg-gutter animate-pulse" />
        </div>
      </div>

      <!-- Cards -->
      <template v-else>
        <div v-if="rows.length === 0" class="rounded-md border border-border px-3 py-4 text-[14px] text-muted-foreground">
          <div class="flex flex-col gap-2">
            <span>{{ t('table.noResultsFor', { query: globalFilter }) }}</span>
            <Button type="button" variant="link" class="h-auto self-start p-0 text-[14px]" @click="globalFilter = ''">
              {{ t('table.clearSearch') }}
            </Button>
          </div>
        </div>

        <div v-else class="flex flex-col gap-3">
          <div
            v-for="row in rows"
            :key="row.id"
            :class="
              cn(
                'rounded-md border border-border bg-background overflow-hidden',
                rowClick ? 'cursor-pointer' : '',
              )
            "
            :role="rowClick ? 'button' : undefined"
            :tabindex="rowClick ? 0 : undefined"
            @click="rowClick?.(row.original)"
            @keydown.enter="rowClick?.(row.original)"
          >
            <div class="p-3 flex flex-col gap-2 min-w-0">
              <!-- Card title: the column marked meta.mobile = 'primary' (first
                   non-gutter/actions column otherwise), full text, wraps. -->
              <div class="text-[14px] font-medium leading-5 break-words min-w-0">
                <slot
                  :name="`cell-${primaryCell(row)?.column.id}`"
                  :row="row.original"
                  :cell="primaryCell(row)"
                >
                  <FlexRender v-if="primaryCell(row)" :cell="primaryCell(row)!" />
                </slot>
              </div>

              <!-- Remaining columns: compact label/value list. Empty scalar
                   values and columns marked meta.mobile = 'hide' are skipped. -->
              <dl
                v-if="secondaryCells(row).length > 0"
                class="grid grid-cols-[minmax(0,38%)_minmax(0,62%)] gap-x-3 gap-y-1.5"
              >
                <template v-for="cell in secondaryCells(row)" :key="cell.id">
                  <dt class="text-[12px] text-muted-foreground pt-0.5 min-w-0 break-words">
                    <FlexRender v-if="headerFor(cell)" :header="headerFor(cell)!" />
                  </dt>
                  <dd class="text-[13px] text-foreground min-w-0 break-words">
                    <slot :name="`cell-${cell.column.id}`" :row="row.original" :cell="cell">
                      <FlexRender :cell="cell" />
                    </slot>
                  </dd>
                </template>
              </dl>
            </div>

            <!-- Row actions: one full-width, min-h-11 row at the card bottom
                 instead of the desktop trailing kebab menu, so every action
                 stays directly reachable. -->
            <div
              v-if="actions && actionsForRow(row).length > 0"
              class="flex border-t border-border-muted"
              @click="(e: Event) => e.stopPropagation()"
            >
              <button
                v-for="(item, idx) in actionsForRow(row)"
                :key="idx"
                type="button"
                :disabled="item.disabled"
                :title="item.tooltip ?? item.label"
                :aria-label="item.label"
                :class="
                  cn(
                    'flex-1 min-h-11 flex items-center justify-center gap-1.5 text-[13px] font-medium transition-colors',
                    'border-e border-border-muted last:border-e-0 disabled:opacity-50 disabled:cursor-not-allowed',
                    actionSeverityClass(item.severity),
                    !item.disabled && 'hover:bg-gutter',
                  )
                "
                @click="item.onClick()"
              >
                <component :is="item.icon" v-if="item.icon" class="h-4 w-4 shrink-0" />
                <span class="truncate">{{ item.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Compact pager: prev / "n of m" / next -->
        <div
          v-if="paginated && pageCount > 1"
          class="min-h-11 flex items-center justify-center gap-3 text-[13px] text-muted-foreground"
        >
          <Button
            variant="secondary"
            size="sm"
            class="h-10 min-w-10"
            :aria-label="t('table.previousPage')"
            :disabled="!table.getCanPreviousPage()"
            @click="table.previousPage()"
          >
            <ChevronLeft class="h-4 w-4 rtl:-scale-x-100" />
          </Button>
          <span>{{ t('table.pageOf', { page: pageIndex + 1, pages: pageCount }) }}</span>
          <Button
            variant="secondary"
            size="sm"
            class="h-10 min-w-10"
            :aria-label="t('table.nextPage')"
            :disabled="!table.getCanNextPage()"
            @click="table.nextPage()"
          >
            <ChevronRight class="h-4 w-4 rtl:-scale-x-100" />
          </Button>
        </div>
      </template>
    </template>
  </div>
</template>
