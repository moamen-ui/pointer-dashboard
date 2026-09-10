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
  /** Renders a small pagination footer under the table. */
  paginated?: boolean;
  /** When true, adds a gutter column (w-10, 1-based row numbers, mono, muted). */
  gutter?: boolean;
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
  gutter = false,
  emptyMessage = '',
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

    return cols;
  }, [columns, actions, actionsAriaLabel, actionsHeader, gutter]);

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
                      className={
                        header.id === '__gutter__'
                          ? 'w-10'
                          : header.id === '__actions__'
                            ? actionsHeader
                              ? 'text-right'
                              : 'w-12'
                            : undefined
                      }
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
                      ) : idx === 0 && emptyMessage && col.id !== '__gutter__' && col.id !== '__actions__' ? (
                        <span className="text-[14px] text-muted-foreground">{emptyMessage}</span>
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
                      className={
                        header.id === '__gutter__'
                          ? 'w-10'
                          : header.id === '__actions__'
                            ? actionsHeader
                              ? 'text-right'
                              : 'w-12'
                            : undefined
                      }
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
              <TableRow>
                <TableCell
                  colSpan={effectiveColumns.length}
                  className="p-4 text-center text-muted-foreground"
                >
                  No matching rows
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="h-11">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.id === '__gutter__' ? 'w-10' : undefined}
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
              {t('table.rowsOf', { shown: rows.length, total: data.length })}
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
      </Card>
    </div>
  );
}
