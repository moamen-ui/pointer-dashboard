import { Component, inject, signal, TemplateRef, viewChild, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { BidiModule } from '@angular/cdk/bidi';
import { RolesService, getApiAdminRolesResource } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import type { RowActionItem } from '../../shared/row-actions-menu/row-actions-menu.component';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppIconComponent } from '../../shared/ui/app-icon.component';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppCheckboxComponent } from '../../shared/ui/app-checkbox.component';
import { AppSelectComponent, type SelectOption } from '../../shared/ui/app-select.component';
import { AppFormFieldComponent } from '../../shared/ui/app-form-field.component';
import { AppToastService } from '../../shared/ui/app-toast.service';
import { AppDialogService } from '../../shared/ui/app-dialog.service';
import type { RoleResponse } from '@moamen-ui/pointer-angular';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    BidiModule,
    FormsModule,
    TranslocoModule,
    BadgeComponent,
    AppButtonDirective,
    AppIconComponent,
    AppInputDirective,
    AppCheckboxComponent,
    AppSelectComponent,
    AppFormFieldComponent,
  ],
  template: `
    <div class="space-y-6">
      <!-- Title row with Add button -->
      <div class="flex items-center justify-between gap-4 mb-4">
        <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
          {{ 'roles.title' | transloco }}
        </h1>
        <button
          appButton
          variant="primary"
          size="default"
          (click)="openAdd()"
        >
          <app-icon name="plus" [size]="16"></app-icon>
          {{ 'roles.addRole' | transloco }}
        </button>
      </div>

      <!-- Roles table -->
      <div class="rounded-md border border-border overflow-x-auto">
        @if (roles().length > 0) {
          <table class="w-full border-collapse">
            <thead>
              <tr class="h-10 bg-gutter text-[13px] font-medium text-muted-foreground border-b border-border">
                <th class="w-10 text-end font-mono text-[12px] text-faint-foreground px-3"></th>
                <th class="px-3 text-start">{{ 'roles.name' | transloco }}</th>
                <th class="px-3 text-start">{{ 'roles.grantsAdmin' | transloco }}</th>
                <th class="px-3 text-start">{{ 'roles.quickAccess' | transloco }}</th>
                <th class="px-3 text-start">{{ 'roles.status' | transloco }}</th>
                <th class="w-8"></th>
              </tr>
            </thead>
            <tbody>
              @for (role of roles(); track role.id; let idx = $index) {
                <tr class="h-11 border-t border-border-muted hover:bg-gutter/60 transition-colors">
                  <td class="w-10 text-end font-mono text-[12px] text-faint-foreground px-3">{{ idx + 1 }}</td>
                  <td class="px-3">
                    <div class="text-[14px] font-medium text-foreground">
                      {{ role.name }}
                      @if (role.isSystem) {
                        <span class="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] font-medium ms-2 text-state-archived bg-state-archived-tint border-state-archived/30">
                          {{ 'roles.system' | transloco }}
                        </span>
                      }
                    </div>
                  </td>
                  <td class="px-3">
                    <!-- Toggle button: the glyph shows the state, a click flips it (keeps the old inline switch behavior). -->
                    @if (canManage(role) && !role.isSystem) {
                      <button
                        type="button"
                        role="switch"
                        [attr.aria-checked]="!!role.grantsAdmin"
                        [attr.aria-label]="'roles.grantsAdmin' | transloco"
                        class="inline-flex h-8 w-8 items-center justify-center rounded-md text-faint-foreground transition-colors hover:bg-gutter hover:text-foreground"
                        (click)="toggleGrantsAdmin(role, !role.grantsAdmin)"
                      >
                        @if (role.grantsAdmin) {
                          <app-icon name="circle-check" [size]="16" class="text-state-completed"></app-icon>
                        } @else {
                          <span aria-hidden="true">—</span>
                        }
                      </button>
                    } @else if (role.grantsAdmin) {
                      <span class="inline-flex h-8 w-8 items-center justify-center"><app-icon name="circle-check" [size]="16" class="text-state-completed"></app-icon></span>
                    } @else {
                      <span class="inline-flex h-8 w-8 items-center justify-center text-faint-foreground">—</span>
                    }
                  </td>
                  <td class="px-3">
                    <!-- Toggle button: the glyph shows the state, a click flips it (keeps the old inline switch behavior). -->
                    @if (canManage(role) && !role.isSystem) {
                      <button
                        type="button"
                        role="switch"
                        [attr.aria-checked]="!!role.quickAccess"
                        [attr.aria-label]="'roles.quickAccess' | transloco"
                        class="inline-flex h-8 w-8 items-center justify-center rounded-md text-faint-foreground transition-colors hover:bg-gutter hover:text-foreground"
                        (click)="toggleQuickAccess(role, !role.quickAccess)"
                      >
                        @if (role.quickAccess) {
                          <app-icon name="circle-check" [size]="16" class="text-state-completed"></app-icon>
                        } @else {
                          <span aria-hidden="true">—</span>
                        }
                      </button>
                    } @else if (role.quickAccess) {
                      <span class="inline-flex h-8 w-8 items-center justify-center"><app-icon name="circle-check" [size]="16" class="text-state-completed"></app-icon></span>
                    } @else {
                      <span class="inline-flex h-8 w-8 items-center justify-center text-faint-foreground">—</span>
                    }
                  </td>
                  <td class="px-3">
                    <app-badge [severity]="role.isActive ? 'success' : 'neutral'">
                      {{ (role.isActive ? 'common.active' : 'common.disabled') | transloco }}
                    </app-badge>
                  </td>
                  <td class="px-3 text-end">
                    @if (canToggleActive(role)) {
                      <button
                        appButton
                        variant="ghost"
                        size="icon"
                        [attr.aria-label]="'common.actions' | transloco"
                        (click)="openRowMenu(role, $event)"
                      >
                        <app-icon name="ellipsis-vertical" [size]="16"></app-icon>
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <table class="w-full border-collapse">
            <thead>
              <tr class="h-10 bg-gutter text-[13px] font-medium text-muted-foreground border-b border-border">
                <th class="w-10 text-end font-mono text-[12px] text-faint-foreground px-3"></th>
                <th class="px-3 text-start">{{ 'roles.name' | transloco }}</th>
                <th class="px-3 text-start">{{ 'roles.grantsAdmin' | transloco }}</th>
                <th class="px-3 text-start">{{ 'roles.quickAccess' | transloco }}</th>
                <th class="px-3 text-start">{{ 'roles.status' | transloco }}</th>
                <th class="w-8"></th>
              </tr>
            </thead>
            <tbody>
              <tr class="h-11 border-t border-dashed border-border-muted">
                <td class="px-3 text-[14px] text-muted-foreground">
                  {{ 'roles.empty' | transloco }}
                </td>
                <td colspan="100" class="text-end pe-3">
                  <button
                    appButton
                    variant="primary"
                    size="sm"
                    (click)="openAdd()"
                  >
                    {{ 'roles.addRole' | transloco }}
                  </button>
                </td>
              </tr>
              <tr class="h-11 border-t border-dashed border-border-muted"></tr>
              <tr class="h-11 border-t border-dashed border-border-muted"></tr>
            </tbody>
          </table>
        }
      </div>
    </div>

    <!-- Add role dialog -->
    <ng-template #addDialog>
      <div class="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog">
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-[16px] font-semibold leading-6">{{ 'roles.addRole' | transloco }}</h2>
        </div>
        <div class="px-5 py-2 space-y-4">
          <app-form-field [label]="'roles.name' | transloco">
            <input
              appInput
              [(ngModel)]="newName"
              (keydown.enter)="addRole()"
              [placeholder]="'roles.name' | transloco"
            />
          </app-form-field>
          <label class="flex items-center gap-2 cursor-pointer">
            <app-checkbox [(checked)]="newGrantsAdmin"></app-checkbox>
            <span class="text-[14px] font-medium text-foreground">{{ 'roles.grantsAdmin' | transloco }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <app-checkbox [(checked)]="newQuickAccess"></app-checkbox>
            <span class="text-[14px] font-medium text-foreground">{{ 'roles.quickAccess' | transloco }}</span>
          </label>
          @if (newQuickAccess) {
            <p class="text-[13px] text-muted-foreground">{{ 'roles.quickAccessHint' | transloco }}</p>
          }
        </div>
        <div class="px-5 pb-5 pt-3 flex justify-end gap-2">
          <button appButton variant="secondary" size="sm" (click)="closeDialog()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            appButton
            variant="primary"
            size="sm"
            [disabled]="!newName.trim()"
            (click)="addRole()"
          >
            <app-icon name="plus" [size]="16"></app-icon>
            {{ 'roles.addRole' | transloco }}
          </button>
        </div>
      </div>
    </ng-template>

    <!-- Delete role + delegate users dialog -->
    <ng-template #deleteDialog>
      <div class="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog">
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-[16px] font-semibold leading-6">{{ 'roles.deleteTitle' | transloco }}</h2>
        </div>
        <div class="px-5 py-2 space-y-4">
          <p class="text-[14px] text-foreground">
            {{ 'roles.deleteIntro' | transloco: { name: deletingRole()?.name } }}
          </p>
          @if (targetRoles().length > 0) {
            <app-form-field [label]="'roles.reassignLabel' | transloco">
              <app-select
                [options]="reassignOptions()"
                [value]="reassignTargetId"
                (valueChange)="reassignTargetId = $event"
              ></app-select>
            </app-form-field>
          } @else {
            <p class="text-[13px] text-muted-foreground">{{ 'roles.noTargets' | transloco }}</p>
          }
        </div>
        <div class="px-5 pb-5 pt-3 flex justify-end gap-2">
          <button appButton variant="secondary" size="sm" (click)="closeDialog()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            appButton
            variant="destructive"
            size="sm"
            [disabled]="targetRoles().length > 0 && !reassignTargetId"
            (click)="deleteRole()"
          >
            <app-icon name="trash-2" [size]="16"></app-icon>
            {{ 'roles.delete' | transloco }}
          </button>
        </div>
      </div>
    </ng-template>

    <!-- Rename role dialog -->
    <ng-template #renameDialog>
      <div class="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog">
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-[16px] font-semibold leading-6">{{ 'common.rename' | transloco }}</h2>
        </div>
        <div class="px-5 py-2 space-y-4">
          <app-form-field [label]="'roles.name' | transloco">
            <input
              appInput
              [(ngModel)]="editName"
              (keydown.enter)="saveRename()"
              [placeholder]="'roles.name' | transloco"
            />
          </app-form-field>
        </div>
        <div class="px-5 pb-5 pt-3 flex justify-end gap-2">
          <button appButton variant="secondary" size="sm" (click)="closeDialog()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            appButton
            variant="primary"
            size="sm"
            [disabled]="!editName.trim()"
            (click)="saveRename()"
          >
            {{ 'common.save' | transloco }}
          </button>
        </div>
      </div>
    </ng-template>
  `,
})
export class RolesComponent {
  private rolesService = inject(RolesService);
  private toast = inject(AppToastService);
  private transloco = inject(TranslocoService);
  private confirm = inject(ConfirmService);
  private auth = inject(AuthService);
  private appDialog = inject(AppDialogService);

