import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { StatusesService, getApiAdminStatusesResource } from '@moamen-ui/pointer-angular';
import type { StatusAdminItem } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { StatusCatalogService } from '../../core/status/status-catalog.service';

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
    MatTableModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatTooltipModule,
    TranslocoModule,
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
        <table mat-table [dataSource]="rows()" class="w-full mat-elevation-z2">

          <!-- Name column -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'statuses.colName' | transloco }}</th>
            <td mat-cell *matCellDef="let row">
              <span class="font-medium">{{ row.item.name }}</span>
              @if (row.item.isOverridden) {
                <span class="chip chip-active ms-2 text-[10px]">Overridden</span>
              }
            </td>
          </ng-container>

          <!-- Label column -->
          <ng-container matColumnDef="label">
            <th mat-header-cell *matHeaderCellDef>{{ 'statuses.colLabel' | transloco }}</th>
            <td mat-cell *matCellDef="let row; let i = index">
              <mat-form-field appearance="outline" class="dense-field w-44">
                <input
                  matInput
                  [(ngModel)]="rows()[i].label"
                  maxlength="64"
                  placeholder="Label"
                />
              </mat-form-field>
            </td>
          </ng-container>

          <!-- Color column -->
          <ng-container matColumnDef="color">
            <th mat-header-cell *matHeaderCellDef>{{ 'statuses.colColor' | transloco }}</th>
            <td mat-cell *matCellDef="let row; let i = index">
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  [value]="rows()[i].color"
                  (input)="onColorPicker(i, $event)"
                  class="h-9 w-10 cursor-pointer rounded border border-app-border bg-transparent p-0.5"
                />
                <mat-form-field appearance="outline" class="dense-field w-28">
                  <input
                    matInput
                    [(ngModel)]="rows()[i].color"
                    placeholder="#rrggbb"
                    pattern="^#[0-9a-fA-F]{6}$"
                    maxlength="7"
                  />
                </mat-form-field>
              </div>
            </td>
          </ng-container>

          <!-- Order column -->
          <ng-container matColumnDef="order">
            <th mat-header-cell *matHeaderCellDef>{{ 'statuses.colOrder' | transloco }}</th>
            <td mat-cell *matCellDef="let row; let i = index">
              <mat-form-field appearance="outline" class="dense-field w-24">
                <input
                  matInput
                  type="number"
                  min="0"
                  [(ngModel)]="rows()[i].order"
                  placeholder="0"
                />
              </mat-form-field>
            </td>
          </ng-container>

          <!-- Actions column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>{{ 'statuses.colActions' | transloco }}</th>
            <td mat-cell *matCellDef="let row; let i = index">
              <div class="flex flex-wrap gap-2">
                <button
                  mat-flat-button
                  color="primary"
                  [disabled]="row.saving || row.resetting || !isRowValid(row)"
                  (click)="save(i)"
                >
                  <mat-icon>save</mat-icon>
                  {{ row.saving ? ('statuses.saving' | transloco) : ('statuses.save' | transloco) }}
                </button>
                <button
                  mat-stroked-button
                  color="warn"
                  [disabled]="row.saving || row.resetting || !row.item.isOverridden"
                  [matTooltip]="!row.item.isOverridden ? ('statuses.noOverrides' | transloco) : ''"
                  (click)="confirmReset(i)"
                >
                  <mat-icon>restart_alt</mat-icon>
                  {{ row.resetting ? ('statuses.resetting' | transloco) : ('statuses.reset' | transloco) }}
                </button>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      }
    </div>
  `,
  styles: [`
    .dense-field {
      --mdc-outlined-text-field-container-height: 40px;
    }
    .dense-field .mat-mdc-form-field-subscript-wrapper { display: none; }
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
      // Only reseed when no row is mid-operation, to avoid wiping in-flight saves.
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
  }

  displayedColumns = ['name', 'label', 'color', 'order', 'actions'];

  onColorPicker(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.rows.update((rows) => {
      rows[index].color = input.value;
      return [...rows];
    });
  }

  isRowValid(row: StatusRow): boolean {
    return (
      row.label.trim().length > 0 &&
      row.label.trim().length <= 64 &&
      /^#[0-9a-fA-F]{6}$/.test(row.color) &&
      row.order >= 0
    );
  }

  save(index: number): void {
    const row = this.rows()[index];
    if (!row || !this.isRowValid(row)) return;
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

  confirmReset(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          message: this.transloco.translate('statuses.resetConfirmMessage', { name: row.item.name }),
          confirmLabel: this.transloco.translate('statuses.reset'),
          confirmColor: 'warn',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean | undefined) => {
        if (ok) this.resetStatus(index);
      });
  }

  private resetStatus(index: number): void {
    const row = this.rows()[index];
    if (!row) return;
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
