import { Component, inject, signal, TemplateRef, viewChild, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { RolesService, getApiAdminRolesResource } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import type { RoleResponse } from '@moamen-ui/pointer-angular';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    FormsModule,
    MatTableModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatIconModule,
    MatDialogModule,
    MatSelectModule,
    TranslocoModule,
  ],
  template: `
    <div class="roles-page">
      <div class="page-head">
        <h2>{{ 'roles.title' | transloco }}</h2>
        <button mat-flat-button color="primary" (click)="openAdd()">
          <mat-icon>add</mat-icon> {{ 'roles.addRole' | transloco }}
        </button>
      </div>

      @if (roles().length > 0) {
        <table mat-table [dataSource]="roles()" class="mat-elevation-z2 roles-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'roles.name' | transloco }}</th>
            <td mat-cell *matCellDef="let role">
              {{ role.name }}
              @if (role.isSystem) {
                <span class="chip chip-neutral system-chip">{{ 'roles.system' | transloco }}</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="grantsAdmin">
            <th mat-header-cell *matHeaderCellDef>{{ 'roles.grantsAdmin' | transloco }}</th>
            <td mat-cell *matCellDef="let role">
              <mat-slide-toggle
                [checked]="role.grantsAdmin"
                [disabled]="role.isSystem"
                (change)="toggleGrantsAdmin(role, $event.checked)"
              />
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>{{ 'roles.status' | transloco }}</th>
            <td mat-cell *matCellDef="let role">
              <span class="chip" [class.chip-active]="role.isActive" [class.chip-disabled]="!role.isActive">
                {{ (role.isActive ? 'common.active' : 'common.disabled') | transloco }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>{{ 'roles.actions' | transloco }}</th>
            <td mat-cell *matCellDef="let role">
              @if (!role.isSystem) {
                <button mat-stroked-button (click)="renameRole(role)" style="margin-inline-end:8px">
                  <mat-icon>edit</mat-icon> {{ 'common.rename' | transloco }}
                </button>
                <button
                  mat-stroked-button
                  [color]="role.isActive ? 'warn' : 'primary'"
                  (click)="toggleActive(role)"
                  style="margin-inline-end:8px"
                >
                  <mat-icon>{{ role.isActive ? 'block' : 'check_circle' }}</mat-icon>
                  {{ role.isActive ? ('common.disable' | transloco) : ('common.enable' | transloco) }}
                </button>
                <button mat-stroked-button color="warn" (click)="openDelete(role)">
                  <mat-icon>delete</mat-icon> {{ 'roles.delete' | transloco }}
                </button>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      }
    </div>

    <!-- Add role dialog -->
    <ng-template #addDialog>
      <h2 mat-dialog-title>{{ 'roles.addRole' | transloco }}</h2>
      <mat-dialog-content>
        <div class="dialog-form">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'roles.name' | transloco }}</mat-label>
            <input matInput [(ngModel)]="newName" (keydown.enter)="addRole()" />
          </mat-form-field>
          <mat-checkbox [(ngModel)]="newGrantsAdmin">{{ 'roles.grantsAdmin' | transloco }}</mat-checkbox>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary" [disabled]="!newName.trim()" (click)="addRole()">
          <mat-icon>add</mat-icon> {{ 'roles.addRole' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>

    <!-- Delete role + delegate users dialog -->
    <ng-template #deleteDialog>
      <h2 mat-dialog-title>{{ 'roles.deleteTitle' | transloco }}</h2>
      <mat-dialog-content>
        <div class="dialog-form">
          <p>{{ 'roles.deleteIntro' | transloco: { name: deletingRole()?.name } }}</p>
          @if (targetRoles().length > 0) {
            <mat-form-field appearance="outline">
              <mat-label>{{ 'roles.reassignLabel' | transloco }}</mat-label>
              <mat-select [(ngModel)]="reassignTargetId">
                @for (r of targetRoles(); track r.id) {
                  <mat-option [value]="r.id">{{ r.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          } @else {
            <p class="muted">{{ 'roles.noTargets' | transloco }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button
          mat-flat-button
          color="warn"
          [disabled]="targetRoles().length > 0 && !reassignTargetId"
          (click)="deleteRole()"
        >
          <mat-icon>delete</mat-icon> {{ 'roles.delete' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>
  `,
  styles: [`
    .roles-page { padding: 24px; }
    .page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 12px; }
    .page-head h2 { margin: 0; }
    .roles-table { width: 100%; }
    .system-chip { margin-inline-start: 8px; font-size: 10px; }
    .dialog-form { display: flex; flex-direction: column; gap: 16px; min-width: 320px; padding-top: 8px; }
    .muted { color: #64748b; font-size: 13px; margin: 0; }
  `],
})
export class RolesComponent {
  private rolesService = inject(RolesService);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private dialog = inject(MatDialog);

