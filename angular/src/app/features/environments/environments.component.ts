import { Component, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AppEnvironmentsService, getApiAdminEnvironmentsResource } from '@moamen-ui/pointer-angular';
import type { AppEnvironmentResponse } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { ConfirmService } from '../../core/confirm.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { DataTableCellDirective } from '../../shared/data-table/data-table-cell.directive';
import { DataTableComponent, type DataTableColumn } from '../../shared/data-table/data-table.component';
import type { RowActionItem } from '../../shared/row-actions-menu/row-actions-menu.component';

/**
 * A super-admin-seeded global catalog ("default", "prod", "staging", "testing") every tenant
 * sees, plus each tenant's own custom environments layered on top — same own-plus-global shape
 * as the Roles page. A project can have one AppUrl per environment (see the Projects page).
 *
 * First page migrated onto the shared DataTable/Badge/ConfirmService — the wave-1 proving ground
 * for the shared-component library (see `src/app/shared/`).
 */
@Component({
  selector: 'app-environments',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatDialogModule,
    TranslocoModule,
    DataTableComponent,
    DataTableCellDirective,
    BadgeComponent,
  ],
  template: `
    <div class="p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 class="m-0 text-[1.5em] font-bold">{{ 'environments.title' | transloco }}</h2>
          <p class="m-0 mt-1 text-[13px] text-muted">{{ 'environments.subtitle' | transloco }}</p>
        </div>
        <button mat-flat-button color="primary" (click)="openAdd()">
          <mat-icon>add</mat-icon> {{ 'environments.addEnvironment' | transloco }}
        </button>
      </div>

      <app-data-table
        [rows]="environments()"
        [columns]="columns()"
        [actionsColumn]="{
          items: actionsFor,
          ariaLabel: 'roles.actions' | transloco,
          header: 'roles.actions' | transloco,
        }"
        [emptyIcon]="'public'"
        [emptyMessage]="'environments.empty' | transloco"
        [emptyHint]="'environments.emptyHint' | transloco"
      >
        <button emptyAction mat-flat-button color="primary" (click)="openAdd()">
          <mat-icon>add</mat-icon> {{ 'environments.addEnvironment' | transloco }}
        </button>
        <ng-template appDataTableCell="scope" let-env>
          <app-badge [severity]="env.isGlobal ? 'neutral' : 'success'">
            {{ (env.isGlobal ? 'environments.global' : 'environments.own') | transloco }}
          </app-badge>
        </ng-template>
      </app-data-table>
    </div>

    <!-- Add environment dialog -->
    <ng-template #addDialog>
      <h2 mat-dialog-title>{{ 'environments.addEnvironment' | transloco }}</h2>
      <mat-dialog-content>
        <div class="flex min-w-80 flex-col gap-4 pt-2">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'environments.name' | transloco }}</mat-label>
            <input matInput [(ngModel)]="newName" placeholder="e.g. qa" (keydown.enter)="addEnvironment()" />
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary" [disabled]="!newName.trim()" (click)="addEnvironment()">
          <mat-icon>add</mat-icon> {{ 'environments.addEnvironment' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>

    <!-- Rename environment dialog -->
    <ng-template #renameDialog>
      <h2 mat-dialog-title>{{ 'common.rename' | transloco }}</h2>
      <mat-dialog-content>
        <div class="flex min-w-80 flex-col gap-4 pt-2">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'environments.name' | transloco }}</mat-label>
            <input matInput [(ngModel)]="editName" (keydown.enter)="saveRename()" />
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary" [disabled]="!editName.trim()" (click)="saveRename()">
          {{ 'common.save' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>
  `,
})
export class EnvironmentsComponent {
  private environmentsService = inject(AppEnvironmentsService);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private dialog = inject(MatDialog);
  private confirmService = inject(ConfirmService);

  readonly addDialog = viewChild.required<TemplateRef<unknown>>('addDialog');
  readonly renameDialog = viewChild.required<TemplateRef<unknown>>('renameDialog');
  private dialogRef?: MatDialogRef<unknown>;

  environmentsResource = getApiAdminEnvironmentsResource();
  environments = () => this.environmentsResource.value() ?? [];

  // A method (not a stored field) so column headers stay live if the app language changes —
  // matches the same "re-evaluated every change-detection pass" idiom `| transloco` itself uses.
  columns(): DataTableColumn<AppEnvironmentResponse>[] {
    return [
      { key: 'name', header: this.transloco.translate('environments.name'), sortable: true },
      { key: 'scope', header: this.transloco.translate('environments.scope') },
    ];
  }

  readonly actionsFor = (env: AppEnvironmentResponse): RowActionItem[] => {
    if (!env.canManage) return [];
    return [
      {
        label: this.transloco.translate('common.rename'),
        icon: 'edit',
        onClick: () => this.renameEnvironment(env),
      },
      {
        label: this.transloco.translate('common.delete'),
        icon: 'delete',
        severity: 'danger',
        onClick: () => this.confirmDelete(env),
      },
    ];
  };

  newName = '';

  editingEnvironment = signal<AppEnvironmentResponse | null>(null);
  editName = '';

  openAdd() {
    this.newName = '';
    this.dialogRef = this.dialog.open(this.addDialog(), { width: '400px' });
  }

  addEnvironment() {
    const name = this.newName.trim();
    if (!name) return;
    this.environmentsService.postApiAdminEnvironments({ name }).subscribe({
      next: () => {
        // openAdd() already resets newName on next open — resetting it here too raced
        // dialogRef.close()'s CD check (NG0100: ExpressionChangedAfterItHasBeenCheckedError).
        this.dialogRef?.close();
        this.environmentsResource.reload();
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  renameEnvironment(env: AppEnvironmentResponse) {
    this.editingEnvironment.set(env);
    this.editName = env.name ?? '';
    this.dialogRef = this.dialog.open(this.renameDialog(), { width: '400px' });
  }

  saveRename() {
    const env = this.editingEnvironment();
    const name = this.editName.trim();
    if (!env || !name || name === env.name) {
      this.dialogRef?.close();
      return;
    }
    this.environmentsService.patchApiAdminEnvironmentsId(env.id!, { name }).subscribe({
      next: () => {
        this.dialogRef?.close();
        this.environmentsResource.reload();
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  confirmDelete(env: AppEnvironmentResponse) {
    this.confirmService
      .confirm({
        message: this.transloco.translate('environments.confirmDelete', { name: env.name }),
        confirmLabel: this.transloco.translate('common.delete'),
        confirmColor: 'danger',
      })
      .subscribe((ok) => {
        if (ok) this.deleteEnvironment(env);
      });
  }

  private deleteEnvironment(env: AppEnvironmentResponse) {
    this.environmentsService.deleteApiAdminEnvironmentsId(env.id!).subscribe({
      next: () => {
        this.snack.open(this.transloco.translate('environments.deleted'), 'OK', { duration: 3000 });
        this.environmentsResource.reload();
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }
}