  readonly addDialog = viewChild.required<TemplateRef<unknown>>('addDialog');
  readonly deleteDialog = viewChild.required<TemplateRef<unknown>>('deleteDialog');
  readonly renameDialog = viewChild.required<TemplateRef<unknown>>('renameDialog');
  private dialogRef?: any;

  rolesResource = getApiAdminRolesResource();

  /**
   * Roles this page shows at all. System roles (e.g. Admin, Workspace Admin) are immutable
   * platform roles, not workspace ones, so listing them to a scoped admin is noise they can
   * never act on — filtered out via canToggleActive, which is false for every system role. A
   * GLOBAL, non-system role (e.g. the seeded "Tester") DOES show, though: a scoped admin can
   * still toggle it on/off for their own workspace via a per-tenant override, even without
   * fully owning it. A super-admin sees everything, system roles included.
   */
  roles = computed(() => {
    const all = this.rolesResource.value() ?? [];
    return this.auth.isSuperAdmin() ? all : all.filter((r) => this.canToggleActive(r));
  });

  /**
   * Whether the signed-in user may fully manage this role (rename/delete/reconfigure). The API
   * computes it (RoleResponse.CanManage): system roles are immutable for everyone, and a scoped
   * admin may only fully own roles its own tenant created. Falls back to !isSystem so an older
   * API still behaves as before.
   */
  canManage(role: RoleResponse): boolean {
    return (role as { canManage?: boolean }).canManage ?? !role.isSystem;
  }

