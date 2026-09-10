import { Component, inject, signal, TemplateRef, viewChild, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { BidiModule } from '@angular/cdk/bidi';
import { UsersService, getApiAdminUsersResource } from '@moamen-ui/pointer-angular';
import { ConfirmService } from '../../core/confirm.service';
import { AppDialogService } from '../../shared/ui/app-dialog.service';
import { getApiAdminRolesResource } from '@moamen-ui/pointer-angular';
import { InvitesService, getApiAdminInvitesResource } from '@moamen-ui/pointer-angular';
import { getApiAdminTenantsResource } from '@moamen-ui/pointer-angular';
import { getApiAdminProjectsResource } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { PasswordToggleComponent } from '../../shared/password-toggle.component';
import { AuthService } from '../../core/auth/auth.service';
import { AppDataTableComponent, type DataTableColumn } from '../../shared/ui/app-data-table.component';
import { DataTableCellDirective } from '../../shared/data-table/data-table-cell.directive';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppIconComponent } from '../../shared/ui/app-icon.component';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppSelectComponent, type SelectOption } from '../../shared/ui/app-select.component';
import { AppMenuComponent, type MenuItem } from '../../shared/ui/app-menu.component';
import { AppToastService } from '../../shared/ui/app-toast.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import type { UserResponse, RoleResponse, InviteResponse } from '@moamen-ui/pointer-angular';

