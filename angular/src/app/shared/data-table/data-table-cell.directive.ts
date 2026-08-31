import { Directive, Input, TemplateRef } from '@angular/core';

/**
 * Registers a custom cell renderer for one column of an `<app-data-table>`, absorbing every
 * table's per-row divergence (inline toggles, inline-edit inputs, badges, compound cells)
 * without the shared table needing to special-case any of them:
 *
 *   <app-data-table [rows]="rows()" [columns]="columns">
 *     <ng-template appDataTableCell="grantsAdmin" let-row>
 *       <mat-slide-toggle [checked]="row.grantsAdmin" (change)="toggle(row)" />
 *     </ng-template>
 *   </app-data-table>
 */
@Directive({
  selector: 'ng-template[appDataTableCell]',
  standalone: true,
})
export class DataTableCellDirective<T = unknown> {
  @Input('appDataTableCell') columnKey!: string;

  constructor(readonly templateRef: TemplateRef<{ $implicit: T }>) {}
}
