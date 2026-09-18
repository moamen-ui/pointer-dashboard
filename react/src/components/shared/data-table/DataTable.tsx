import { useMemo, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Renderable,
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
import { EmptyState } from '@/components/EmptyState';

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

/** Comment #92: flexRender turns a plain-function cell def into a component TYPE via
 *  `React.createElement(Comp, props)`. A page whose column defs are rebuilt every render
 *  (a fresh closure per cell each time, as an inline-edit table's columns are) hands
 *  flexRender a new type every keystroke, so React remounts the cell subtree and re-fires
 *  any `autoFocus` inside it. Calling a plain function directly returns its element into
 *  the parent tree instead, which reconciles by JSX position rather than by identity, so a
 *  new closure each render no longer remounts anything. Anything that isn't a plain
 *  function (a class/exotic component, a string, an already-built element) still needs
 *  flexRender's real component semantics. */
function renderCellDef<TProps extends object>(cellDef: Renderable<TProps> | undefined, props: TProps) {
  if (typeof cellDef === 'function') {
    const proto = Object.getPrototypeOf(cellDef);
    const isClassComponent = !!(proto?.prototype && proto.prototype.isReactComponent);
    if (!isClassComponent) {
      return (cellDef as (props: TProps) => ReactNode)(props);
    }
  }
  return flexRender(cellDef, props);
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
  /** Renders the empty state in the compact (half-size) treatment — for tables living
   *  inside dialogs or inline sections rather than owning a full page (comment #75). */
  emptyCompact?: boolean;
  /** Optional action (e.g. an "Add" button) rendered inside the empty state. */
  emptyAction?: ReactNode;
  /** When non-empty, renders the shared error EmptyState INSTEAD of rows (header still
   *  renders). Overrides the default `table.error` message. */
  error?: string | null;
  /** Optional retry callback; when provided, renders a `table.retry` button as the
   *  error state's action. */
  onRetry?: () => void;
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
  emptyCompact = false,
  emptyAction,
  error = null,
  onRetry,
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

  const rows = table.getRowModel().rows;
  const pageCount = Math.max(table.getPageCount(), 1);

  // Comment #193: when the table has nothing to draw — a load error, a genuinely empty
  // dataset, or a search that matched nothing — there is no table at all: no header row,
  // no card border, no pagination footer, just the big centered illustration. Mirrors
  // Angular's `isEmptyState()` exactly.
  const isEmptyState = !!error || data.length === 0 || rows.length === 0;

  const searchInput = (
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
  // sort disabled, one bordered card per row. Only ever rendered once the error/
  // empty/no-results branches above have all been ruled out, so `rows` here is
  // always non-empty.
  // ---------------------------------------------------------------------
  function MobileCards() {
    const headerGroup = table.getHeaderGroups()[0];

    return (
      <div className="flex flex-col gap-2 p-3">
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
                    {renderCellDef(primaryCell.column.columnDef.cell, primaryCell.getContext())}
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
                          {renderCellDef(cell.column.columnDef.cell, cell.getContext())}
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
    );
  }

  // ---------------------------------------------------------------------
  // Desktop (`md` and up): unchanged table markup. Only ever rendered once the
  // error/empty/no-results branches above have all been ruled out, so `rows`
  // here is always non-empty — no colSpan "no rows" branch needed any more.
  // ---------------------------------------------------------------------
  function DesktopTable() {
    return (
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
          {rows.map((row) => (
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
                  {renderCellDef(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div
      className={cn(
        'bg-background',
        !isEmptyState && 'rounded-md border border-border overflow-hidden',
      )}
    >
      {searchable && (
        <div
          className={cn(
            'px-3 py-3 bg-background',
            !isEmptyState && 'border-b border-border-muted',
          )}
        >
          {searchInput}
        </div>
      )}

      {/* Comment #92: these are plain functions CALLED, not <Component /> JSX — they are
          defined inside this component body, so JSX would mint a new component type on
          every render, remount the whole table subtree, and re-fire autoFocus on inputs
          (typing in one cell threw focus to the row's first input every keystroke).
          None of them use hooks, so direct calls are safe and keep every DOM node (and
          its focus) stable across re-renders. */}
      {error ? (
        <EmptyState variant="error" message={error}>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              {t('table.retry')}
            </Button>
          )}
        </EmptyState>
      ) : data.length === 0 ? (
        <EmptyState variant="empty" message={emptyMessage} hint={emptyHint} compact={emptyCompact}>
          {emptyAction}
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState variant="no-results" message={t('table.noResultsFor', { query: globalFilter })}>
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-0 p-0 text-[14px]"
            onClick={() => setGlobalFilter('')}
          >
            {t('table.clearSearch')}
          </Button>
        </EmptyState>
      ) : isMobile ? (
        MobileCards()
      ) : (
        DesktopTable()
      )}

      {!isEmptyState && Pager()}
    </div>
  );
}