type UserRow = UserResponse | InviteResponse;

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
    BidiModule,
    TranslocoModule,
    PasswordToggleComponent,
    AppDataTableComponent,
    DataTableCellDirective,
    AppButtonDirective,
    AppIconComponent,
    AppInputDirective,
    AppSelectComponent,
    AppMenuComponent,
    BadgeComponent,
  ],
  template: `
    <div class="space-y-6">
      <!-- Title row with Add User button -->
      <div class="flex items-center justify-between gap-4 mb-4">
        <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
          {{ 'users.title' | transloco }}
        </h1>
        <button
          appButton
          variant="primary"
          size="sm"
          (click)="openAdd()"
        >
          <app-icon name="plus" [size]="16"></app-icon>
          {{ 'users.addUser' | transloco }}
        </button>
      </div>

      <!-- Filter segmented control -->
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-[13px] text-muted-foreground">{{ 'users.filter' | transloco }}</span>
        <div class="inline-flex rounded-md border border-border bg-gutter p-0.5">
          <button
            type="button"
            class="h-7 px-3 rounded-[4px] text-[13px] font-medium transition-colors"
            [class.bg-background]="filter() === 'Approved'"
            [class.text-foreground]="filter() === 'Approved'"
            [class.text-muted-foreground]="filter() !== 'Approved'"
            [class.border]="filter() === 'Approved'"
            [class.border-border]="filter() === 'Approved'"
            (click)="setFilter('Approved')"
          >
            {{ 'users.filterApproved' | transloco }}
          </button>
          <button
            type="button"
            class="h-7 px-3 rounded-[4px] text-[13px] font-medium transition-colors"
            [class.bg-background]="filter() === 'Pending'"
            [class.text-foreground]="filter() === 'Pending'"
            [class.text-muted-foreground]="filter() !== 'Pending'"
            [class.border]="filter() === 'Pending'"
            [class.border-border]="filter() === 'Pending'"
            (click)="setFilter('Pending')"
          >
            {{ 'users.filterPending' | transloco }}
            @if (pendingCount() > 0) {
              <span class="ms-1.5 inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] font-medium text-state-ready bg-state-ready-tint border-state-ready/30">
                {{ pendingCount() }}
              </span>
            }
          </button>
          <button
            type="button"
            class="h-7 px-3 rounded-[4px] text-[13px] font-medium transition-colors"
            [class.bg-background]="filter() === 'Rejected'"
            [class.text-foreground]="filter() === 'Rejected'"
            [class.text-muted-foreground]="filter() !== 'Rejected'"
            [class.border]="filter() === 'Rejected'"
            [class.border-border]="filter() === 'Rejected'"
            (click)="setFilter('Rejected')"
          >
            {{ 'users.filterRejected' | transloco }}
          </button>
        </div>
      </div>

      @if (displayedRows().length === 0 && !loading()) {
        <!-- Empty state with three ghost rows -->
        <div class="rounded-md border border-border overflow-hidden">
          <table class="w-full border-collapse">
            <thead>
              <tr class="h-10 bg-gutter text-[13px] font-medium text-muted-foreground border-b border-border">
                <th class="px-3 text-start">{{ 'users.email' | transloco }}</th>
                <th class="px-3 text-start">{{ 'users.name' | transloco }}</th>
                <th class="px-3 text-start">{{ 'users.role' | transloco }}</th>
                <th class="px-3 text-start">{{ 'users.status' | transloco }}</th>
                <th class="px-3 text-start">{{ 'users.actions' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              <tr class="h-11 border-t border-dashed border-border-muted">
                <td class="px-3 text-[14px] text-muted-foreground">{{ 'users.empty' | transloco }}</td>
                <td colspan="4" class="text-end pe-3">
                  <button
                    appButton
                    variant="primary"
                    size="sm"
                    (click)="openAdd()"
                  >
                    <app-icon name="plus" [size]="16"></app-icon>
                    {{ 'users.addUser' | transloco }}
                  </button>
                </td>
              </tr>
              <tr class="h-11 border-t border-dashed border-border-muted"></tr>
              <tr class="h-11 border-t border-dashed border-border-muted"></tr>
            </tbody>
          </table>
        </div>
      } @else {
        <!-- Escape hatch: rows are a union type (real users + pending invites) with dual
             menus and a nested submenu (approve), none of which RowActionsMenu's flat item
             list can express -- every column, including actions, renders through
             appDataTableCell so this page keeps its own bespoke menu markup. -->
        <app-data-table
          [gutter]="true"
          [rows]="displayedRows()"
          [columns]="columns()"
          [paginated]="false"
        >
          <ng-template appDataTableCell="email" let-row>
            @if (isInvite(row)) {
              {{ row.email || ('invite.anyone' | transloco) }}
            } @else {
              {{ row.email }}
            }
          </ng-template>

          <ng-template appDataTableCell="displayName" let-row>
            @if (isInvite(row)) {
              —
            } @else {
              {{ row.displayName }}
            }
          </ng-template>

          <ng-template appDataTableCell="role" let-row>
            @if (isInvite(row)) {
              <span>{{ row.roleName ?? '—' }}</span>
            } @else if (filter() === 'Approved') {
              <app-select
                [options]="roleSelectOptions(row)"
                [value]="row.roleId"
                (valueChange)="changeRole(row, $event)"
              ></app-select>
            } @else {
              <span>{{ row.roleName }}</span>
            }
          </ng-template>

          @if (filter() !== 'Approved') {
            <ng-template appDataTableCell="requested" let-row>
              @if (isInvite(row)) {
                {{ 'invite.expires' | transloco }}: {{ row.expiresAt | date:'mediumDate' }}
              } @else {
                {{ row.createdAt ? (row.createdAt | date:'dd-MM-yyyy HH:mm') : '—' }}
              }
            </ng-template>
          }

          <ng-template appDataTableCell="status" let-row>
            @if (isInvite(row)) {
              <app-badge severity="neutral">{{ 'invite.invited' | transloco }}</app-badge>
            } @else {
              <app-badge [severity]="row.isActive ? 'success' : 'neutral'">
                {{ row.isActive ? ('common.active' | transloco) : ('common.disabled' | transloco) }}
              </app-badge>
            }
          </ng-template>

          <ng-template appDataTableCell="actions" let-row>
            @if (isInvite(row)) {
              <app-menu [items]="inviteMenuItems(row)">
                <button
                  appButton
                  variant="ghost"
                  size="icon"
                  appMenuTrigger
                  [attr.aria-label]="'users.actions' | transloco"
                >
                  <app-icon name="ellipsis-vertical" [size]="16"></app-icon>
                </button>
              </app-menu>
            } @else {
              <app-menu [items]="getUserMenuItems(row)">
                <button
                  appButton
                  variant="ghost"
                  size="icon"
                  appMenuTrigger
                  [attr.aria-label]="'users.actions' | transloco"
                >
                  <app-icon name="ellipsis-vertical" [size]="16"></app-icon>
                </button>
              </app-menu>
            }
          </ng-template>
        </app-data-table>
      }
    </div>

    <!-- Add user dialog — "Send invite" (default) or "Create directly" (secondary) -->
    <ng-template #addDialog>
      <div class="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog">
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-[16px] font-semibold leading-6">{{ 'users.addUser' | transloco }}</h2>
        </div>
        <div class="px-5 py-2 space-y-4">
          @if (!inviteCreatedUrl()) {
            <!-- Mode selector -->
            <div class="inline-flex rounded-md border border-border bg-gutter p-0.5">
              <button
                type="button"
                class="h-7 px-3 rounded-[4px] text-[13px] font-medium transition-colors"
                [class.bg-background]="addMode() === 'invite'"
                [class.text-foreground]="addMode() === 'invite'"
                [class.text-muted-foreground]="addMode() !== 'invite'"
                [class.border]="addMode() === 'invite'"
                [class.border-border]="addMode() === 'invite'"
                (click)="addMode.set('invite')"
              >
                {{ 'users.modeInvite' | transloco }}
              </button>
              <button
                type="button"
                class="h-7 px-3 rounded-[4px] text-[13px] font-medium transition-colors"
                [class.bg-background]="addMode() === 'direct'"
                [class.text-foreground]="addMode() === 'direct'"
                [class.text-muted-foreground]="addMode() !== 'direct'"
                [class.border]="addMode() === 'direct'"
                [class.border-border]="addMode() === 'direct'"
                (click)="addMode.set('direct')"
              >
                {{ 'users.modeDirect' | transloco }}
              </button>
            </div>
          }

          @if (addMode() === 'invite') {
            @if (inviteCreatedUrl(); as url) {
              <div class="flex flex-col gap-3">
                @if (inviteCreatedEmailSent(); as sentTo) {
                  <div class="flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] bg-state-completed-tint border-state-completed/30">
                    <app-icon name="check-circle" [size]="16" class="text-state-completed flex-shrink-0"></app-icon>
                    <span>{{ (inviteWasQuickAccess() ? 'invite.credentialsEmailed' : 'invite.emailSent') | transloco: { email: sentTo } }}</span>
                  </div>
                }
                @if (!inviteWasQuickAccess()) {
                  <div class="flex items-center gap-2 rounded-md border border-border bg-gutter px-3 py-2 text-[13px] break-all">
                    <span class="flex-1 font-mono">{{ url }}</span>
                    <button
                      appButton
                      variant="secondary"
                      size="sm"
                      (click)="copyInviteUrl(url)"
                    >
                      {{ 'invite.copy' | transloco }}
                    </button>
                  </div>
                }
              </div>
            } @else {
              <div class="flex flex-col gap-3">
                <p class="text-[13px] text-muted-foreground">{{ (auth.isSuperAdmin() ? 'users.deputyHint' : 'invite.sectionHint') | transloco }}</p>
                @if (auth.isSuperAdmin()) {
                  <app-select
                    [options]="tenantSelectOptions()"
                    [value]="inviteTargetOwnerId()"
                    (valueChange)="inviteTargetOwnerId.set($event)"
                  ></app-select>
                } @else {
                  <app-select
                    [options]="roleSelectOptions2()"
                    [value]="inviteRoleId()"
                    (valueChange)="inviteRoleId.set($event)"
                  ></app-select>
                }

                @if (isQuickAccessInvite()) {
                  <app-select
                    [options]="projectSelectOptions()"
                    [value]="inviteProjectId()"
                    (valueChange)="inviteProjectId.set($event)"
                  ></app-select>
                  @if (quickAccessAppUrlMissing()) {
                    <p class="m-0 text-[12px] text-state-danger">{{ 'invite.quickAccessAppUrlMissing' | transloco }}</p>
                  }
                  <p class="m-0 text-[13px] text-muted-foreground">{{ 'invite.quickAccessHint' | transloco }}</p>
                }

                <input
                  appInput
                  type="email"
                  placeholder="{{ 'invite.email' | transloco }}"
                  [ngModel]="inviteEmail()"
                  (ngModelChange)="inviteEmail.set($event)"
                />

                <div class="flex gap-3">
                  <input
                    appInput
                    type="number"
                    min="1"
                    placeholder="{{ 'invite.expiresDays' | transloco }}"
                    [ngModel]="inviteExpiresInDays()"
                    (ngModelChange)="inviteExpiresInDays.set($event ? +$event : null)"
                  />
                  <input
                    appInput
                    type="number"
                    min="1"
                    placeholder="{{ 'invite.maxUses' | transloco }}"
                    [ngModel]="inviteMaxUses()"
                    (ngModelChange)="inviteMaxUses.set($event ? +$event : null)"
                  />
                </div>
              </div>
            }
            } @else {
            <form [formGroup]="addForm" class="flex flex-col gap-4">
              @if (auth.isSuperAdmin()) {
                <p class="text-[13px] text-muted-foreground">{{ 'users.deputyHint' | transloco }}</p>
              }
              <input
                appInput
                type="email"
                placeholder="{{ 'users.email' | transloco }}"
                formControlName="email"
              />
              <input
                appInput
                type="text"
                placeholder="{{ 'users.displayName' | transloco }}"
                formControlName="displayName"
              />
              <div class="relative">
                <input
                  appInput
                  [type]="pwToggle.type()"
                  placeholder="{{ 'users.password' | transloco }}"
                  formControlName="password"
                />
                <app-password-toggle #pwToggle class="absolute end-3 top-1/2 -translate-y-1/2"></app-password-toggle>
              </div>
              @if (auth.isSuperAdmin()) {
                <app-select
                  [options]="tenantSelectOptions()"
                  [value]="addForm.get('targetOwnerId')?.value"
                  (valueChange)="addForm.patchValue({ targetOwnerId: $event })"
                ></app-select>
              } @else {
                <app-select
                  [options]="directModeRoleSelectOptions()"
                  [value]="addForm.get('roleId')?.value"
                  (valueChange)="addForm.patchValue({ roleId: $event })"
                ></app-select>
              }
            </form>
          }
        </div>
        <div class="px-5 pb-5 pt-3 flex justify-end gap-2">
          @if (addMode() === 'invite') {
            @if (inviteCreatedUrl()) {
              <button
                appButton
                variant="primary"
                (click)="dialogRef?.close()"
              >
                {{ 'invite.done' | transloco }}
              </button>
            } @else {
              <button
                appButton
                variant="secondary"
                (click)="dialogRef?.close()"
              >
                {{ 'common.cancel' | transloco }}
              </button>
              <button
                appButton
                variant="primary"
                [disabled]="(auth.isSuperAdmin() ? !inviteTargetOwnerId() : !inviteRoleId())
                  || (isQuickAccessInvite() && (!inviteEmail().trim() || !inviteProjectId() || quickAccessAppUrlMissing()))
                  || inviteCreating()"
                (click)="createInvite()"
              >
                <app-icon name="plus" [size]="16"></app-icon>
                {{ 'invite.create' | transloco }}
              </button>
            }
          } @else {
            <button
              appButton
              variant="secondary"
              (click)="dialogRef?.close()"
            >
              {{ 'common.cancel' | transloco }}
            </button>
            <button
              appButton
              variant="primary"
              (click)="addUser()"
              [disabled]="addForm.invalid || loading()"
            >
              <app-icon name="plus" [size]="16"></app-icon>
              {{ 'users.addUser' | transloco }}
            </button>
          }
        </div>
      </div>
    </ng-template>
  `,
})
export class UsersComponent {
  private usersService = inject(UsersService);
  private invitesService = inject(InvitesService);
  private toast = inject(AppToastService);
  private fb = inject(FormBuilder);
  private transloco = inject(TranslocoService);
  private confirm = inject(ConfirmService);
  private appDialog = inject(AppDialogService);
  auth = inject(AuthService);

