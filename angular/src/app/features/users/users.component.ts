import { Component, inject, signal, TemplateRef, viewChild, computed } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
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
import { InvitesService, getApiAdminInvitesResource } from '@moamen-ui/pointer-angular';
import { getApiAdminTenantsResource } from '@moamen-ui/pointer-angular';
import { getApiAdminProjectsResource } from '@moamen-ui/pointer-angular';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { extractMessage } from '../../core/api/extract-message';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { PasswordToggleComponent } from '../../shared/password-toggle.component';
import { AuthService } from '../../core/auth/auth.service';
import type { UserResponse, RoleResponse, InviteResponse } from '@moamen-ui/pointer-angular';

const DEPUTY_ROLE_NAME = 'Workspace Admin Deputy';
const WORKSPACE_ADMIN_ROLE_NAME = 'Workspace Admin';

type FilterStatus = 'Approved' | 'Pending' | 'Rejected';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    RouterLink,
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
    PasswordToggleComponent,
    EmptyStateComponent,
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

      @if (displayedRows().length === 0 && !loading()) {
        <app-empty-state
          icon="people"
          [message]="'users.empty' | transloco"
          [hint]="'users.emptyHint' | transloco"
        >
          <button mat-flat-button color="primary" (click)="openAdd()">
            <mat-icon>add</mat-icon> {{ 'users.addUser' | transloco }}
          </button>
        </app-empty-state>
      } @else {
        <table mat-table [dataSource]="displayedRows()" class="w-full mat-elevation-z2">
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>{{ 'users.email' | transloco }}</th>
            <td mat-cell *matCellDef="let row">
              @if (isInvite(row)) {
                {{ row.email || ('invite.anyone' | transloco) }}
              } @else {
                {{ row.email }}
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="displayName">
            <th mat-header-cell *matHeaderCellDef>{{ 'users.name' | transloco }}</th>
            <td mat-cell *matCellDef="let row">
              @if (isInvite(row)) {
                —
              } @else {
                {{ row.displayName }}
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>{{ 'users.role' | transloco }}</th>
            <td mat-cell *matCellDef="let row">
              @if (isInvite(row)) {
                <span>{{ row.roleName ?? '—' }}</span>
              } @else if (filter() === 'Approved') {
                <mat-select
                  [value]="row.roleId"
                  (selectionChange)="changeRole(row, $event.value)"
                  class="min-w-[120px]"
                >
                  @for (role of rolesForUser(row); track role.id) {
                    <mat-option [value]="role.id">{{ role.name }}</mat-option>
                  }
                </mat-select>
              } @else {
                <span>{{ row.roleName }}</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="requested">
            <th mat-header-cell *matHeaderCellDef>{{ 'overview.requested' | transloco }}</th>
            <td mat-cell *matCellDef="let row">
              @if (isInvite(row)) {
                {{ 'invite.expires' | transloco }}: {{ row.expiresAt | date:'mediumDate' }}
              } @else {
                {{ row.createdAt ? (row.createdAt | date:'dd-MM-yyyy HH:mm') : '—' }}
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>{{ 'users.status' | transloco }}</th>
            <td mat-cell *matCellDef="let row">
              @if (isInvite(row)) {
                <span class="chip chip-neutral">{{ 'invite.invited' | transloco }}</span>
              } @else {
                <span class="chip" [class.chip-active]="row.isActive" [class.chip-disabled]="!row.isActive">
                  {{ row.isActive ? ('common.active' | transloco) : ('common.disabled' | transloco) }}
                </span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>{{ 'users.actions' | transloco }}</th>
            <td mat-cell *matCellDef="let row">
              @if (isInvite(row)) {
                <button mat-icon-button [matMenuTriggerFor]="inviteMenu"
                  [attr.aria-label]="'users.actions' | transloco">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #inviteMenu="matMenu">
                  <button mat-menu-item [disabled]="!row.url" (click)="copyInviteUrl(row.url!)">
                    <mat-icon>content_copy</mat-icon> {{ 'invite.copy' | transloco }}
                  </button>
                  <button mat-menu-item class="!text-red-600" (click)="revokeInvite(row)">
                    <mat-icon class="!text-red-600">link_off</mat-icon> {{ 'invite.revoke' | transloco }}
                  </button>
                </mat-menu>
              } @else {
                <button mat-icon-button [matMenuTriggerFor]="rowMenu"
                  [attr.aria-label]="'users.actions' | transloco">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #rowMenu="matMenu">
                  @if (filter() === 'Approved') {
                    <button mat-menu-item (click)="toggleActive(row)" [disabled]="loading()"
                      [class.!text-red-600]="row.isActive">
                      <mat-icon [class.!text-red-600]="row.isActive">{{ row.isActive ? 'block' : 'check_circle' }}</mat-icon>
                      {{ row.isActive ? ('common.disable' | transloco) : ('common.enable' | transloco) }}
                    </button>
                    <a mat-menu-item [routerLink]="['/users', row.id, 'profile']">
                      <mat-icon>person</mat-icon>
                      {{ 'profile.viewProfile' | transloco }}
                    </a>
                    @if (canPromote(row)) {
                      <button mat-menu-item (click)="promote(row)" [disabled]="loading()">
                        <mat-icon>upgrade</mat-icon> {{ 'users.makeAdmin' | transloco }}
                      </button>
                    }
                    @if (canDelete(row)) {
                      <button mat-menu-item class="!text-red-600" (click)="deleteUser(row)" [disabled]="loading()">
                        <mat-icon class="!text-red-600">delete</mat-icon> {{ 'common.delete' | transloco }}
                      </button>
                    }
                  } @else {
                    <button mat-menu-item [matMenuTriggerFor]="approveMenu"
                      (menuOpened)="approveSelection[row.id!] = row.roleId" [disabled]="loading()">
                      <mat-icon>how_to_reg</mat-icon> {{ 'users.approve' | transloco }}
                    </button>
                    @if (filter() === 'Pending') {
                      <button mat-menu-item class="!text-red-600" (click)="reject(row)" [disabled]="loading()">
                        <mat-icon class="!text-red-600">block</mat-icon> {{ 'users.reject' | transloco }}
                      </button>
                    }
                  }
                </mat-menu>
                <mat-menu #approveMenu="matMenu">
                  <div class="flex min-w-[200px] flex-col gap-2.5 p-3" (click)="$event.stopPropagation()">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                      <mat-label>{{ 'users.approveAs' | transloco }}</mat-label>
                      <mat-select [(value)]="approveSelection[row.id!]">
                        @for (r of activeRoles(); track r.id) {
                          <mat-option [value]="r.id">{{ r.name }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <button mat-flat-button color="primary" class="w-full"
                      (click)="approve(row)" [disabled]="loading()">
                      {{ 'users.confirm' | transloco }}
                    </button>
                  </div>
                </mat-menu>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns();"></tr>
        </table>
      }
    </div>

    <!-- Add user dialog — "Send invite" (default) or "Create directly" (secondary) -->
    <ng-template #addDialog>
      <h2 mat-dialog-title>{{ 'users.addUser' | transloco }}</h2>
      <mat-dialog-content>
        @if (!inviteCreatedUrl()) {
          <mat-button-toggle-group
            [value]="addMode()"
            (change)="addMode.set($event.value)"
            hideSingleSelectionIndicator
            class="mb-3"
          >
            <mat-button-toggle value="invite">{{ 'users.modeInvite' | transloco }}</mat-button-toggle>
            <mat-button-toggle value="direct">{{ 'users.modeDirect' | transloco }}</mat-button-toggle>
          </mat-button-toggle-group>
        }

        @if (addMode() === 'invite') {
          @if (inviteCreatedUrl(); as url) {
            <div class="flex min-w-80 flex-col gap-3 pt-2">
              @if (inviteCreatedEmailSent(); as sentTo) {
                <div class="flex items-center gap-2 rounded bg-green-50 p-2 text-[0.85rem] text-green-700 dark:bg-green-500/15 dark:text-green-300">
                  <mat-icon class="!h-4 !w-4 !text-base">mark_email_read</mat-icon>
                  <span>{{ (inviteWasQuickAccess() ? 'invite.credentialsEmailed' : 'invite.emailSent') | transloco: { email: sentTo } }}</span>
                </div>
              }
              @if (!inviteWasQuickAccess()) {
                <div class="flex items-center gap-2 rounded bg-slate-50 p-2 text-[0.85rem] break-all dark:bg-white/5">
                  <span class="flex-1">{{ url }}</span>
                  <button mat-stroked-button (click)="copyInviteUrl(url)">
                    {{ 'invite.copy' | transloco }}
                  </button>
                </div>
              }
            </div>
          } @else {
            <div class="flex min-w-80 flex-col gap-3 pt-2">
              <p class="text-[0.85rem] text-muted">{{ (auth.isSuperAdmin() ? 'users.deputyHint' : 'invite.sectionHint') | transloco }}</p>
              @if (auth.isSuperAdmin()) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'users.workspace' | transloco }}</mat-label>
                  <mat-select [ngModel]="inviteTargetOwnerId()" (ngModelChange)="inviteTargetOwnerId.set($event)">
                    @for (t of tenants(); track t.ownerId) {
                      <mat-option [value]="t.ownerId">{{ t.displayName || t.email }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              } @else {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'invite.role' | transloco }}</mat-label>
                  <mat-select [ngModel]="inviteRoleId()" (ngModelChange)="inviteRoleId.set($event)">
                    @for (r of assignableInviteRoles(); track r.id) {
                      <mat-option [value]="r.id">{{ r.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              }

              @if (isQuickAccessInvite()) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'invite.project' | transloco }}</mat-label>
                  <mat-select [ngModel]="inviteProjectId()" (ngModelChange)="inviteProjectId.set($event)">
                    @for (p of projects(); track p.id) {
                      <mat-option [value]="p.id">{{ p.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                @if (quickAccessAppUrlMissing()) {
                  <p class="m-0 text-[0.8rem] text-red-600">{{ 'invite.quickAccessAppUrlMissing' | transloco }}</p>
                }
                <p class="m-0 text-[0.85rem] text-muted">{{ 'invite.quickAccessHint' | transloco }}</p>
              }

              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'invite.email' | transloco }}</mat-label>
                <input matInput type="email"
                  [ngModel]="inviteEmail()"
                  (ngModelChange)="inviteEmail.set($event)" />
              </mat-form-field>

              <div class="flex gap-3">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="flex-1">
                  <mat-label>{{ 'invite.expiresDays' | transloco }}</mat-label>
                  <input matInput type="number" min="1"
                    [ngModel]="inviteExpiresInDays()"
                    (ngModelChange)="inviteExpiresInDays.set($event ? +$event : null)" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="flex-1">
                  <mat-label>{{ 'invite.maxUses' | transloco }}</mat-label>
                  <input matInput type="number" min="1"
                    [ngModel]="inviteMaxUses()"
                    (ngModelChange)="inviteMaxUses.set($event ? +$event : null)" />
                </mat-form-field>
              </div>
            </div>
          }
        } @else {
          <form [formGroup]="addForm" (ngSubmit)="addUser()" class="flex min-w-80 flex-col gap-3 pt-2">
            @if (auth.isSuperAdmin()) {
              <p class="text-[0.85rem] text-muted">{{ 'users.deputyHint' | transloco }}</p>
            }
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
              <input matInput [type]="pwToggle.type()" formControlName="password" />
              <app-password-toggle matSuffix #pwToggle />
            </mat-form-field>
            @if (auth.isSuperAdmin()) {
              <mat-form-field appearance="outline">
                <mat-label>{{ 'users.workspace' | transloco }}</mat-label>
                <mat-select formControlName="targetOwnerId">
                  @for (t of tenants(); track t.ownerId) {
                    <mat-option [value]="t.ownerId">{{ t.displayName || t.email }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            } @else {
              <mat-form-field appearance="outline">
                <mat-label>{{ 'users.role' | transloco }}</mat-label>
                <mat-select formControlName="roleId">
                  @for (role of activeRoles(); track role.id) {
                    <mat-option [value]="role.id">{{ role.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
          </form>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        @if (addMode() === 'invite') {
          @if (inviteCreatedUrl()) {
            <button mat-flat-button color="primary" mat-dialog-close>{{ 'invite.done' | transloco }}</button>
          } @else {
            <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
            <button mat-flat-button color="primary"
              [disabled]="(auth.isSuperAdmin() ? !inviteTargetOwnerId() : !inviteRoleId())
                || (isQuickAccessInvite() && (!inviteEmail().trim() || !inviteProjectId() || quickAccessAppUrlMissing()))
                || inviteCreating()"
              (click)="createInvite()">
              {{ 'invite.create' | transloco }}
            </button>
          }
        } @else {
          <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
          <button mat-flat-button color="primary" (click)="addUser()" [disabled]="addForm.invalid || loading()">
            <mat-icon>add</mat-icon> {{ 'users.addUser' | transloco }}
          </button>
        }
      </mat-dialog-actions>
    </ng-template>
  `,
})
export class UsersComponent {
  private usersService = inject(UsersService);
  private invitesService = inject(InvitesService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private transloco = inject(TranslocoService);
  private dialog = inject(MatDialog);
  auth = inject(AuthService);

  readonly addDialog = viewChild.required<TemplateRef<unknown>>('addDialog');
  private dialogRef?: MatDialogRef<unknown>;

  filter = signal<FilterStatus>('Approved');

  usersResource = getApiAdminUsersResource(
    computed(() => ({ status: this.filter().toLowerCase() || undefined })),
  );
  pendingResource = getApiAdminUsersResource(signal({ status: 'pending' }));
  rolesResource = getApiAdminRolesResource();
  // Only meaningful for a super admin (the workspace picker) — GET /api/admin/tenants is
  // super-admin-only and 403s for anyone else. httpResource THROWS from .value() while in an
  // error state (unlike a plain signal), so tenants() below must swallow that itself — it isn't
  // enough to just never read it, since openAdd() does read it for every caller.
  tenantsResource = getApiAdminTenantsResource();
  // Only meaningful for a quick-access role invite (the project picker below).
  projectsResource = getApiAdminProjectsResource();

  users = computed(() => this.usersResource.value() ?? []);
  roles = computed(() => this.rolesResource.value() ?? []);
  tenants = computed(() => {
    try { return this.tenantsResource.value() ?? []; } catch { return []; }
  });
  projects = computed(() => {
    try { return this.projectsResource.value() ?? []; } catch { return []; }
  });
  busy = signal(false);
  loading = computed(() => this.usersResource.isLoading() || this.busy());

  // Pending invites render as rows in the Pending view, right alongside real
  // pending users; created via "Send invite" in the Add User dialog below.
  // Once accepted, an invite becomes an Approved user directly and drops out here.
  invitesResource = getApiAdminInvitesResource();
  invites = computed(() => (this.invitesResource.value() ?? []) as InviteResponse[]);
  pendingCount = computed(() => (this.pendingResource.value()?.length ?? 0) + this.invites().length);

  displayedRows = computed<(UserResponse | InviteResponse)[]>(() =>
    this.filter() === 'Pending' ? [...this.users(), ...this.invites()] : this.users(),
  );

  isInvite(row: UserResponse | InviteResponse): row is InviteResponse {
    return !('isActive' in row);
  }

  // Client-side hints only — the server is the sole source of truth for both actions and
  // re-validates the full matrix itself (a stale hint here just means a disabled-looking
  // action would still 4xx if actually attempted, never a false allow).
  canDelete(row: UserResponse): boolean {
    const me = this.auth.user();
    if (!me || row.publicId === me.id) return false; // never yourself
    if (row.roleName === WORKSPACE_ADMIN_ROLE_NAME) return false; // never the current admin
    if (me.roleName === DEPUTY_ROLE_NAME && row.roleName === DEPUTY_ROLE_NAME) return false; // deputy can't delete a peer deputy
    return true;
  }

  canPromote(row: UserResponse): boolean {
    if (row.roleName !== DEPUTY_ROLE_NAME) return false;
    const me = this.auth.user();
    return this.auth.isSuperAdmin() || me?.roleName === WORKSPACE_ADMIN_ROLE_NAME;
  }

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
    roleId: [0 as number],
    targetOwnerId: this.fb.control<string | null>(null),
  });

  addMode = signal<'invite' | 'direct'>('invite');

  // A role a non-super-admin caller may actually assign here: active, not quick-access (that goes
  // through the invite flow only), and not admin-tier — except Deputy, which a Workspace Admin may
  // delegate — mirroring assignableInviteRoles below. Anything else (Admin, Workspace Admin) is
  // always rejected by the server's escalation guard, so offering it here is just a dead end; a
  // super admin sees everything since they're exempt from that guard.
  private isAssignableRole = (r: RoleResponse): boolean =>
    !!r.isActive && !r.quickAccess && (this.auth.isSuperAdmin() || !r.grantsAdmin || r.name === DEPUTY_ROLE_NAME);

  activeRoles() {
    return this.roles().filter(this.isAssignableRole);
  }

  rolesForUser(user: UserResponse): RoleResponse[] {
    const active = this.roles().filter(this.isAssignableRole);
    const current = this.roles().find(r => r.id === user.roleId);
    // Keep the user's OWN current role visible/selected even if it wouldn't otherwise be
    // newly-assignable here (inactive, quick-access, or admin-tier) — an empty/blank mat-select
    // would look broken for that row.
    if (current && !this.isAssignableRole(current)) {
      return [current, ...active];
    }
    return active;
  }

  // --- Invite teammates (reuses roles() already loaded above) ---

  // Deputy is admin-tier (grantsAdmin) but a Workspace Admin (or one of their deputies) may still
  // delegate it via invite, same as via direct-add — so it isn't filtered out like other admin roles.
  assignableInviteRoles = computed(() =>
    this.roles().filter((r) => r.isActive && (!r.grantsAdmin || r.name === DEPUTY_ROLE_NAME)),
  );

  inviteRoleId = signal<number | null>(null);
  inviteTargetOwnerId = signal<string | null>(null);
  inviteEmail = signal('');
  inviteExpiresInDays = signal<number | null>(7);
  inviteMaxUses = signal<number | null>(null);
  inviteProjectId = signal<number | null>(null);
  inviteCreating = signal(false);
  inviteCreatedUrl = signal<string | null>(null);
  inviteCreatedEmailSent = signal<string | null>(null);
  inviteWasQuickAccess = signal(false);

  // A quick-access role (e.g. "Client") skips the accept-link flow entirely — see
  // Role.QuickAccess. Only meaningful for a non-super-admin caller (the super-admin branch
  // always forces the Deputy role server-side, which is never QuickAccess).
  selectedInviteRole = computed(() => this.roles().find((r) => r.id === this.inviteRoleId()) ?? null);
  isQuickAccessInvite = computed(() => !this.auth.isSuperAdmin() && !!this.selectedInviteRole()?.quickAccess);
  selectedInviteProject = computed(() => this.projects().find((p) => p.id === this.inviteProjectId()) ?? null);
  // True once a project is picked but it has no App URL set — the API would reject this too,
  // but surfacing it inline (with a pointer to the Projects page) beats a round-trip 400.
  quickAccessAppUrlMissing = computed(
    () => this.isQuickAccessInvite() && !!this.inviteProjectId() && !this.selectedInviteProject()?.appUrl,
  );

  createInvite(): void {
    const isSuper = this.auth.isSuperAdmin();
    const targetOwnerId = this.inviteTargetOwnerId();
    const roleId = this.inviteRoleId();
    if (isSuper ? !targetOwnerId : !roleId) return;
    const quickAccess = this.isQuickAccessInvite();
    if (quickAccess && (!this.inviteEmail().trim() || !this.inviteProjectId())) return;
    this.inviteCreating.set(true);
    this.inviteCreatedUrl.set(null);
    this.inviteCreatedEmailSent.set(null);
    this.inviteWasQuickAccess.set(quickAccess);
    const body = isSuper
      ? {
          targetOwnerId,
          email: this.inviteEmail() || null,
          expiresInDays: this.inviteExpiresInDays(),
          maxUses: this.inviteMaxUses(),
        }
      : {
          roleId,
          email: this.inviteEmail() || null,
          expiresInDays: this.inviteExpiresInDays(),
          maxUses: this.inviteMaxUses(),
          ...(quickAccess ? { projectId: this.inviteProjectId() } : {}),
        };
    this.invitesService.postApiAdminInvites(body as any).subscribe({
      next: (res: InviteResponse) => {
        this.inviteCreating.set(false);
        this.inviteCreatedUrl.set(res.url ?? null);
        this.inviteCreatedEmailSent.set(res.emailSent && res.email ? res.email : null);
        this.snack.open(this.transloco.translate('invite.created'), 'OK', { duration: 3000 });
        this.invitesResource.reload();
      },
      error: (e: unknown) => {
        this.inviteCreating.set(false);
        this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
      },
    });
  }

  copyInviteUrl(url: string): void {
    navigator.clipboard.writeText(url).then(() => {
      this.snack.open(this.transloco.translate('invite.copied'), 'OK', { duration: 2000 });
    });
  }

  revokeInvite(invite: InviteResponse): void {
    if (!invite.id) return;
    this.invitesService.deleteApiAdminInvitesId(invite.id).subscribe({
      next: () => {
        this.snack.open(this.transloco.translate('invite.revoked'), 'OK', { duration: 3000 });
        this.invitesResource.reload();
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  setFilter(status: FilterStatus) {
    this.filter.set(status);
  }

  openAdd() {
    const isSuper = this.auth.isSuperAdmin();
    const firstRole = this.activeRoles()[0]?.id ?? 0;
    const firstWorkspace = this.tenants()[0]?.ownerId ?? null;
    this.addForm.reset({ email: '', displayName: '', password: '', roleId: firstRole, targetOwnerId: firstWorkspace });
    // A super admin's direct-add is always forced to Deputy on an existing workspace server-side —
    // roleId is irrelevant for them (targetOwnerId is required instead), and vice versa.
    this.addForm.controls.roleId.setValidators(isSuper ? [] : [Validators.required, Validators.min(1)]);
    this.addForm.controls.roleId.updateValueAndValidity();
    this.addForm.controls.targetOwnerId.setValidators(isSuper ? [Validators.required] : []);
    this.addForm.controls.targetOwnerId.updateValueAndValidity();

    this.addMode.set('invite');
    this.inviteRoleId.set(this.assignableInviteRoles()[0]?.id ?? null);
    this.inviteTargetOwnerId.set(firstWorkspace);
    this.inviteEmail.set('');
    this.inviteExpiresInDays.set(7);
    this.inviteMaxUses.set(null);
    this.inviteProjectId.set(null);
    this.inviteCreatedUrl.set(null);
    this.inviteCreatedEmailSent.set(null);
    this.inviteWasQuickAccess.set(false);
    this.dialogRef = this.dialog.open(this.addDialog(), { width: '440px' });
  }

  addUser() {
    if (this.addForm.invalid) return;
    this.busy.set(true);
    const val = this.addForm.getRawValue();
    // Send only the field relevant to this caller — the server ignores roleId for a super admin
    // anyway, but there's no reason to send a stale/default value it will discard.
    const body = this.auth.isSuperAdmin()
      ? { email: val.email, displayName: val.displayName, password: val.password, targetOwnerId: val.targetOwnerId }
      : { email: val.email, displayName: val.displayName, password: val.password, roleId: val.roleId };
    this.usersService.postApiAdminUsers(body).subscribe({
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
          confirmColor: 'danger',
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
          confirmColor: 'danger',
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

  deleteUser(user: UserResponse) {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          message: this.transloco.translate('users.confirmDelete', { name: user.email }),
          confirmLabel: this.transloco.translate('common.delete'),
          confirmColor: 'danger',
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.busy.set(true);
        this.usersService.deleteApiAdminUsersId(user.id!).subscribe({
          next: () => {
            this.busy.set(false);
            this.snack.open(this.transloco.translate('users.deleted'), 'OK', { duration: 3000 });
            this.usersResource.reload();
          },
          error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
        });
      });
  }

  promote(user: UserResponse) {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          message: this.transloco.translate('users.confirmPromote', { name: user.displayName || user.email }),
          confirmLabel: this.transloco.translate('users.makeAdmin'),
          confirmColor: 'danger',
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.busy.set(true);
        this.usersService.postApiAdminUsersDeputyPublicIdPromote(user.publicId!).subscribe({
          next: () => {
            this.busy.set(false);
            this.snack.open(this.transloco.translate('users.promoted'), 'OK', { duration: 3000 });
            this.usersResource.reload();
          },
          error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
        });
      });
  }
}