  readonly addDialog = viewChild.required<TemplateRef<unknown>>('addDialog');
  readonly deleteDialog = viewChild.required<TemplateRef<unknown>>('deleteDialog');
  private dialogRef?: MatDialogRef<unknown>;

  rolesResource = getApiAdminRolesResource();
  roles = computed(() => this.rolesResource.value() ?? []);

  displayedColumns = ['name', 'grantsAdmin', 'status', 'actions'];

  newName = '';
  newGrantsAdmin = false;

  // Delete + delegate state. deletingRole is a signal so targetRoles recomputes.
  deletingRole = signal<RoleResponse | null>(null);
  reassignTargetId: number | null = null;
  // Valid reassignment targets: active, non-system roles other than the one being deleted.
  targetRoles = computed(() =>
    this.roles().filter((r) => r.isActive && !r.isSystem && r.id !== this.deletingRole()?.id),
  );

  openAdd() {
    this.newName = '';
    this.newGrantsAdmin = false;
    this.dialogRef = this.dialog.open(this.addDialog(), { width: '440px' });
  }

  addRole() {
    const name = this.newName.trim();
    if (!name) return;
    this.rolesService.postApiAdminRoles({ name, grantsAdmin: this.newGrantsAdmin }).subscribe({
      next: () => {
        this.dialogRef?.close();
        this.newName = '';
        this.newGrantsAdmin = false;
        this.rolesResource.reload();
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  toggleGrantsAdmin(role: RoleResponse, grantsAdmin: boolean) {
    this.rolesService.patchApiAdminRolesId(role.id!, { grantsAdmin }).subscribe({
      next: () => this.rolesResource.reload(),
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  renameRole(role: RoleResponse) {
    const name = window.prompt('New name for role:', role.name ?? '');
    if (!name || !name.trim() || name.trim() === role.name) return;
    this.rolesService.patchApiAdminRolesId(role.id!, { name: name.trim() }).subscribe({
      next: () => this.rolesResource.reload(),
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  toggleActive(role: RoleResponse) {
    if (role.isActive && !confirm(this.transloco.translate('common.confirmDisable', { name: role.name }))) return;
    this.rolesService.patchApiAdminRolesId(role.id!, { isActive: !role.isActive }).subscribe({
      next: () => this.rolesResource.reload(),
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  openDelete(role: RoleResponse) {
    this.deletingRole.set(role);
    this.reassignTargetId = null;
    this.dialogRef = this.dialog.open(this.deleteDialog(), { width: '440px' });
  }

  deleteRole() {
    const role = this.deletingRole();
    if (!role) return;
    // reassignToRoleId is only needed when the role actually has users; the API
    // validates and returns a 409 (shown via the snackbar) if it's required.
    const params = this.reassignTargetId ? { reassignToRoleId: this.reassignTargetId } : undefined;
    this.rolesService.deleteApiAdminRolesId(role.id!, params).subscribe({
      next: (res: { reassignedUsers?: number }) => {
        this.dialogRef?.close();
        const moved = res?.reassignedUsers ?? 0;
        const msg = this.transloco.translate('roles.deleted') + (moved ? ` (${moved})` : '');
        this.snack.open(msg, 'OK', { duration: 3000 });
        this.rolesResource.reload();
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }
}