  readonly addDialog = viewChild.required<TemplateRef<unknown>>('addDialog');
  dialogRef?: any;

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

  // A method (not a stored field) so column headers stay live if the app language changes,
  // and so the conditional "requested" column follows the active filter.
  columns(): DataTableColumn<UserRow>[] {
    const cols: DataTableColumn<UserRow>[] = [
      { key: 'email', header: this.transloco.translate('users.email') },
      { key: 'displayName', header: this.transloco.translate('users.name') },
      { key: 'role', header: this.transloco.translate('users.role') },
    ];
    if (this.filter() !== 'Approved') {
      cols.push({ key: 'requested', header: this.transloco.translate('overview.requested') });
    }
    cols.push({ key: 'status', header: this.transloco.translate('users.status') });
    cols.push({ key: 'actions', header: this.transloco.translate('users.actions') });
    return cols;
  }

  roleSelectOptions(user: UserResponse): SelectOption<number>[] {
    return this.rolesForUser(user).map(r => ({ label: r.name ?? '', value: r.id! }));
  }

  roleSelectOptions2(): SelectOption<number | null>[] {
    return this.assignableInviteRoles().map(r => ({ label: r.name ?? '', value: r.id ?? null }));
  }

  directModeRoleSelectOptions(): SelectOption<number>[] {
    return this.activeRoles().map(r => ({ label: r.name ?? '', value: r.id! }));
  }

