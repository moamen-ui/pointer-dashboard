import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { StatusesService, getApiAdminStatusesResource } from '@moamen-ui/pointer-angular';
import type { StatusAdminItem } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { StatusCatalogService } from '../../core/status/status-catalog.service';
import { DataTableComponent, type DataTableColumn } from '../../shared/data-table/data-table.component';
import { DataTableCellDirective } from '../../shared/data-table/data-table-cell.directive';
import type { RowActionItem } from '../../shared/row-actions-menu/row-actions-menu.component';

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
    DataTableComponent,
    DataTableCellDirective,
  ],
  template: `
    <div class="p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="m-0 text-[1.5em] font-bold">{{ 'statuses.title' | transloco }}</h2>
      </div>

      @if (statusesResource.error()) {
        <p class="text-red-500">{{ 'statuses.loadError' | transloco }}</p>
      } @else if (statusesResource.isLoading() && rows().length === 0) {
        <p class="text-muted">{{ 'statuses.loading' | transloco }}</p>
      } @else {
        <!-- Escape hatch: every row is its own inline-edit form (label/color/order),
             so this table drives page-local state through appDataTableCell instead of
             the generic actions-column-only shape most pages use. -->
        <app-data-table
          [rows]="rows()"
          [columns]="columns()"
          [actionsColumn]="{ items: actionsFor, ariaLabel: 'statuses.colActions' | transloco }"
          [paginated]="false"
          emptyIcon="label"
          [emptyMessage]="'statuses.empty' | transloco"
          [emptyHint]="'statuses.emptyHint' | transloco"
        >
          <ng-template appDataTableCell="name" let-row>
            <span class="font-medium">{{ row.item.name }}</span>
            @if (row.item.isOverridden) {
              <span class="chip chip-active ms-2 text-[10px]">Overridden</span>
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
    /* Every in-table control — label, colour, order — is the same slim box. Material's
       outlined form field is much taller than the colour swatch it sat next to, which
       made the row look mismatched. */
    .table-field {
      display: inline-flex;
      align-items: center;
      height: 36px;
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
      color: var(--ink);
      font-size: 0.8rem;
      outline: none;
    }
    .table-field-input::placeholder { color: var(--muted); }

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
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
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
          this.snack.open(this.transloco.translate('statuses.saveSuccess'), 'OK', { duration: 3000 });
        },
        error: (e: unknown) => {
          this.rows.update((rows) => { rows[index].saving = false; return [...rows]; });
          this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
        },
      });
  }

  confirmReset(row: StatusRow): void {
    if (this.indexOf(row) < 0) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          message: this.transloco.translate('statuses.resetConfirmMessage', { name: row.item.name }),
          confirmLabel: this.transloco.translate('statuses.reset'),
          confirmColor: 'danger',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean | undefined) => {
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
        this.snack.open(this.transloco.translate('statuses.resetSuccess'), 'OK', { duration: 3000 });
      },
      error: (e: unknown) => {
        this.rows.update((rows) => { rows[index].resetting = false; return [...rows]; });
        this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
      },
    });
  }
}
