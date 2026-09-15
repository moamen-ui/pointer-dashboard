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

  // When data is empty, render ghost rows in the table (§3 empty state grammar)
  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {searchable && (
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder ?? t('common.search')}
              className="ps-9"
            />
          </div>
        )}

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
                        (header.column.columnDef.meta as { headerClass?: string } | undefined)?.headerClass,
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

  const rows = table.getRowModel().rows;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <div className="flex flex-col gap-3">
      {searchable && (
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder ?? t('common.search')}
            className="ps-9"
          />
        </div>
      )}

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
                        (header.column.columnDef.meta as { headerClass?: string } | undefined)?.headerClass,
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

        {paginated && pageCount > 1 && (
          <div className="h-11 border-t border-border bg-background px-3 flex items-center justify-between text-[13px] text-muted-foreground">
            <span>
              {t('table.rowsOf', { shown: rows.length, total: table.getFilteredRowModel().rows.length })}
            </span>
            <div className="flex items-center gap-2">
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
        )}

        {manualPagination && manualPagination.totalPages > 1 && (
          <div className="h-11 border-t border-border bg-background px-3 flex items-center justify-between text-[13px] text-muted-foreground">
            <span>
              {manualPagination.totalItems != null
                ? t('table.rowsOf', { shown: rows.length, total: manualPagination.totalItems })
                : null}
            </span>
            <div className="flex items-center gap-2">
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
        )}
      </Card>
    </div>
  );
}
