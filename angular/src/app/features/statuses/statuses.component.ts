import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { StatusesService, getApiAdminStatusesResource } from '@moamen-ui/pointer-angular';
import type { StatusAdminItem } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { ConfirmService } from '../../core/confirm.service';
import { StatusCatalogService } from '../../core/status/status-catalog.service';
import { AppDataTableComponent, type DataTableColumn } from '../../shared/ui/app-data-table.component';
import { DataTableCellDirective } from '../../shared/data-table/data-table-cell.directive';
import type { RowActionItem } from '../../shared/row-actions-menu/row-actions-menu.component';
import { AppToastService } from '../../shared/ui/app-toast.service';
import { BadgeComponent } from '../../shared/badge/badge.component';

interface StatusRow {
  item: StatusAdminItem;
  label: string;
  color: string;
  order: number;
  saving: boolean;
  resetting: boolean;
}

@Component({
  selector: 'app-statuses',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoModule,
    AppDataTableComponent,
    DataTableCellDirective,
    BadgeComponent,
  ],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between gap-4">
        <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
          {{ 'statuses.title' | transloco }}
        </h1>
      </div>

      @if (statusesResource.error()) {
        <p class="text-state-danger text-[14px]">{{ 'statuses.loadError' | transloco }}</p>
      } @else if (statusesResource.isLoading() && rows().length === 0) {
        <p class="text-muted-foreground text-[14px]">{{ 'statuses.loading' | transloco }}</p>
      } @else {
        <!-- Escape hatch: every row is its own inline-edit form (label/color/order),
             so this table drives page-local state through appDataTableCell instead of
             the generic actions-column-only shape most pages use. -->
        <app-data-table
          [rows]="rows()"
          [columns]="columns()"
          [actions]="actionsFor"
          [actionsAriaLabel]="'statuses.colActions' | transloco"
          [actionsHeader]="'statuses.colActions' | transloco"
          [gutter]="true"
          [paginated]="false"
          [emptyMessage]="'statuses.empty' | transloco"
          [emptyHint]="'statuses.emptyHint' | transloco"
        >
          <ng-template appDataTableCell="name" let-row>
            <span class="font-medium">{{ row.item.name }}</span>
            @if (row.item.isOverridden) {
              <app-badge severity="warning" class="ms-2">{{ 'statuses.overridden' | transloco }}</app-badge>
            }
          </ng-template>

          <ng-template appDataTableCell="label" let-row>
            <!-- Same slim box as the colour control below, so the row reads as one
                 set of controls instead of tall Material fields beside a small one. -->
            <div class="table-field w-[132px]">
              <input
                class="table-field-input"
                [(ngModel)]="row.label"
                maxlength="64"
                placeholder="Label"
                [attr.aria-label]="'statuses.colLabel' | transloco"
              />
            </div>
          </ng-template>

          <ng-template appDataTableCell="color" let-row>
            <!-- Swatch + hex are one control: a single bordered box that lights up
                 on focus, with the native picker sitting inside it. -->
            <div class="table-field w-[124px] gap-1.5 ps-1.5">
              <input
                type="color"
                class="color-swatch h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                [value]="row.color"
                (input)="onColorPicker(row, $event)"
                [attr.aria-label]="'statuses.colColor' | transloco"
              />
              <input
                class="table-field-input font-mono"
                [(ngModel)]="row.color"
                placeholder="#rrggbb"
                pattern="^#[0-9a-fA-F]{6}$"
                maxlength="7"
              />
            </div>
          </ng-template>

          <ng-template appDataTableCell="order" let-row>
            <div class="table-field w-16">
              <input
                class="table-field-input"
                type="number"
                min="0"
                [(ngModel)]="row.order"
                placeholder="0"
                [attr.aria-label]="'statuses.colOrder' | transloco"
              />
            </div>
          </ng-template>
        </app-data-table>
      }
    </div>
  `,
  styles: [`
    /* Every in-table control — label, colour, order — is the same slim box. */
    .table-field {
      display: inline-flex;
      align-items: center;
      height: 32px;
      padding-inline: 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: transparent;
    }
    .table-field:focus-within {
      border-color: var(--brand);
      box-shadow: 0 0 0 1px var(--brand);
    }
    .table-field-input {
      width: 100%;
      min-width: 0;
      height: 100%;
      border: 0;
      padding: 0;
      background: transparent;
      color: var(--foreground);
      font-size: 0.8rem;
      outline: none;
    }
    .table-field-input::placeholder { color: var(--faint-foreground); }

    /* Native colour input: drop the browser's chrome so it reads as a plain
       swatch inside the merged colour control. */
    .color-swatch { appearance: none; -webkit-appearance: none; }
    .color-swatch::-webkit-color-swatch-wrapper { padding: 0; }
    .color-swatch::-webkit-color-swatch { border: none; border-radius: 3px; }
    .color-swatch::-moz-color-swatch { border: none; border-radius: 3px; }
  `],
})
export class StatusesComponent {
  private statusesService = inject(StatusesService);
  private catalogService = inject(StatusCatalogService);
  private toast = inject(AppToastService);
  private confirm = inject(ConfirmService);
  private transloco = inject(TranslocoService);

  statusesResource = getApiAdminStatusesResource();

  /** Mutable rows; seeded/reseeded from the resource via effect. */
  rows = signal<StatusRow[]>([]);

  constructor() {
    effect(() => {
      const fresh = this.statusesResource.value();
      if (!fresh) return;
      // Read/write `rows` inside untracked() so this effect depends ONLY on the
      // resource value. Without it, reading this.rows() registers it as a
      // dependency while this.rows.set() assigns a new array reference every
      // run — the signal "changes", the effect re-runs, and the page freezes in
      // an infinite loop. We still skip reseeding while a row is mid-operation.
      untracked(() => {
        const current = this.rows();
        const anyBusy = current.some((r) => r.saving || r.resetting);
        if (anyBusy) return;
        this.rows.set(
          fresh.map((item) => ({
            item,
            label: item.label ?? item.defaultLabel ?? '',
            color: item.color ?? item.defaultColor ?? '#6b7280',
            order: item.order ?? item.defaultOrder ?? 0,
            saving: false,
            resetting: false,
          })),
        );
      });
    });
  }

  // A method (not a stored field) so column headers stay live if the app language changes.
  columns(): DataTableColumn<StatusRow>[] {
    return [
      { key: 'name', header: this.transloco.translate('statuses.colName') },
      { key: 'label', header: this.transloco.translate('statuses.colLabel') },
      { key: 'color', header: this.transloco.translate('statuses.colColor') },
      { key: 'order', header: this.transloco.translate('statuses.colOrder') },
    ];
  }

  onColorPicker(row: StatusRow, event: Event): void {
    row.color = (event.target as HTMLInputElement).value;
  }

  actionsFor = (row: StatusRow): RowActionItem[] => [
    {
      label: row.saving ? this.transloco.translate('statuses.saving') : this.transloco.translate('statuses.save'),
      icon: 'save',
      disabled: row.saving || row.resetting || !this.isRowValid(row),
      onClick: () => this.save(row),
    },
    {
      label: row.resetting ? this.transloco.translate('statuses.resetting') : this.transloco.translate('statuses.reset'),
      icon: 'restart_alt',
      severity: 'danger',
      disabled: row.saving || row.resetting || !row.item.isOverridden,
      tooltip: row.item.isOverridden ? undefined : this.transloco.translate('statuses.noOverrides'),
      onClick: () => this.confirmReset(row),
    },
  ];

  isRowValid(row: StatusRow): boolean {
    return (
      row.label.trim().length > 0 &&
      row.label.trim().length <= 64 &&
      /^#[0-9a-fA-F]{6}$/.test(row.color) &&
      row.order >= 0
    );
  }

  private indexOf(row: StatusRow): number {
    return this.rows().findIndex((r) => r === row);
  }

  save(row: StatusRow): void {
    const index = this.indexOf(row);
    if (index < 0 || !this.isRowValid(row)) return;
    const value = row.item.value;
    if (value == null) {
      this.rows.update((rows) => { rows[index].saving = false; return [...rows]; });
      return;
    }
    this.rows.update((rows) => { rows[index].saving = true; return [...rows]; });
    this.statusesService
      .patchApiAdminStatusesValue(value, {
        label: row.label.trim(),
        color: row.color,
        order: row.order,
      })
      .subscribe({
        next: () => {
          this.rows.update((rows) => { rows[index].saving = false; return [...rows]; });
          this.statusesResource.reload();
          this.catalogService.reload();
          this.toast.show(this.transloco.translate('statuses.saveSuccess'), 'success');
        },
        error: (e: unknown) => {
          this.rows.update((rows) => { rows[index].saving = false; return [...rows]; });
          this.toast.show(extractMessage(e), 'danger');
        },
      });
  }

  confirmReset(row: StatusRow): void {
    if (this.indexOf(row) < 0) return;
    this.confirm
      .confirm({
        message: this.transloco.translate('statuses.resetConfirmMessage', { name: row.item.name }),
        confirmLabel: this.transloco.translate('statuses.reset'),
        confirmColor: 'danger',
      })
      .subscribe((ok: boolean) => {
        if (ok) this.resetStatus(row);
      });
  }

  private resetStatus(row: StatusRow): void {
    const index = this.indexOf(row);
    if (index < 0) return;
    const value = row.item.value;
    if (value == null) {
      this.rows.update((rows) => { rows[index].resetting = false; return [...rows]; });
      return;
    }
    this.rows.update((rows) => { rows[index].resetting = true; return [...rows]; });
    this.statusesService.deleteApiAdminStatusesValue(value).subscribe({
      next: () => {
        this.rows.update((rows) => { rows[index].resetting = false; return [...rows]; });
        this.statusesResource.reload();
        this.catalogService.reload();
        this.toast.show(this.transloco.translate('statuses.resetSuccess'), 'success');
      },
      error: (e: unknown) => {
        this.rows.update((rows) => { rows[index].resetting = false; return [...rows]; });
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }
}
