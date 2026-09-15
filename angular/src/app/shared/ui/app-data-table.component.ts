import {
  Component,
  contentChildren,
  computed,
  inject,
  input,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { BidiModule } from '@angular/cdk/bidi';
import { AppButtonDirective } from './app-button.directive';
import { AppIconComponent } from './app-icon.component';
import { AppInputDirective } from './app-input.directive';
import { DataTableCellDirective } from '../data-table/data-table-cell.directive';
import { RowActionsMenuComponent, type RowActionItem } from '../row-actions-menu/row-actions-menu.component';
import { ViewportService } from './viewport.service';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  headerColor?: string;
  width?: string;
  /** Mobile card-mode hint (ignored on desktop): `'primary'` promotes this column to the card's
   *  title row (full text, wraps); `'hide'` drops it from the card body as redundant there (row
   *  index, ids, anything the primary column already says). Default: shown as a label/value pair.
   *  Exactly one column should be `'primary'` per table; if none is marked the first column wins. */
  mobile?: 'primary' | 'hide';
}

export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

@Component({
  selector: 'app-data-table',
  // A custom element defaults to display:inline, which drops vertical margins from
  // `space-y-*` and breaks width; blockify the host.
  host: { class: 'block' },
  standalone: true,
  imports: [
    NgTemplateOutlet,
    BidiModule,
    TranslocoModule,
    AppButtonDirective,
    AppInputDirective,
    AppIconComponent,
    RowActionsMenuComponent,
  ],
  template: `
    <div class="rounded-md border border-border overflow-hidden bg-background">
      <!-- Search -->
      @if (searchable()) {
        <div class="px-3 py-3 border-b border-border-muted bg-background">
          <input
            type="text"
            appInput
            [value]="searchTerm()"
            (input)="onSearch($event)"
            [placeholder]="searchPlaceholder()"
            class="h-8 max-md:h-11 max-w-xs max-md:max-w-full"
          />
        </div>
      }

      @if (isMobile()) {
        <!-- Mobile card list: header hidden, sort disabled, one card per row. The column marked
             mobile: 'primary' (default: the first column) becomes the card title; the rest render
             as a compact label/value list; row actions sit in one full-width row at the card
             bottom. Nothing is ever display:none'd — every column and action stays reachable,
             just re-laid-out. -->
        <div class="divide-y divide-border-muted">
          @if (rows().length === 0) {
            <div class="px-3 py-4">
              @if (emptyMessage()) {
                <div class="flex flex-col gap-1">
                  <span class="text-[14px] text-muted-foreground">{{ emptyMessage() }}</span>
                  @if (emptyHint()) {
                    <span class="text-[12px] text-muted-foreground">{{ emptyHint() }}</span>
                  }
                </div>
              }
              @if (actions() || actionsColumn()) {
                <div class="mt-3">
                  <ng-content select="[emptyAction]" />
                </div>
              }
            </div>
          } @else if (filteredRows().length === 0) {
            <div class="px-3 py-4 flex items-center gap-2 flex-wrap text-[14px] text-muted-foreground">
              <span>{{ 'table.noResultsFor' | transloco: { query: searchTerm() } }}</span>
              <span class="text-faint-foreground" aria-hidden="true">·</span>
              <button
                appButton
                variant="link"
                class="h-auto! px-0! text-[14px]"
                (click)="clearSearch()"
              >
                {{ 'table.clearSearch' | transloco }}
              </button>
            </div>
          } @else {
            @for (row of displayedRows(); track trackBy($index, row)) {
              <div
                class="p-3"
                [class.cursor-pointer]="clickableRows()"
                (click)="onRowClick(row)"
              >
                <!-- Card title: the primary column, full text, wraps -->
                <div class="text-[14px] font-medium text-foreground break-words">
                  @if (cellTemplateFor(primaryColumn().key); as tpl) {
                    <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: row }" />
                  } @else {
                    {{ cellValue(row, primaryColumn().key) }}
                  }
                </div>

                <!-- Secondary columns: compact two-column label/value list; empty plain values
                     are skipped so the card doesn't pad itself out with blank rows. -->
                @if (secondaryColumns(row).length > 0) {
                  <dl class="mt-2 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                    @for (column of secondaryColumns(row); track column.key) {
                      <dt class="text-[12px] text-muted-foreground self-start pt-0.5">{{ column.header }}</dt>
                      <dd class="min-w-0 text-[13px] text-foreground break-words">
                        @if (cellTemplateFor(column.key); as tpl) {
                          <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: row }" />
                        } @else {
                          {{ cellValue(row, column.key) }}
                        }
                      </dd>
                    }
                  </dl>
                }

                <!-- A page's own bespoke "actions" column (custom cell template keyed "actions",
                     used where the built-in [actions] menu can't express the row's controls)
                     gets the same full-width, bottom-of-card treatment as the built-in one. -->
                @if (actionsColumn(); as ac) {
                  <div
                    class="mt-3 pt-3 border-t border-border-muted min-h-11 flex items-center justify-end gap-2"
                    (click)="$event.stopPropagation()"
                  >
                    @if (cellTemplateFor(ac.key); as tpl) {
                      <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: row }" />
                    }
                  </div>
                }

                <!-- Built-in row actions + navigation chevron, one row, full-width touch targets -->
                @if (actions(); as actionsFn) {
                  <div
                    class="mt-3 pt-3 border-t border-border-muted min-h-11 flex items-center justify-end gap-2"
                    (click)="$event.stopPropagation()"
                  >
                    <app-row-actions-menu
                      [items]="actionsFn(row)"
                      [ariaLabel]="actionsAriaLabel()"
                    />
                    @if (clickableRows()) {
                      <app-icon
                        name="chevron-right"
                        [size]="16"
                        class="text-faint-foreground rtl:-scale-x-100"
                        aria-hidden="true"
                      ></app-icon>
                    }
                  </div>
                }
              </div>
            }
          }
        </div>
      } @else {
      <!-- Table: the header always renders, even when there's nothing (or nothing matching
           a search) to show below it — a table missing its own column headers just because
           it's empty is a different, worse-looking component than the populated one. -->
      <table class="w-full border-collapse">
        <!-- Header -->
        <thead>
          <tr class="h-10 bg-gutter text-[13px] font-medium text-muted-foreground border-b border-border">
            <!-- Gutter column -->
            @if (gutter()) {
              <th class="w-10 text-end font-mono text-[12px] text-faint-foreground px-3"></th>
            }
            <!-- Data columns -->
            @for (column of columns(); track column.key) {
              <th
                class="px-3 text-start h-10 cursor-pointer hover:bg-gutter-strong transition-colors"
                [style.width]="column.width"
                (click)="column.sortable && toggleSort(column.key)"
                [attr.aria-sort]="column.sortable ? ariaSort(column.key) : null"
                [dir]="dir"
              >
                <div class="flex items-center gap-1.5">
                  {{ column.header }}
                  @if (column.sortable) {
                    <app-icon
                      [name]="sortGlyph(column.key)"
                      [size]="14"
                      [class.opacity-40]="sortState()?.key !== column.key"
                    ></app-icon>
                  }
                </div>
              </th>
            }
            <!-- Actions column -->
            @if (actions()) {
              <th class="px-3 text-start h-10">{{ actionsHeader() }}</th>
            }
          </tr>
        </thead>
        <!-- Body -->
        <tbody>
          @if (rows().length === 0) {
            <!-- True empty (nothing in the dataset at all): three ghost rows with dashed
                 hairlines, the message + optional hint in the first row's first data cell,
                 the projected action at that row's end. -->
            @for (idx of [0, 1, 2]; track idx) {
              <tr class="h-11 border-t border-dashed border-border-muted">
                @if (gutter()) {
                  <td class="w-10 px-3 py-1.5"></td>
                }
                @for (column of columns(); track column.key; let colIdx = $index) {
                  <td class="px-3 py-1.5" [style.width]="column.width">
                    @if (idx === 0 && colIdx === 0 && emptyMessage()) {
                      <div class="flex flex-col gap-1">
                        <span class="text-[14px] text-muted-foreground">{{ emptyMessage() }}</span>
                        @if (emptyHint()) {
                          <span class="text-[12px] text-muted-foreground">{{ emptyHint() }}</span>
                        }
                      </div>
                    }
                  </td>
                }
                @if (actions()) {
                  <td class="px-3 py-1.5">
                    @if (idx === 0) {
                      <div class="flex justify-end">
                        <ng-content select="[emptyAction]" />
                      </div>
                    }
                  </td>
                }
              </tr>
            }
          } @else if (filteredRows().length === 0) {
            <!-- No search match: rows exist, the filter just found none of them — a single
                 row at normal height, start-aligned, distinct from the ghost rows above
                 (that means "nothing here yet"; this means "try a different search"). -->
            <tr class="h-11 border-t border-border-muted">
              <td class="px-3 py-1.5" [attr.colspan]="totalColumnCount()">
                <div class="flex items-center gap-2 text-[14px] text-muted-foreground">
                  <span>{{ 'table.noResultsFor' | transloco: { query: searchTerm() } }}</span>
                  <span class="text-faint-foreground" aria-hidden="true">·</span>
                  <button
                    appButton
                    variant="link"
                    class="h-auto! px-0! text-[14px]"
                    (click)="clearSearch()"
                  >
                    {{ 'table.clearSearch' | transloco }}
                  </button>
                </div>
              </td>
            </tr>
          } @else {
            @for (row of displayedRows(); track trackBy($index, row); let idx = $index) {
              <tr
                class="h-11 border-t border-border-muted hover:bg-gutter/60 transition-colors"
                [class.cursor-pointer]="clickableRows()"
                (click)="onRowClick(row)"
              >
                <!-- Gutter column -->
                @if (gutter()) {
                  <td class="w-10 text-end font-mono text-[12px] text-faint-foreground px-3 py-1.5">
                    {{ (currentPage() * pageSize() + idx + 1) }}
                  </td>
                }
                <!-- Data columns -->
                @for (column of columns(); track column.key) {
                  <td class="px-3 py-1.5 text-[14px] text-foreground" [style.width]="column.width">
                    @if (cellTemplateFor(column.key); as tpl) {
                      <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: row }" />
                    } @else {
                      {{ cellValue(row, column.key) }}
                    }
                  </td>
                }
                <!-- Actions column -->
                @if (actions(); as actions) {
                  <td class="px-3 py-1.5" (click)="$event.stopPropagation()">
                    <div class="flex items-center justify-end gap-1">
                      <app-row-actions-menu
                        [items]="actions(row)"
                        [ariaLabel]="actionsAriaLabel()"
                      />
                      @if (clickableRows()) {
                        <app-icon
                          name="chevron-right"
                          [size]="16"
                          class="text-faint-foreground rtl:-scale-x-100"
                          aria-hidden="true"
                        ></app-icon>
                      }
                    </div>
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
      }

      <!-- Pagination: compact prev/next + "n of m" on mobile (the shown/total line is desktop-only
           clutter at this width); identical control in both table and card mode. -->
      @if (paginated() && pageCount() > 1) {
        <div class="h-11 max-md:h-auto max-md:py-2 border-t border-border bg-background px-3 flex items-center justify-between text-[13px] text-muted-foreground">
          <span class="max-md:hidden">
            {{ 'table.rowsOf' | transloco: { shown: displayedRows().length, total: filteredRows().length } }}
          </span>
          <div class="flex items-center gap-2 max-md:w-full max-md:justify-between">
            <button
              appButton
              variant="secondary"
              size="sm"
              [disabled]="currentPage() === 0"
              (click)="previousPage()"
              [attr.aria-label]="'table.previousPage' | transloco"
            >
              <app-icon name="chevron-left" [size]="16" class="rtl:-scale-x-100"></app-icon>
            </button>
            <span>
              {{ 'table.pageOf' | transloco: { page: currentPage() + 1, pages: pageCount() } }}
            </span>
            <button
              appButton
              variant="secondary"
              size="sm"
              [disabled]="(currentPage() + 1) * pageSize() >= filteredRows().length"
              (click)="nextPage()"
              [attr.aria-label]="'table.nextPage' | transloco"
            >
              <app-icon name="chevron-right" [size]="16" class="rtl:-scale-x-100"></app-icon>
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class AppDataTableComponent<T> {
  readonly rows = input.required<T[]>();
  readonly columns = input.required<DataTableColumn<T>[]>();
  readonly actions = input<((row: T) => RowActionItem[]) | undefined>(undefined);
  readonly actionsHeader = input('');
  readonly actionsAriaLabel = input('');
  readonly searchable = input(false);
  readonly searchPlaceholder = input('');
  readonly paginated = input(false);
  readonly pageSize = input(10);
  readonly gutter = input(false);
  readonly emptyMessage = input('');
  readonly emptyHint = input('');
  /** When true, rows show a pointer cursor + trailing chevron and emit `rowClick` on click
   *  (the actions cell stops propagation so the kebab menu doesn't also trigger navigation). */
  readonly clickableRows = input(false);
  readonly rowClick = output<T>();

  readonly dir = 'ltr';
  readonly Math = Math;

  private readonly viewport = inject(ViewportService);
  readonly isMobile = this.viewport.isMobile;

  readonly searchTerm = signal('');
  readonly sortState = signal<SortState | null>(null);
  readonly currentPage = signal(0);

  private readonly cellTemplates = contentChildren(DataTableCellDirective, { descendants: true });

  readonly filteredRows = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.rows();
    return this.rows().filter((row) => {
      const str = JSON.stringify(row).toLowerCase();
      return str.includes(term);
    });
  });

  readonly sortedRows = computed(() => {
    let rows = this.filteredRows();
    const sort = this.sortState();
    if (sort && sort.key) {
      rows = [...rows].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sort.key];
        const bVal = (b as Record<string, unknown>)[sort.key];
        let cmp = 0;
        if (aVal != null && bVal != null) {
          cmp = String(aVal).localeCompare(String(bVal));
        } else if (aVal != null) {
          cmp = 1;
        } else if (bVal != null) {
          cmp = -1;
        }
        return sort.direction === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  });

  /** Total pages for the current filter; the footer hides at one page, like React/Vue. */
  readonly pageCount = computed(() =>
    Math.max(Math.ceil(this.filteredRows().length / this.pageSize()), 1),
  );

  readonly displayedRows = computed(() => {
    if (!this.paginated()) return this.sortedRows();
    const start = this.currentPage() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });

  /** Column count for the no-search-match row's colspan: gutter + data columns + actions. */
  readonly totalColumnCount = computed(
    () => (this.gutter() ? 1 : 0) + this.columns().length + (this.actions() ? 1 : 0),
  );

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(0);
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.currentPage.set(0);
  }

  /** Same grammar as React/Vue: a two-way arrow at 40% opacity until the column is sorted. */
  sortGlyph(key: string): 'arrow-up' | 'arrow-down' | 'arrow-up-down' {
    const sort = this.sortState();
    if (sort?.key !== key) return 'arrow-up-down';
    return sort.direction === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    const sort = this.sortState();
    if (sort?.key !== key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  toggleSort(key: string): void {
    const current = this.sortState();
    if (current?.key === key) {
      if (current.direction === 'asc') {
        this.sortState.set({ key, direction: 'desc' });
      } else {
        this.sortState.set(null);
      }
    } else {
      this.sortState.set({ key, direction: 'asc' });
    }
    this.currentPage.set(0);
  }

  previousPage(): void {
    if (this.currentPage() > 0) {
      this.currentPage.update((p) => p - 1);
    }
  }

  nextPage(): void {
    const maxPage = Math.ceil(this.filteredRows().length / this.pageSize());
    if (this.currentPage() < maxPage - 1) {
      this.currentPage.update((p) => p + 1);
    }
  }

  trackBy(_: number, row: T): unknown {
    return row;
  }

  onRowClick(row: T): void {
    if (this.clickableRows()) this.rowClick.emit(row);
  }

  cellTemplateFor(key: string): TemplateRef<any> | undefined {
    return this.cellTemplates().find((t) => t.columnKey() === key)?.templateRef;
  }

  cellValue(row: T, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }

  /** Mobile card mode: the column that becomes the card title. A page opts in with
   *  `mobile: 'primary'` on the obvious column (name/email/body excerpt/key); absent that, the
   *  first column wins so every table still renders a sensible card without a rewrite. */
  primaryColumn(): DataTableColumn<T> {
    return this.columns().find((c) => c.mobile === 'primary') ?? this.columns()[0];
  }

  /** Mobile card mode: the label/value pairs below the title — every column except the primary
   *  one, one explicitly marked `mobile: 'hide'` (redundant index/id/duplicate columns), the
   *  bespoke "actions" column (rendered separately, full-width, at the card's bottom), and — for
   *  a plain (non-templated) value only, since a custom cell renderer's emptiness can't be
   *  inspected from here — a null/undefined/blank value. */
  secondaryColumns(row: T): DataTableColumn<T>[] {
    const primaryKey = this.primaryColumn()?.key;
    return this.columns().filter((c) => {
      if (c.key === primaryKey || c.mobile === 'hide' || c.key === 'actions') return false;
      if (this.cellTemplateFor(c.key)) return true;
      const v = this.cellValue(row, c.key);
      return v !== null && v !== undefined && v !== '';
    });
  }

  /** A page's own bespoke actions column (custom `appDataTableCell="actions"` template), as
   *  distinct from the built-in `[actions]` input — see `secondaryColumns` and the card template. */
  actionsColumn(): DataTableColumn<T> | undefined {
    return this.columns().find((c) => c.key === 'actions');
  }
}