  tenantSelectOptions(): SelectOption<string | null>[] {
    return this.tenants().map(t => ({ label: t.displayName || t.email || '', value: t.ownerId ?? null }));
  }

  projectSelectOptions(): SelectOption<number | null>[] {
    return this.projects().map(p => ({ label: p.name ?? '', value: p.id ?? null }));
  }

  inviteMenuItems(invite: InviteResponse): MenuItem[] {
    return [
      {
        label: this.transloco.translate('invite.copy'),
        icon: 'copy',
        onClick: () => this.copyInviteUrl(invite.url!),
        disabled: !invite.url,
      },
      {
        label: this.transloco.translate('invite.revoke'),
        icon: 'link-off',
        severity: 'danger',
        onClick: () => this.revokeInvite(invite),
      },
    ];
  }

  getUserMenuItems(user: UserResponse): MenuItem[] {
    const items: MenuItem[] = [];

    if (this.filter() === 'Approved') {
      items.push({
        label: this.transloco.translate(user.isActive ? 'common.disable' : 'common.enable'),
        icon: user.isActive ? 'ban' : 'check-circle-2',
        severity: user.isActive ? 'danger' : 'neutral',
        disabled: this.loading(),
        onClick: () => this.toggleActive(user),
      });
      items.push({
        label: this.transloco.translate('profile.viewProfile'),
        icon: 'user',
        onClick: () => { /* Navigation will be handled by RouterLink in template */ },
      });
      if (this.canPromote(user)) {
        items.push({
          label: this.transloco.translate('users.makeAdmin'),
          icon: 'arrow-up',
          disabled: this.loading(),
          onClick: () => this.promote(user),
        });
      }
      if (this.canDelete(user)) {
        items.push({
          label: this.transloco.translate('common.delete'),
          icon: 'trash-2',
          severity: 'danger',
          disabled: this.loading(),
          onClick: () => this.deleteUser(user),
        });
      }
    } else {
      items.push({
        label: this.transloco.translate('users.approve'),
        icon: 'check-circle-2',
        disabled: this.loading(),
        onClick: () => {
          this.approveSelection[user.id!] = user.roleId ?? this.activeRoles()[0]?.id ?? 0;
          this.approve(user);
        },
      });
      if (this.filter() === 'Pending') {
        items.push({
          label: this.transloco.translate('users.reject'),
          icon: 'ban',
          severity: 'danger',
          disabled: this.loading(),
          onClick: () => this.reject(user),
        });
      }
    }

    return items;
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
        this.toast.show(this.transloco.translate('invite.created'), 'success');
        this.invitesResource.reload();
      },
      error: (e: unknown) => {
        this.inviteCreating.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  copyInviteUrl(url: string): void {
    navigator.clipboard.writeText(url).then(() => {
      this.toast.show(this.transloco.translate('invite.copied'), 'success');
    });
  }

  revokeInvite(invite: InviteResponse): void {
    if (!invite.id) return;
    this.invitesService.deleteApiAdminInvitesId(invite.id).subscribe({
      next: () => {
        this.toast.show(this.transloco.translate('invite.revoked'), 'success');
        this.invitesResource.reload();
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
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
    this.dialogRef = this.appDialog.openRef(this.addDialog());
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
      error: (e: unknown) => { this.busy.set(false); this.toast.show(extractMessage(e), 'danger'); },
    });
  }

  changeRole(user: UserResponse, roleId: number) {
    this.busy.set(true);
    this.usersService.patchApiAdminUsersId(user.id!, { roleId }).subscribe({
      next: () => { this.busy.set(false); this.usersResource.reload(); },
      error: (e: unknown) => { this.busy.set(false); this.toast.show(extractMessage(e), 'danger'); this.usersResource.reload(); },
    });
  }

  toggleActive(user: UserResponse) {
    if (!user.isActive) {
      this.patchActive(user, true);
      return;
    }
    this.confirm
      .confirm({
        message: this.transloco.translate('common.confirmDisable', { name: user.email }),
        confirmLabel: this.transloco.translate('common.disable'),
        confirmColor: 'danger',
      })
      .subscribe((ok) => {
        if (ok) this.patchActive(user, false);
      });
  }

  private patchActive(user: UserResponse, isActive: boolean) {
    this.busy.set(true);
    this.usersService.patchApiAdminUsersId(user.id!, { isActive }).subscribe({
      next: () => { this.busy.set(false); this.usersResource.reload(); },
      error: (e: unknown) => { this.busy.set(false); this.toast.show(extractMessage(e), 'danger'); },
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
      error: (e: unknown) => { this.busy.set(false); this.toast.show(extractMessage(e), 'danger'); },
    });
  }

  reject(user: UserResponse) {
    this.confirm
      .confirm({
        message: this.transloco.translate('users.confirmReject', { name: user.email }),
        confirmLabel: this.transloco.translate('users.reject'),
        confirmColor: 'danger',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.busy.set(true);
        this.usersService.postApiAdminUsersIdReject(user.id!).subscribe({
          next: () => {
            this.busy.set(false);
            this.usersResource.reload();
            this.pendingResource.reload();
          },
          error: (e: unknown) => { this.busy.set(false); this.toast.show(extractMessage(e), 'danger'); },
        });
      });
  }

  deleteUser(user: UserResponse) {
    this.confirm
      .confirm({
        message: this.transloco.translate('users.confirmDelete', { name: user.email }),
        confirmLabel: this.transloco.translate('common.delete'),
        confirmColor: 'danger',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.busy.set(true);
        this.usersService.deleteApiAdminUsersId(user.id!).subscribe({
          next: () => {
            this.busy.set(false);
            this.toast.show(this.transloco.translate('users.deleted'), 'success');
            this.usersResource.reload();
          },
          error: (e: unknown) => { this.busy.set(false); this.toast.show(extractMessage(e), 'danger'); },
        });
      });
  }

  promote(user: UserResponse) {
    this.confirm
      .confirm({
        message: this.transloco.translate('users.confirmPromote', { name: user.displayName || user.email }),
        confirmLabel: this.transloco.translate('users.makeAdmin'),
        confirmColor: 'danger',
      })
      .subscribe((ok: boolean) => {
        if (!ok) return;
        this.busy.set(true);
        this.usersService.postApiAdminUsersDeputyPublicIdPromote(user.publicId!).subscribe({
          next: () => {
            this.busy.set(false);
            this.toast.show(this.transloco.translate('users.promoted'), 'success');
            this.usersResource.reload();
          },
          error: (e: unknown) => { this.busy.set(false); this.toast.show(extractMessage(e), 'danger'); },
        });
      });
  }
}
