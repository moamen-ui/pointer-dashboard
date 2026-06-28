import { Component, inject, signal, TemplateRef, viewChild, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { UsersService, getApiAdminUsersResource } from '@moamen-ui/pointer-angular';
import { getApiAdminRolesResource } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import type { UserResponse, RoleResponse } from '@moamen-ui/pointer-angular';

type FilterStatus = 'Approved' | 'Pending' | 'Rejected';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatTableModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    TranslocoModule,
  ],
  template: `
    <div class="p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="m-0 text-[1.5em] font-bold">{{ 'users.title' | transloco }}</h2>
        <button mat-flat-button color="primary" (click)="openAdd()">
          <mat-icon>add</mat-icon> {{ 'users.addUser' | transloco }}
        </button>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <div class="mb-4 flex flex-wrap items-center gap-3">
        <span class="text-[0.85rem] text-muted">{{ 'users.filter' | transloco }}</span>
        <mat-button-toggle-group [value]="filter()" (change)="setFilter($event.value)" hideSingleSelectionIndicator>
          <mat-button-toggle value="Approved">{{ 'users.filterApproved' | transloco }}</mat-button-toggle>
          <mat-button-toggle value="Pending">
            {{ 'users.filterPending' | transloco }}
            @if (pendingCount()) { <span class="ms-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-stat-amber-bg px-[5px] text-[0.72rem] font-bold text-stat-amber">{{ pendingCount() }}</span> }
          </mat-button-toggle>
          <mat-button-toggle value="Rejected">{{ 'users.filterRejected' | transloco }}</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      @if (users().length === 0 && !loading()) {
        <p class="py-6 text-muted">{{ 'users.empty' | transloco }}</p>
      } @else {
        <table mat-table [dataSource]="users()" class="w-full mat-elevation-z2">
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>{{ 'users.email' | transloco }}</th>
            <td mat-cell *matCellDef="let user">{{ user.email }}</td>
          </ng-container>

          <ng-container matColumnDef="displayName">
            <th mat-header-cell *matHeaderCellDef>{{ 'users.name' | transloco }}</th>
            <td mat-cell *matCellDef="let user">{{ user.displayName }}</td>
          </ng-container>

          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>{{ 'users.role' | transloco }}</th>
            <td mat-cell *matCellDef="let user">
              @if (filter() === 'Approved') {
                <mat-select
                  [value]="user.roleId"
                  (selectionChange)="changeRole(user, $event.value)"
                  class="min-w-[120px]"
                >
                  @for (role of rolesForUser(user); track role.id) {
                    <mat-option [value]="role.id">{{ role.name }}</mat-option>
                  }
                </mat-select>
              } @else {
                <span>{{ user.roleName }}</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="requested">
            <th mat-header-cell *matHeaderCellDef>{{ 'overview.requested' | transloco }}</th>
            <td mat-cell *matCellDef="let user">{{ $any(user).createdAt ? ($any(user).createdAt | date:'mediumDate') : '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>{{ 'users.status' | transloco }}</th>
            <td mat-cell *matCellDef="let user">
              <span class="chip" [class.chip-active]="user.isActive" [class.chip-disabled]="!user.isActive">
                {{ user.isActive ? ('common.active' | transloco) : ('common.disabled' | transloco) }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>{{ 'users.actions' | transloco }}</th>
            <td mat-cell *matCellDef="let user">
              @if (filter() === 'Approved') {
                <button mat-stroked-button [color]="user.isActive ? 'warn' : 'primary'"
                  (click)="toggleActive(user)" [disabled]="loading()">
                  <mat-icon>{{ user.isActive ? 'block' : 'check_circle' }}</mat-icon>
                  {{ user.isActive ? ('common.disable' | transloco) : ('common.enable' | transloco) }}
                </button>
              } @else {
                <div class="flex items-center gap-2">
                  <button mat-flat-button color="primary" [matMenuTriggerFor]="approveMenu"
                    (menuOpened)="approveSelection[user.id!] = user.roleId" [disabled]="loading()">
                    <mat-icon>how_to_reg</mat-icon> {{ 'users.approve' | transloco }}
                  </button>
                  <mat-menu #approveMenu="matMenu">
                    <div class="flex min-w-[200px] flex-col gap-2.5 p-3" (click)="$event.stopPropagation()">
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                        <mat-label>{{ 'users.approveAs' | transloco }}</mat-label>
                        <mat-select [(value)]="approveSelection[user.id!]">
                          @for (r of activeRoles(); track r.id) {
                            <mat-option [value]="r.id">{{ r.name }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                      <button mat-flat-button color="primary" class="w-full"
                        (click)="approve(user)" [disabled]="loading()">
                        {{ 'users.confirm' | transloco }}
                      </button>
                    </div>
                  </mat-menu>
                  @if (filter() === 'Pending') {
                    <button mat-stroked-button color="warn" (click)="reject(user)" [disabled]="loading()">
                      <mat-icon>block</mat-icon> {{ 'users.reject' | transloco }}
                    </button>
                  }
                </div>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns();"></tr>
        </table>
      }
    </div>

    <!-- Add user dialog -->
    <ng-template #addDialog>
      <h2 mat-dialog-title>{{ 'users.addUser' | transloco }}</h2>
      <mat-dialog-content>
        <form [formGroup]="addForm" (ngSubmit)="addUser()" class="flex min-w-80 flex-col gap-3 pt-2">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'users.email' | transloco }}</mat-label>
            <input matInput type="email" formControlName="email" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'users.displayName' | transloco }}</mat-label>
            <input matInput formControlName="displayName" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'users.password' | transloco }}</mat-label>
            <input matInput type="password" formControlName="password" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'users.role' | transloco }}</mat-label>
            <mat-select formControlName="roleId">
              @for (role of activeRoles(); track role.id) {
                <mat-option [value]="role.id">{{ role.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary" (click)="addUser()" [disabled]="addForm.invalid || loading()">
          <mat-icon>add</mat-icon> {{ 'users.addUser' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>
  `,
})
export class UsersComponent {
  private usersService = inject(UsersService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private transloco = inject(TranslocoService);
  private dialog = inject(MatDialog);

  readonly addDialog = viewChild.required<TemplateRef<unknown>>('addDialog');
  private dialogRef?: MatDialogRef<unknown>;

  filter = signal<FilterStatus>('Approved');

  usersResource = getApiAdminUsersResource(
    computed(() => ({ status: this.filter().toLowerCase() || undefined })),
  );
  pendingResource = getApiAdminUsersResource(signal({ status: 'pending' }));
  rolesResource = getApiAdminRolesResource();

  users = computed(() => this.usersResource.value() ?? []);
  roles = computed(() => this.rolesResource.value() ?? []);
  pendingCount = computed(() => this.pendingResource.value()?.length ?? 0);
  busy = signal(false);
  loading = computed(() => this.usersResource.isLoading() || this.busy());

  approveSelection: Record<number, number> = {};

  displayedColumns() {
    return this.filter() === 'Approved'
      ? ['email', 'displayName', 'role', 'status', 'actions']
      : ['email', 'displayName', 'role', 'requested', 'status', 'actions'];
  }

  addForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    displayName: ['', Validators.required],
    password: ['', Validators.required],
    roleId: [0 as number, [Validators.required, Validators.min(1)]],
  });

  activeRoles() {
    return this.roles().filter(r => r.isActive);
  }

  rolesForUser(user: UserResponse): RoleResponse[] {
    const active = this.roles().filter(r => r.isActive);
    const current = this.roles().find(r => r.id === user.roleId);
    if (current && !current.isActive) {
      return [current, ...active];
    }
    return active;
  }

  setFilter(status: FilterStatus) {
    this.filter.set(status);
  }

  openAdd() {
    const firstRole = this.activeRoles()[0]?.id ?? 0;
    this.addForm.reset({ email: '', displayName: '', password: '', roleId: firstRole });
    this.dialogRef = this.dialog.open(this.addDialog(), { width: '440px' });
  }

  addUser() {
    if (this.addForm.invalid) return;
    this.busy.set(true);
    const val = this.addForm.getRawValue();
    this.usersService.postApiAdminUsers(val).subscribe({
      next: () => {
        this.dialogRef?.close();
        this.addForm.reset();
        this.busy.set(false);
        this.usersResource.reload();
        this.pendingResource.reload();
      },
      error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
    });
  }

  changeRole(user: UserResponse, roleId: number) {
    this.busy.set(true);
    this.usersService.patchApiAdminUsersId(user.id!, { roleId }).subscribe({
      next: () => { this.busy.set(false); this.usersResource.reload(); },
      error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); this.usersResource.reload(); },
    });
  }

  toggleActive(user: UserResponse) {
    if (!user.isActive) {
      this.patchActive(user, true);
      return;
    }
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          message: this.transloco.translate('common.confirmDisable', { name: user.email }),
          confirmLabel: this.transloco.translate('common.disable'),
          confirmColor: 'warn',
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) this.patchActive(user, false);
      });
  }

  private patchActive(user: UserResponse, isActive: boolean) {
    this.busy.set(true);
    this.usersService.patchApiAdminUsersId(user.id!, { isActive }).subscribe({
      next: () => { this.busy.set(false); this.usersResource.reload(); },
      error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
    });
  }

  approve(user: UserResponse) {
    const roleId = this.approveSelection[user.id!] ?? user.roleId;
    this.busy.set(true);
    this.usersService.postApiAdminUsersIdApprove(user.id!, { roleId }).subscribe({
      next: () => {
        this.busy.set(false);
        this.usersResource.reload();
        this.pendingResource.reload();
      },
      error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
    });
  }

  reject(user: UserResponse) {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          message: this.transloco.translate('users.confirmReject', { name: user.email }),
          confirmLabel: this.transloco.translate('users.reject'),
          confirmColor: 'warn',
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.busy.set(true);
        this.usersService.postApiAdminUsersIdReject(user.id!).subscribe({
          next: () => {
            this.busy.set(false);
            this.usersResource.reload();
            this.pendingResource.reload();
          },
          error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
        });
      });
  }
}
