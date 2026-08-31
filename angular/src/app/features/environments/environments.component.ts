import { Component, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AppEnvironmentsService, getApiAdminEnvironmentsResource } from '@moamen-ui/pointer-angular';
import type { AppEnvironmentResponse } from '@moamen-ui/pointer-angular';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { extractMessage } from '../../core/api/extract-message';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

/**
 * A super-admin-seeded global catalog ("default", "prod", "staging", "testing") every tenant
 * sees, plus each tenant's own custom environments layered on top — same own-plus-global shape
 * as the Roles page. A project can have one AppUrl per environment (see the Projects page).
 */
@Component({
  selector: 'app-environments',
  standalone: true,
  imports: [
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    TranslocoModule,
    EmptyStateComponent,
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

      @if (environments().length === 0) {
        <app-empty-state
          icon="public"
          [message]="'environments.empty' | transloco"
          [hint]="'environments.emptyHint' | transloco"
        >
          <button mat-flat-button color="primary" (click)="openAdd()">
            <mat-icon>add</mat-icon> {{ 'environments.addEnvironment' | transloco }}
          </button>
        </app-empty-state>
      } @else {
        <table mat-table [dataSource]="environments()" class="w-full mat-elevation-z2">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'environments.name' | transloco }}</th>
            <td mat-cell *matCellDef="let env">{{ env.name }}</td>
          </ng-container>

          <ng-container matColumnDef="scope">
            <th mat-header-cell *matHeaderCellDef>{{ 'environments.scope' | transloco }}</th>
            <td mat-cell *matCellDef="let env">
              <span class="chip" [class.chip-neutral]="env.isGlobal" [class.chip-active]="!env.isGlobal">
                {{ (env.isGlobal ? 'environments.global' : 'environments.own') | transloco }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>{{ 'roles.actions' | transloco }}</th>
            <td mat-cell *matCellDef="let env">
              @if (env.canManage) {
                <button mat-icon-button [matMenuTriggerFor]="rowMenu"
                  [attr.aria-label]="'roles.actions' | transloco">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #rowMenu="matMenu">
                  <button mat-menu-item (click)="renameEnvironment(env)">
                    <mat-icon>edit</mat-icon> {{ 'common.rename' | transloco }}
                  </button>
                  <button mat-menu-item class="!text-red-600" (click)="confirmDelete(env)">
                    <mat-icon class="!text-red-600">delete</mat-icon> {{ 'common.delete' | transloco }}
                  </button>
                </mat-menu>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      }
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

  readonly addDialog = viewChild.required<TemplateRef<unknown>>('addDialog');
  readonly renameDialog = viewChild.required<TemplateRef<unknown>>('renameDialog');
  private dialogRef?: MatDialogRef<unknown>;

  environmentsResource = getApiAdminEnvironmentsResource();
  environments = () => this.environmentsResource.value() ?? [];

  displayedColumns = ['name', 'scope', 'actions'];

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
        this.dialogRef?.close();
        this.newName = '';
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
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          message: this.transloco.translate('environments.confirmDelete', { name: env.name }),
          confirmLabel: this.transloco.translate('common.delete'),
          confirmColor: 'warn',
        },
      })
      .afterClosed()
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
