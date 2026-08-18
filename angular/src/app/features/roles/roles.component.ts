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
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { RolesService, getApiAdminRolesResource } from '@moamen-ui/pointer-angular';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { extractMessage } from '../../core/api/extract-message';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
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
    MatMenuModule,
    MatDialogModule,
    MatSelectModule,
    TranslocoModule,
    EmptyStateComponent,
  ],
  template: `
    <div class="p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="m-0 text-[1.5em] font-bold">{{ 'roles.title' | transloco }}</h2>
        <button mat-flat-button color="primary" (click)="openAdd()">
          <mat-icon>add</mat-icon> {{ 'roles.addRole' | transloco }}
        </button>
      </div>

      @if (roles().length === 0) {
        <app-empty-state
          icon="manage_accounts"
          [message]="'roles.empty' | transloco"
          [hint]="'roles.emptyHint' | transloco"
        >
          <button mat-flat-button color="primary" (click)="openAdd()">
            <mat-icon>add</mat-icon> {{ 'roles.addRole' | transloco }}
          </button>
        </app-empty-state>
      } @else {
        <table mat-table [dataSource]="roles()" class="w-full mat-elevation-z2">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'roles.name' | transloco }}</th>
            <td mat-cell *matCellDef="let role">
              {{ role.name }}
              @if (role.isSystem) {
                <span class="chip chip-neutral ms-2 text-[10px]">{{ 'roles.system' | transloco }}</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="grantsAdmin">
            <th mat-header-cell *matHeaderCellDef>{{ 'roles.grantsAdmin' | transloco }}</th>
            <td mat-cell *matCellDef="let role">
              <mat-slide-toggle
                class="dense-toggle"
                hideIcon
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
              @if (canManage(role)) {
                <button mat-icon-button [matMenuTriggerFor]="rowMenu"
                  [attr.aria-label]="'roles.actions' | transloco">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #rowMenu="matMenu">
                  <button mat-menu-item (click)="renameRole(role)">
                    <mat-icon>edit</mat-icon> {{ 'common.rename' | transloco }}
                  </button>
                  <button mat-menu-item (click)="toggleActive(role)"
                    [class.!text-red-600]="role.isActive">
                    <mat-icon [class.!text-red-600]="role.isActive">{{ role.isActive ? 'block' : 'check_circle' }}</mat-icon>
                    {{ role.isActive ? ('common.disable' | transloco) : ('common.enable' | transloco) }}
                  </button>
                  <button mat-menu-item class="!text-red-600" (click)="openDelete(role)">
                    <mat-icon class="!text-red-600">delete</mat-icon> {{ 'roles.delete' | transloco }}
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

    <!-- Add role dialog -->
    <ng-template #addDialog>
      <h2 mat-dialog-title>{{ 'roles.addRole' | transloco }}</h2>
      <mat-dialog-content>
        <div class="flex min-w-80 flex-col gap-4 pt-2">
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
        <div class="flex min-w-80 flex-col gap-4 pt-2">
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
            <p class="m-0 text-[13px] text-muted">{{ 'roles.noTargets' | transloco }}</p>
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

    <!-- Rename role dialog -->
    <ng-template #renameDialog>
      <h2 mat-dialog-title>{{ 'common.rename' | transloco }}</h2>
      <mat-dialog-content>
        <div class="flex min-w-80 flex-col gap-4 pt-2">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'roles.name' | transloco }}</mat-label>
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
  // A full-size M3 switch overpowers a table cell, so the in-table toggle runs at
  // ~2/3 scale. Every size token is scaled by the same factor (52px track → 36px)
  // so the handle keeps its travel and stays centred in both states; these are
  // host-level CSS variables, which scoped styles can set (the element is ours).
  styles: [`
    .dense-toggle {
      --mat-slide-toggle-track-width: 36px;
      --mat-slide-toggle-track-height: 20px;
      --mat-slide-toggle-state-layer-size: 28px;
      --mat-slide-toggle-unselected-handle-size: 12px;
      --mat-slide-toggle-selected-handle-size: 16px;
      --mat-slide-toggle-with-icon-handle-size: 16px;
      --mat-slide-toggle-pressed-handle-size: 18px;
      --mat-slide-toggle-unselected-handle-horizontal-margin: 0 5px;
      --mat-slide-toggle-selected-handle-horizontal-margin: 0 17px;
      --mat-slide-toggle-selected-with-icon-handle-horizontal-margin: 0 17px;
      --mat-slide-toggle-unselected-with-icon-handle-horizontal-margin: 0 3px;
      --mat-slide-toggle-unselected-pressed-handle-horizontal-margin: 0 1px;
      --mat-slide-toggle-selected-pressed-handle-horizontal-margin: 0 15px;
    }
  `],
})
export class RolesComponent {
  private rolesService = inject(RolesService);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private dialog = inject(MatDialog);
  private auth = inject(AuthService);

  readonly addDialog = viewChild.required<TemplateRef<unknown>>('addDialog');
  readonly deleteDialog = viewChild.required<TemplateRef<unknown>>('deleteDialog');
  readonly renameDialog = viewChild.required<TemplateRef<unknown>>('renameDialog');
  private dialogRef?: MatDialogRef<unknown>;

  rolesResource = getApiAdminRolesResource();

  /**
   * Roles this page can actually manage. System roles (e.g. Admin) are immutable —
   * RoleService answers 409 SystemImmutable on any rename/disable/delete — and they
   * belong to the platform, not the workspace, so listing them to a workspace admin
   * is noise they cannot act on. A super-admin still sees them.
   */
  roles = computed(() => {
    const all = this.rolesResource.value() ?? [];
    return this.auth.isSuperAdmin() ? all : all.filter((r) => this.canManage(r));
  });

  /**
   * Whether the signed-in user may act on this role. The API computes it
   * (RoleResponse.CanManage) from the same guards Update/Delete enforce: system roles
   * are immutable, and a scoped admin may only touch roles its own tenant owns — the
   * query filter deliberately lets it SEE global roles it cannot manage. Falls back to
   * !isSystem so an older API still behaves as before. Typed from the next client publish.
   */
  canManage(role: RoleResponse): boolean {
    return (role as { canManage?: boolean }).canManage ?? !role.isSystem;
  }

  displayedColumns = ['name', 'grantsAdmin', 'status', 'actions'];

  newName = '';
  newGrantsAdmin = false;

  // Rename state.
  editingRole = signal<RoleResponse | null>(null);
  editName = '';

  // Delete + delegate state. deletingRole is a signal so targetRoles recomputes.
  deletingRole = signal<RoleResponse | null>(null);
  reassignTargetId: number | null = null;
  // Valid reassignment targets: active, non-system roles other than the one being deleted.
  // Reassignment targets: the API resolves the target with its own ownership/escalation
  // guard, so offer only roles this caller may actually manage — otherwise the delete
  // fails after the user has already picked a target.
  targetRoles = computed(() =>
    this.roles().filter(
      (r) => r.isActive && this.canManage(r) && r.id !== this.deletingRole()?.id,
    ),
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
    this.editingRole.set(role);
    this.editName = role.name ?? '';
    this.dialogRef = this.dialog.open(this.renameDialog(), { width: '440px' });
  }

  saveRename() {
    const role = this.editingRole();
    const name = this.editName.trim();
    if (!role || !name || name === role.name) {
      this.dialogRef?.close();
      return;
    }
    this.rolesService.patchApiAdminRolesId(role.id!, { name }).subscribe({
      next: () => {
        this.dialogRef?.close();
        this.rolesResource.reload();
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  toggleActive(role: RoleResponse) {
    if (!role.isActive) {
      this.patchActive(role, true);
      return;
    }
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          message: this.transloco.translate('common.confirmDisable', { name: role.name }),
          confirmLabel: this.transloco.translate('common.disable'),
          confirmColor: 'warn',
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) this.patchActive(role, false);
      });
  }

  private patchActive(role: RoleResponse, isActive: boolean) {
    this.rolesService.patchApiAdminRolesId(role.id!, { isActive }).subscribe({
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
