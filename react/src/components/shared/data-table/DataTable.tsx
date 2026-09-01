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
import { EmptyState } from '@/components/EmptyState';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import type { RowActionItem } from '@/components/shared/types';

export interface DataTableProps<TData> {
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
  /** Renders a small pagination footer under the table. */
  paginated?: boolean;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyMessage?: string;
  emptyHint?: string;
  /** Optional action (e.g. an "Add" button) rendered inside the empty state. */
  emptyAction?: ReactNode;
}

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
  paginated = false,
  emptyIcon,
  emptyMessage = '',
  emptyHint,
  emptyAction,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Trailing synthetic actions column — right-aligned, never sortable.
  const effectiveColumns = useMemo<ColumnDef<TData>[]>(() => {
    if (!actions) return columns;
    return [
      ...columns,
      {
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
      },
    ];
  }, [columns, actions, actionsAriaLabel, actionsHeader]);

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

  if (data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon as Parameters<typeof EmptyState>[0]['icon']}
        message={emptyMessage}
        hint={emptyHint}
      >
        {emptyAction}
      </EmptyState>
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
            placeholder="Search"
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
                        header.id === '__actions__'
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
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {paginated && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {rows.length} of {data.length} rows
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                aria-label="Previous page"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                aria-label="Next page"
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
