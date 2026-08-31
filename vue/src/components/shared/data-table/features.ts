// The TanStack Table v9 feature set every DataTable instance uses. v9 requires
// explicit feature registration; sharing one stable instance keeps `features`
// referentially stable across re-renders (a v9 requirement) and lets consumers
// type their column defs against it: `ColumnDef<typeof dataTableFeatures, T>`.
import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  tableFeatures,
} from '@tanstack/vue-table';

export const dataTableFeatures = tableFeatures({
  // Sorting (feature before its row-model slot, per v9 ordering rules).
  rowSortingFeature,
  sortFns: { alphanumeric: sortFn_alphanumeric, datetime: sortFn_datetime },
  sortedRowModel: createSortedRowModel(),
  // Client-side search. Global filtering sits on the column-filtering
  // machinery, so columnFilteringFeature must be registered first (v9 rule).
  columnFilteringFeature,
  globalFilteringFeature,
  filterFns: { includesString: filterFn_includesString },
  filteredRowModel: createFilteredRowModel(),
  // Pagination (a non-paginated table simply uses one huge page — see DataTable).
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});