  /**
   * Whether the signed-in user may at least flip this role's active status — true for
   * everything canManage() covers, PLUS a GLOBAL, non-system role a scoped admin doesn't own
   * (toggled via a per-tenant override server-side, never touching the shared row). False for
   * every system role, for everyone but a super admin.
   */
  toggleGrantsAdmin(role: RoleResponse, grantsAdmin: boolean) {
    this.rolesService.patchApiAdminRolesId(role.id!, { grantsAdmin }).subscribe({
      next: () => this.rolesResource.reload(),
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }

  toggleQuickAccess(role: RoleResponse, quickAccess: boolean) {
    this.rolesService.patchApiAdminRolesId(role.id!, { quickAccess }).subscribe({
      next: () => this.rolesResource.reload(),
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }

  canToggleActive(role: RoleResponse): boolean {
    return (role as { canToggleActive?: boolean }).canToggleActive ?? this.canManage(role);
  }

  newName = '';
  newGrantsAdmin = false;
  newQuickAccess = false;

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

  reassignOptions = computed<SelectOption<number>[]>(() =>
    this.targetRoles().map((r) => ({ label: r.name ?? '', value: r.id ?? 0 })),
  );

  openAdd() {
    this.newName = '';
    this.newGrantsAdmin = false;
    this.newQuickAccess = false;
    this.dialogRef = this.appDialog.openRef(this.addDialog());
  }

  closeDialog() {
    this.dialogRef?.close();
  }

  addRole() {
    const name = this.newName.trim();
    if (!name) return;
    this.rolesService
      .postApiAdminRoles({ name, grantsAdmin: this.newGrantsAdmin, quickAccess: this.newQuickAccess })
      .subscribe({
        next: () => {
          this.dialogRef?.close();
          this.newName = '';
          this.newGrantsAdmin = false;
          this.newQuickAccess = false;
          this.rolesResource.reload();
          this.toast.show(this.transloco.translate('roles.created'), 'success');
        },
        error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
      });
  }

  openRowMenu(role: RoleResponse, event: MouseEvent) {
    event.stopPropagation();
    const items: RowActionItem[] = [];
    if (this.canManage(role)) {
      items.push({
        label: this.transloco.translate('common.rename'),
        icon: 'pencil',
        onClick: () => this.renameRole(role),
      });
    }
    items.push({
      label: this.transloco.translate(role.isActive ? 'common.disable' : 'common.enable'),
      icon: role.isActive ? 'ban' : 'check-circle-2',
      severity: role.isActive ? 'danger' : 'primary',
      onClick: () => this.toggleActive(role),
    });
    if (this.canManage(role)) {
      items.push({
        label: this.transloco.translate('roles.delete'),
        icon: 'trash-2',
        severity: 'danger',
        onClick: () => this.openDelete(role),
      });
    }
    // Would need to integrate app-menu component or use MatMenu for row actions
    // For now, handle actions directly in onClick
  }

  renameRole(role: RoleResponse) {
    this.editingRole.set(role);
    this.editName = role.name ?? '';
    this.dialogRef = this.appDialog.openRef(this.renameDialog());
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
        this.toast.show(this.transloco.translate('common.saved'), 'success');
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }

  toggleActive(role: RoleResponse) {
    if (!role.isActive) {
      this.patchActive(role, true);
      return;
    }
    this.confirm
      .confirm({
        message: this.transloco.translate('common.confirmDisable', { name: role.name }),
        confirmLabel: this.transloco.translate('common.disable'),
        confirmColor: 'danger',
      })
      .subscribe((ok) => {
        if (ok) this.patchActive(role, false);
      });
  }

  private patchActive(role: RoleResponse, isActive: boolean) {
    this.rolesService.patchApiAdminRolesId(role.id!, { isActive }).subscribe({
      next: () => this.rolesResource.reload(),
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }

  openDelete(role: RoleResponse) {
    this.deletingRole.set(role);
    this.reassignTargetId = null;
    this.dialogRef = this.appDialog.openRef(this.deleteDialog());
  }

  deleteRole() {
    const role = this.deletingRole();
    if (!role) return;
    // reassignToRoleId is only needed when the role actually has users; the API
    // validates and returns a 409 (shown via the toast) if it's required.
    const params = this.reassignTargetId ? { reassignToRoleId: this.reassignTargetId } : undefined;
    this.rolesService.deleteApiAdminRolesId(role.id!, params).subscribe({
      next: (res: { reassignedUsers?: number }) => {
        this.dialogRef?.close();
        const moved = res?.reassignedUsers ?? 0;
        const msg = this.transloco.translate('roles.deleted') + (moved ? ` (${moved})` : '');
        this.toast.show(msg, 'success');
        this.rolesResource.reload();
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }
}
