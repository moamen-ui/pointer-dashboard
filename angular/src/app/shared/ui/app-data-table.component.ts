import {
  Component,
  contentChildren,
  computed,
  input,
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

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  headerColor?: string;
  width?: string;
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
            class="h-8 max-w-xs"
          />
        </div>
      }

      <!-- Table -->
      @if (displayedRows().length > 0) {
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
            @for (row of displayedRows(); track trackBy($index, row); let idx = $index) {
              <tr class="h-11 border-t border-border-muted hover:bg-gutter/60 transition-colors">
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
                  <td class="px-3 py-1.5">
                    <app-row-actions-menu
                      [items]="actions(row)"
                      [ariaLabel]="actionsAriaLabel()"
                    />
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <!-- Empty state -->
        <div class="px-3 py-12">
          @if (emptyMessage()) {
            <div class="text-center text-muted-foreground">
              <p class="text-[14px]">{{ emptyMessage() }}</p>
              @if (emptyHint()) {
                <p class="text-[13px] text-faint-foreground mt-1">{{ emptyHint() }}</p>
              }
              <ng-content select="[emptyAction]" />
            </div>
          }
        </div>
      }

      <!-- Pagination -->
      @if (paginated() && pageCount() > 1) {
        <div class="h-11 border-t border-border bg-background px-3 flex items-center justify-between text-[13px] text-muted-foreground">
          <span>
            {{ 'table.rowsOf' | transloco: { shown: displayedRows().length, total: filteredRows().length } }}
          </span>
          <div class="flex items-center gap-2">
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

  readonly dir = 'ltr';
  readonly Math = Math;

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

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
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

  cellTemplateFor(key: string): TemplateRef<any> | undefined {
    return this.cellTemplates().find((t) => t.columnKey() === key)?.templateRef;
  }

  cellValue(row: T, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }
}
