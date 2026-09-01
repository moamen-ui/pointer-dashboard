import { Directive, Input, TemplateRef } from '@angular/core';

/**
 * Registers one tab's body as a template `<app-tabs>` renders via `ngTemplateOutlet` —
 * the same escape hatch `appDataTableCell` uses for custom table cells, and for the same
 * reason: `MatTabGroup`'s own `@ContentChildren(MatTab)` query can't see a `<mat-tab>`
 * merely projected in through an intermediate wrapper's `<ng-content>` (confirmed live for
 * the analogous `MAT_SUFFIX`/`MatFormFieldControl` cases), so `<app-tabs>` owns the real
 * `<mat-tab-group>`/`<mat-tab>` elements itself and only pulls this template in to render:
 *
 *   <app-tabs [tabs]="[{ value: 'code', label: 'Code' }]" [(activeTab)]="tab">
 *     <ng-template appTabContent="code">...</ng-template>
 *   </app-tabs>
 */
@Directive({
  selector: 'ng-template[appTabContent]',
  standalone: true,
})
export class TabContentDirective {
  @Input('appTabContent') tabValue!: string;

  constructor(readonly templateRef: TemplateRef<unknown>) {}
}
