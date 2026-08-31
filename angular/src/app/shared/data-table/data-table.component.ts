import { CommonModule } from '@angular/common';
import { Component, computed, contentChildren, effect, input, signal, viewChild } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { EmptyStateComponent } from '../empty-state.component';
import { RowActionsMenuComponent, type RowActionItem } from '../row-actions-menu/row-actions-menu.component';
import { DataTableCellDirective } from './data-table-cell.directive';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Enables Material's own column sort — the default sort accessor reads `row[key]` directly,
   *  so only mark computed/derived columns sortable if their `key` matches a real row field. */
  sortable?: boolean;
}

/**
 * The shared table shell every list page renders: wraps `mat-table` + real `MatSort` +
 * `MatPaginator` (CDK machinery, not reinvented) with an optional search box, a per-column
 * custom-cell escape hatch (`appDataTableCell`), and a trailing actions column driven by a
 * per-row callback so permission/feature-gating logic always stays page-side.
 *
 *   <app-data-table
 *     [rows]="roles()"
 *     [columns]="[{ key: 'name', header: 'Name', sortable: true }]"
 *     [actionsColumn]="{ items: actionsFor, ariaLabel: 'roles.actions' | transloco }"
 *     [search]="true"
 *     emptyIcon="manage_accounts"
 *     [emptyMessage]="'roles.empty' | transloco"
 *   >
 *     <ng-template appDataTableCell="grantsAdmin" let-row>
 *       <mat-slide-toggle [checked]="row.grantsAdmin" (change)="toggleAdmin(row)" />
 *     </ng-template>
 *   </app-data-table>
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    EmptyStateComponent,
    RowActionsMenuComponent,
  ],
  template: `
    @if (rows().length === 0) {
      <app-empty-state [icon]="emptyIcon()" [message]="emptyMessage()" [hint]="emptyHint()">
        <ng-content select="[emptyAction]" />
      </app-empty-state>
    } @else {
      @if (search()) {
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="mb-3 w-full max-w-sm">
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [value]="searchTerm()" (input)="onSearch($event)" [placeholder]="searchPlaceholder()" />
        </mat-form-field>
      }

      <table mat-table matSort [dataSource]="dataSource" class="w-full mat-elevation-z2">
        @for (column of columns(); track column.key) {
          <ng-container [matColumnDef]="column.key">
            <th mat-header-cell *matHeaderCellDef mat-sort-header [disabled]="!column.sortable">
              {{ column.header }}
            </th>
            <td mat-cell *matCellDef="let row">
              @if (cellTemplateFor(column.key); as tpl) {
                <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: row }" />
              } @else {
                {{ cellValue(row, column.key) }}
              }
            </td>
          </ng-container>
        }

        @if (actionsColumn(); as ac) {
          <ng-container matColumnDef="__actions__">
            <th mat-header-cell *matHeaderCellDef>{{ ac.header ?? '' }}</th>
            <td mat-cell *matCellDef="let row">
              <app-row-actions-menu [items]="ac.items(row)" [ariaLabel]="ac.ariaLabel" />
            </td>
          </ng-container>
        }

        <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns()"></tr>
        <tr *matNoDataRow>
          <td class="p-4 text-center text-muted" [attr.colspan]="displayedColumns().length">
            {{ noResultsMessage() }}
          </td>
        </tr>
      </table>

      @if (paginated()) {
        <mat-paginator [pageSize]="pageSize()" [pageSizeOptions]="[5, 10, 25, 50]" />
      }
    }
  `,
})
export class DataTableComponent<T> {
  readonly rows = input.required<T[]>();
  readonly columns = input.required<DataTableColumn<T>[]>();
  readonly actionsColumn = input<
    { items: (row: T) => RowActionItem[]; ariaLabel: string; header?: string } | undefined
  >(undefined);
  readonly search = input(false);
  readonly searchPlaceholder = input('Search');
  readonly paginated = input(true);
  readonly pageSize = input(10);
  readonly emptyIcon = input('inbox');
  readonly emptyMessage = input('');
  readonly emptyHint = input('');
  readonly noResultsMessage = input('No matching rows');

  // descendants: true (not the input() default of false) so a template wrapped in an @if/@for/
  // ng-container — not just a direct child of <app-data-table> — still resolves. CDK's own
  // matColumnDef content query opts into the same thing for the same reason.
  private readonly cellTemplates = contentChildren(DataTableCellDirective, { descendants: true });
  private readonly sortRef = viewChild(MatSort);
  private readonly paginatorRef = viewChild(MatPaginator);

  readonly searchTerm = signal('');
  readonly dataSource = new MatTableDataSource<T>([]);

  readonly displayedColumns = computed(() => {
    const keys = this.columns().map((c) => c.key);
    return this.actionsColumn() ? [...keys, '__actions__'] : keys;
  });

  constructor() {
    effect(() => {
      this.dataSource.data = this.rows();
    });
    effect(() => {
      this.dataSource.filter = this.searchTerm().trim().toLowerCase();
    });
    effect(() => {
      this.dataSource.sort = this.sortRef() ?? null;
    });
    effect(() => {
      this.dataSource.paginator = this.paginatorRef() ?? null;
    });
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  cellTemplateFor(key: string) {
    return this.cellTemplates().find((t) => t.columnKey === key)?.templateRef;
  }

  cellValue(row: T, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }
}
