import { useMemo, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { useTranslation } from 'react-i18next';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import type { RowActionItem } from '@/components/shared/types';
import { useMediaQuery, MOBILE_QUERY } from '@/lib/useMediaQuery';

/** Per-column mobile hint (optional `meta.mobile` on a column def): `'primary'` makes
 *  the column's rendered cell the card's title in the below-`md` stacked-card layout;
 *  `'hide'` drops a column that is redundant on a card (a row-index, an id already
 *  shown elsewhere, duplicated info) from the label/value list. An unmarked column
 *  renders as a compact "label: value" line, the label taken from the column header.
 *  Every action and every other column stays reachable — this only reshapes the
 *  layout, it never drops a capability. Mirrors Angular/Vue's identical column hint. */
export type MobileColumnHint = 'primary' | 'hide';
type ColumnMeta = { headerClass?: string; mobile?: MobileColumnHint };

const SYNTHETIC_IDS = new Set(['__gutter__', '__actions__', '__chevron__']);

function metaOf(col: { columnDef: { meta?: unknown } }): ColumnMeta | undefined {
  return col.columnDef.meta as ColumnMeta | undefined;
}

/** Severity → text color for the mobile action row's plain buttons (mirrors
 *  RowActionsMenu's own severity → class map, kept local since these render as
 *  bordered buttons in a row rather than dropdown menu items). */
const actionSeverityClass: Record<NonNullable<RowActionItem['severity']>, string> = {
  danger: 'text-destructive border-destructive/30 hover:bg-destructive/10',
  success: 'text-success',
  warning: 'text-warning',
  primary: '',
  neutral: '',
};

export type DataTableProps<TData> = {
  data: TData[];
  /**
   * TanStack column defs — a column's native `cell` render fn is the per-column
   * custom-render slot (no separate template mechanism needed).
   */
  columns: ColumnDef<TData>[];
  /** Per-row actions; the callback is fully in charge of permission/feature gating
   *  (return [] to hide the menu for that row). Appended as a trailing column. */
  actions?: (row: TData) => RowActionItem[];
  /** aria-label for each row's kebab trigger — pass the page's translated actions
   *  key (e.g. t('roles.actions')), mirroring angular's actionsColumn.ariaLabel. */
  actionsAriaLabel?: string;
  /** Header label over the trailing actions column (blank when omitted) —
   *  angular's actionsColumn.header equivalent. */
  actionsHeader?: string;
  /** Renders a built-in search input above the table, wired to the global filter. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Renders a small pagination footer under the table (client-side, paginates `data` itself). */
  paginated?: boolean;
  /** Server-paginated alternative to `paginated` — `data` is already just the current page.
   *  Renders the same footer band, driven by the caller's own page state. Mutually exclusive
   *  with `paginated`. */
  manualPagination?: {
    /** 1-based current page. */
    pageNumber: number;
    totalPages: number;
    /** Shown as "`shown` of `total` rows" when provided. */
    totalItems?: number;
    onPageChange: (pageNumber: number) => void;
  };
  /** When true, adds a gutter column (w-10, 1-based row numbers, mono, muted). */
  gutter?: boolean;
  /** Makes every row clickable (e.g. navigate to a detail view); adds a trailing chevron
   *  column when no `actions` are given (mirrors DESIGN.md's "navigable rows" chevron). A
   *  click inside the actions column never triggers this. */
  onRowClick?: (row: TData) => void;
  /** Declared for callers migrating from an icon-based empty state; never rendered —
   *  DESIGN.md bans icon-in-circle empty states, so the ghost-row grammar stays text only. */
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyMessage?: string;
  emptyHint?: string;
  /** Optional action (e.g. an "Add" button) rendered inside the empty state. */
  emptyAction?: ReactNode;
};

/**
 * The shared table shell every list page renders: TanStack Table supplies the
 * state/models only (headless) — the markup comes from the existing ui/ table
 * primitives. Sorting, global search and pagination are wired in as needed based
 * on the props, and an empty `data` array swaps the whole table for an empty state.
 *
 * Below the shared `md` breakpoint (`useMediaQuery('(max-width: 767px)')`) the same
 * `table` instance renders as a stacked list of cards instead: no header row, no
 * sort, a compact pager, and each column collapses into a label/value line except
 * the column hinted `meta.mobile: 'primary'` (the card title) and any hinted
 * `'hide'`. This keeps every page's column defs as the single source of truth —
 * a page only adds an optional `meta.mobile` hint, it never forks markup.
 */
export function DataTable<TData>({
  data,
  columns,
  actions,
  actionsAriaLabel,
  actionsHeader,
  searchable = false,
  searchPlaceholder,
  paginated = false,
  manualPagination,
  gutter = false,
  onRowClick,
  emptyMessage = '',
  emptyHint = '',
  emptyAction,
}: DataTableProps<TData>) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const isMobile = useMediaQuery(MOBILE_QUERY);

  // Leading gutter column (row numbers, 1-based) if enabled.
  // Trailing synthetic actions column — right-aligned, never sortable.
  const effectiveColumns = useMemo<ColumnDef<TData>[]>(() => {
    const cols: ColumnDef<TData>[] = [];

    if (gutter) {
      cols.push({
        id: '__gutter__',
        enableSorting: false,
        enableGlobalFilter: false,
        header: () => '',
        cell: ({ row }) => (
          <div className="w-10 text-end font-mono text-[12px] text-faint-foreground">
            {row.index + 1}
          </div>
        ),
      });
    }

    cols.push(...columns);

    if (actions) {
      cols.push({
        id: '__actions__',
        enableSorting: false,
        enableGlobalFilter: false,
        header: () => actionsHeader ?? '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActionsMenu
              items={actions(row.original)}
              ariaLabel={actionsAriaLabel}
            />
          </div>
        ),
      });
    }

    // A trailing chevron marks navigable rows when there is no actions column to
    // anchor the end of the row otherwise (DESIGN.md "Data Table" spec).
    if (onRowClick && !actions) {
      cols.push({
        id: '__chevron__',
        enableSorting: false,
        enableGlobalFilter: false,
        header: () => '',
        cell: () => (
          <div className="flex justify-end">
            <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
          </div>
        ),
      });
    }

    return cols;
  }, [columns, actions, actionsAriaLabel, actionsHeader, gutter, onRowClick]);

  const table = useReactTable({
    data,
    columns: effectiveColumns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginated ? { getPaginationRowModel: getPaginationRowModel<TData>() } : {}),
    initialState: { pagination: { pageSize: 10 } },
  });

  const searchBox = searchable && (
    <div className="relative w-full max-w-sm max-md:max-w-full">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder={searchPlaceholder ?? t('common.search')}
        className="ps-9"
      />
    </div>
  );

  const rows = table.getRowModel().rows;
  const pageCount = Math.max(table.getPageCount(), 1);

  // Compact pager shared by both mobile and desktop: below `md` the "shown of
  // total" row count hides, leaving just prev/next + "page of pages" (DESIGN.md
  // target: "pager compact: prev/next + n of m"). Buttons pick up the shared
  // >=40px mobile touch target from the Button component itself.
  function Pager() {
    if (paginated && pageCount > 1) {
      return (
        <div className="h-11 max-md:h-auto max-md:min-h-11 max-md:py-1 border-t border-border bg-background px-3 flex items-center justify-between text-[13px] text-muted-foreground">
          <span className="max-md:hidden">
            {t('table.rowsOf', { shown: rows.length, total: table.getFilteredRowModel().rows.length })}
          </span>
          <div className="flex items-center gap-2 max-md:w-full max-md:justify-between">
            <Button
              variant="secondary"
              size="sm"
              aria-label={t('table.previousPage')}
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </Button>
            <span>
              {t('table.pageOf', { page: table.getState().pagination.pageIndex + 1, pages: pageCount })}
            </span>
            <Button
              variant="secondary"
              size="sm"
              aria-label={t('table.nextPage')}
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      );
    }
    if (manualPagination && manualPagination.totalPages > 1) {
      return (
        <div className="h-11 max-md:h-auto max-md:min-h-11 max-md:py-1 border-t border-border bg-background px-3 flex items-center justify-between text-[13px] text-muted-foreground">
          <span className="max-md:hidden">
            {manualPagination.totalItems != null
              ? t('table.rowsOf', { shown: rows.length, total: manualPagination.totalItems })
              : null}
          </span>
          <div className="flex items-center gap-2 max-md:w-full max-md:justify-between">
            <Button
              variant="secondary"
              size="sm"
              aria-label={t('table.previousPage')}
              onClick={() => manualPagination.onPageChange(manualPagination.pageNumber - 1)}
              disabled={manualPagination.pageNumber <= 1}
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </Button>
            <span>
              {t('table.pageOf', { page: manualPagination.pageNumber, pages: manualPagination.totalPages })}
            </span>
            <Button
              variant="secondary"
              size="sm"
              aria-label={t('table.nextPage')}
              onClick={() => manualPagination.onPageChange(manualPagination.pageNumber + 1)}
              disabled={manualPagination.pageNumber >= manualPagination.totalPages}
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      );
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Mobile: stacked cards (below `md`). Same `table` instance, no header row,
  // sort disabled, one bordered card per row.
  // ---------------------------------------------------------------------
  if (isMobile) {
    if (data.length === 0) {
      return (
        <div className="flex flex-col gap-3">
          {searchBox}
          <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border-muted p-4">
            {emptyMessage && <span className="text-[14px] text-muted-foreground">{emptyMessage}</span>}
            {emptyHint && <span className="text-[12px] text-muted-foreground">{emptyHint}</span>}
            {emptyAction}
          </div>
        </div>
      );
    }

    const headerGroup = table.getHeaderGroups()[0];

    return (
      <div className="flex flex-col gap-3">
        {searchBox}

        {rows.length === 0 ? (
          <div className="flex min-h-11 flex-col items-start gap-1 rounded-md border border-border p-3 text-[14px] text-muted-foreground">
            <span>{t('table.noResultsFor', { query: globalFilter })}</span>
            <Button
              type="button"
              variant="link"
              className="h-auto min-h-0 p-0 text-[14px]"
              onClick={() => setGlobalFilter('')}
            >
              {t('table.clearSearch')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => {
              const cells = row.getVisibleCells().filter((c) => c.column.id !== '__actions__');
              const realCells = cells.filter((c) => !SYNTHETIC_IDS.has(c.column.id));

              const primaryCell =
                realCells.find((c) => metaOf(c.column)?.mobile === 'primary') ?? realCells[0];
              const bodyCells = realCells.filter(
                (c) => c !== primaryCell && metaOf(c.column)?.mobile !== 'hide',
              );

              const items = actions ? actions(row.original) : [];
              const clickable = !!onRowClick;

              return (
                <div
                  key={row.id}
                  className={cn(
                    'flex flex-col gap-2 rounded-md border border-border bg-card p-3',
                    clickable && 'cursor-pointer',
                  )}
                  onClick={clickable ? () => onRowClick!(row.original) : undefined}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick!(row.original);
                          }
                        }
                      : undefined
                  }
                >
                  {primaryCell && (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 break-words text-[14px] font-medium text-foreground">
                        {flexRender(primaryCell.column.columnDef.cell, primaryCell.getContext())}
                      </div>
                      {clickable && !actions && (
                        <ChevronRight
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  )}

                  {bodyCells.length > 0 && (
                    <div className="flex flex-col gap-1 border-t border-border-muted pt-2">
                      {bodyCells.map((cell) => {
                        const header = headerGroup?.headers.find((h) => h.id === cell.column.id);
                        const label = header
                          ? flexRender(header.column.columnDef.header, header.getContext())
                          : null;
                        return (
                          <div
                            key={cell.id}
                            className="flex items-baseline justify-between gap-3 text-[13px]"
                          >
                            {label != null && label !== '' && (
                              <span className="shrink-0 text-muted-foreground">{label}</span>
                            )}
                            <span className="min-w-0 break-words text-end text-foreground">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {items.length > 0 && (
                    <div
                      className="-mx-1 flex flex-wrap gap-1 border-t border-border-muted pt-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {items.map((item) => {
                        const Icon = item.icon;
                        const cls = item.severity ? actionSeverityClass[item.severity] : '';
                        return (
                          <Button
                            key={item.label}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={item.disabled}
                            title={item.disabled ? item.tooltip : undefined}
                            onClick={item.onClick}
                            className={cn('min-h-11 flex-1 basis-[40%]', cls)}
                          >
                            {Icon && <Icon className="h-4 w-4" />}
                            <span className="truncate">{item.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Pager />
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Desktop (`md` and up): unchanged table markup.
  // ---------------------------------------------------------------------

  // When data is empty, render ghost rows in the table (§3 empty state grammar)
  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {searchBox}

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        header.id === '__gutter__'
                          ? 'w-10'
                          : header.id === '__actions__'
                            ? actionsHeader
                              ? 'text-right'
                              : 'w-12'
                            : header.id === '__chevron__'
                              ? 'w-8'
                              : undefined,
                        (header.column.columnDef.meta as ColumnMeta | undefined)?.headerClass,
                      )}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {/* Three ghost rows (dashed borders) */}
              {[0, 1, 2].map((idx) => (
                <TableRow key={`ghost-${idx}`} className="border-dashed">
                  {effectiveColumns.map((col, colIdx) => (
                    <TableCell key={col.id ?? ('accessorKey' in col ? String(col.accessorKey) : colIdx)}>
                      {idx === 0 && col.id === '__actions__' ? (
                        <div className="flex justify-end">
                          {emptyAction}
                        </div>
                      ) : idx === 0 && emptyMessage && col.id !== '__gutter__' && col.id !== '__actions__' && col.id !== '__chevron__' ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[14px] text-muted-foreground">{emptyMessage}</span>
                          {emptyHint && (
                            <span className="text-[12px] text-muted-foreground">{emptyHint}</span>
                          )}
                        </div>
                      ) : null}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {searchBox}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const dir = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        header.id === '__gutter__'
                          ? 'w-10'
                          : header.id === '__actions__'
                            ? actionsHeader
                              ? 'text-right'
                              : 'w-12'
                            : header.id === '__chevron__'
                              ? 'w-8'
                              : undefined,
                        (header.column.columnDef.meta as ColumnMeta | undefined)?.headerClass,
                      )}
                      aria-sort={
                        dir === 'asc'
                          ? 'ascending'
                          : dir === 'desc'
                            ? 'descending'
                            : undefined
                      }
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {dir === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : dir === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              // No search match: rows exist, the filter just found none of them — a single
              // row at normal height, start-aligned, distinct from the three-ghost-row
              // true-empty state above (that means "nothing here yet"; this means "try a
              // different search").
              <TableRow className="h-11">
                <TableCell colSpan={effectiveColumns.length} className="px-3">
                  <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
                    <span>{t('table.noResultsFor', { query: globalFilter })}</span>
                    <span className="text-faint-foreground" aria-hidden="true">·</span>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-[14px]"
                      onClick={() => setGlobalFilter('')}
                    >
                      {t('table.clearSearch')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn('h-11', onRowClick && 'cursor-pointer')}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.id === '__gutter__' ? 'w-10' : undefined}
                      // The actions column has its own interactive controls (menu trigger) —
                      // never let that click bubble up into the row's own onRowClick.
                      onClick={cell.column.id === '__actions__' ? (e) => e.stopPropagation() : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <Pager />
      </Card>
    </div>
  );
}
