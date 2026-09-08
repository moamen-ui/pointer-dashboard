import { Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { UsersService } from '@moamen-ui/pointer-angular';
import { getApiAdminStatsResource } from '@moamen-ui/pointer-angular';
import { getApiAdminUsersResource } from '@moamen-ui/pointer-angular';
import { getApiAdminRolesResource } from '@moamen-ui/pointer-angular';
import { getApiAdminAiRulesInsightsResource } from '@moamen-ui/pointer-angular';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { extractMessage } from '../../core/api/extract-message';
import { StatusCatalogService } from '../../core/status/status-catalog.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { DataTableCellDirective } from '../../shared/data-table/data-table-cell.directive';
import { DataTableComponent, type DataTableColumn } from '../../shared/data-table/data-table.component';
import { AuthService } from '../../core/auth/auth.service';
import type { ProjectStats, UserResponse, RoleResponse, AiInsightsResponse, AiRuleResponse, GetApiAdminAiRulesInsightsParams } from '@moamen-ui/pointer-angular';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatProgressBarModule,
    MatIconModule,
    MatMenuModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    DatePipe,
    TranslocoModule,
    EmptyStateComponent,
    DataTableComponent,
    DataTableCellDirective,
    BadgeComponent,
  ],
  template: `
    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="fixed inset-x-0 top-0 z-[1000]"></mat-progress-bar>
    }

    @if (stats(); as s) {
      <div class="mb-8 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
        <mat-card class="rounded-[14px] bg-panel text-ink" appearance="outlined">
          <mat-card-content class="flex items-center gap-3.5 p-4">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stat-slate-bg text-stat-slate"><mat-icon>folder</mat-icon></div>
            <div class="flex flex-col"><div class="text-[1.7rem] font-bold leading-[1.1]">{{ s.totals?.projects }}</div><div class="mt-0.5 text-[0.72rem] uppercase tracking-[0.04em] text-muted">{{ 'overview.projects' | transloco }}</div></div>
          </mat-card-content>
        </mat-card>
        <mat-card class="rounded-[14px] bg-panel text-ink" appearance="outlined">
          <mat-card-content class="flex items-center gap-3.5 p-4">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stat-slate-bg text-stat-slate"><mat-icon>group</mat-icon></div>
            <div class="flex flex-col"><div class="text-[1.7rem] font-bold leading-[1.1]">{{ s.totals?.users }}</div><div class="mt-0.5 text-[0.72rem] uppercase tracking-[0.04em] text-muted">{{ 'overview.users' | transloco }}</div></div>
          </mat-card-content>
        </mat-card>
        <mat-card class="rounded-[14px] bg-panel text-ink" appearance="outlined">
          <mat-card-content class="flex items-center gap-3.5 p-4">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stat-slate-bg text-stat-slate"><mat-icon>chat_bubble_outline</mat-icon></div>
            <div class="flex flex-col">
              <div class="text-[1.7rem] font-bold leading-[1.1]">{{ s.totals?.comments }}</div>
              <div class="mt-0.5 text-[0.72rem] uppercase tracking-[0.04em] text-muted">{{ 'overview.comments' | transloco }}</div>
              @if ((s.totals?.privateComments ?? 0) > 0) {
                <div class="mt-1 inline-flex items-center gap-[3px] text-[0.7rem] text-muted">{{ 'overview.privateHidden' | transloco: { count: s.totals?.privateComments ?? 0 } }}</div>
              }
            </div>
          </mat-card-content>
        </mat-card>
        <!-- Status summary cards driven by catalog -->
        @for (st of statusCatalog.ordered(); track st.value) {
          <mat-card class="rounded-[14px] bg-panel text-ink" appearance="outlined">
            <mat-card-content class="flex items-center gap-3.5 p-4">
              <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" [style.background-color]="st.color + '22'" [style.color]="st.color">
                <mat-icon>radio_button_unchecked</mat-icon>
              </div>
              <div class="flex flex-col">
                <div class="text-[1.7rem] font-bold leading-[1.1]" [style.color]="st.color">{{ statusTotal(s, st.value) }}</div>
                <div class="mt-0.5 text-[0.72rem] uppercase tracking-[0.04em] text-muted">{{ statusCatalog.displayLabel(st) }}</div>
              </div>
            </mat-card-content>
          </mat-card>
        }
      </div>

      <mat-card class="mb-8 rounded-[14px] bg-panel text-ink" appearance="outlined">
        <mat-card-header>
          <mat-card-title class="flex items-center gap-2 text-[1.05rem]">
            <mat-icon class="text-stat-amber">how_to_reg</mat-icon>
            {{ 'overview.pendingApprovals' | transloco }}
            <span class="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[11px] bg-stat-amber-bg px-[7px] text-[0.78rem] font-bold text-stat-amber">{{ pendingCount() }}</span>
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (pendingUsers().length === 0) {
            <app-empty-state icon="how_to_reg" [message]="'overview.noPending' | transloco" />
          } @else {
            <div class="flex flex-col">
              @for (u of pendingUsers(); track u.id) {
                <div class="flex flex-wrap items-center justify-between gap-4 border-t border-app-border py-3 first:border-t-0">
                  <div>
                    <div class="font-semibold">{{ u.displayName }}</div>
                    <div class="mt-0.5 flex flex-wrap items-center gap-2.5 text-[0.85rem] text-muted">
                      <span>{{ u.email }}</span>
                      <span class="chip chip-neutral">{{ u.roleName }}</span>
                      @if ($any(u).createdAt) {
                        <span class="text-[0.8rem]">
                          {{ 'overview.requested' | transloco }}:
                          {{ $any(u).createdAt | date:'dd-MM-yyyy HH:mm' }}
                        </span>
                      }
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button mat-flat-button color="primary" [matMenuTriggerFor]="approveMenu"
                      (menuOpened)="approveSelection[u.id!] = u.roleId ?? 0" [disabled]="busy()">
                      {{ 'overview.approve' | transloco }}
                    </button>
                    <mat-menu #approveMenu="matMenu">
                      <div class="flex min-w-[200px] flex-col gap-2.5 p-3" (click)="$event.stopPropagation()">
                        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                          <mat-label>{{ 'overview.approveAs' | transloco }}</mat-label>
                          <mat-select [(value)]="approveSelection[u.id!]">
                            @for (r of activeRoles(); track r.id) {
                              <mat-option [value]="r.id">{{ r.name }}</mat-option>
                            }
                          </mat-select>
                        </mat-form-field>
                        <button mat-flat-button color="primary" class="w-full"
                          (click)="approve(u)" [disabled]="busy()">
                          {{ 'overview.confirm' | transloco }}
                        </button>
                      </div>
                    </mat-menu>
                    <button mat-stroked-button color="warn" (click)="reject(u)" [disabled]="busy()">
                      {{ 'overview.reject' | transloco }}
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </mat-card-content>
      </mat-card>

      <!-- AI Coding Tools & Rules Insights -->
      @if (aiInsights(); as insights) {
        <mat-card class="mb-8 rounded-[14px] bg-panel text-ink" appearance="outlined">
          <mat-card-header>
            <mat-card-title class="flex items-center gap-2 text-[1.05rem]">
              <mat-icon class="text-primary">psychology</mat-icon>
              {{ 'aiRules.insightsTitle' | transloco }}
            </mat-card-title>
            <mat-card-subtitle class="text-xs text-muted">
              {{ 'aiRules.insightsSubtitle' | transloco }}
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content class="pt-4">
            <!-- Rules Counts -->
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
              <div class="rounded-lg border border-app-border p-3 flex flex-col">
                <span class="text-xs text-muted uppercase tracking-wider">{{ 'aiRules.totalRules' | transloco }}</span>
                <span class="text-2xl font-bold mt-1">{{ insights.totalRulesCount ?? 0 }}</span>
              </div>
              <div class="rounded-lg border border-app-border p-3 flex flex-col">
                <span class="text-xs text-muted uppercase tracking-wider">{{ 'aiRules.tenantRules' | transloco }}</span>
                <span class="text-2xl font-bold mt-1 text-primary">{{ insights.tenantRulesCount ?? 0 }}</span>
              </div>
              <div class="rounded-lg border border-app-border p-3 flex flex-col">
                <span class="text-xs text-muted uppercase tracking-wider">{{ 'aiRules.projectRules' | transloco }}</span>
                <span class="text-2xl font-bold mt-1">{{ insights.projectRulesCount ?? 0 }}</span>
              </div>
              <div class="rounded-lg border border-app-border p-3 flex flex-col">
                <span class="text-xs text-muted uppercase tracking-wider">{{ 'aiRules.userRules' | transloco }}</span>
                <span class="text-2xl font-bold mt-1 text-stat-amber">{{ insights.userPersonalRulesCount ?? 0 }}</span>
              </div>
            </div>

            <!-- Active Tools and Developer Adoption (and Workspaces for Super Admin) -->
            <div class="grid grid-cols-1 gap-4" [class.md:grid-cols-3]="auth.isSuperAdmin() && (insights.tenantSummaries?.length ?? 0) > 0" [class.md:grid-cols-2]="!auth.isSuperAdmin() || (insights.tenantSummaries?.length ?? 0) === 0">
              <!-- Workspace adoption for Super Admin -->
              @if (auth.isSuperAdmin() && (insights.tenantSummaries?.length ?? 0) > 0) {
                <div class="rounded-lg border border-app-border p-4">
                  <div class="font-semibold text-sm mb-3 flex items-center gap-2">
                    <mat-icon class="text-muted text-base">domain</mat-icon>
                    {{ 'aiRules.tenantSummaries' | transloco }}
                  </div>
                  <div class="flex flex-col gap-2">
                    @for (tenant of insights.tenantSummaries ?? []; track tenant.tenantId ?? $index) {
                      <div class="flex items-center justify-between text-xs py-1 border-b border-app-border last:border-0">
                        <span class="font-medium text-ink">{{ tenant.tenantName }}</span>
                        <div class="flex items-center gap-2 text-muted">
                          <span>{{ tenant.projectsCount ?? 0 }} {{ 'overview.projects' | transloco }}</span>
                          <span class="font-semibold text-stat-slate">{{ tenant.rulesCount ?? 0 }} {{ 'aiRules.section' | transloco }}</span>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Registered AI Tools -->
              <div class="rounded-lg border border-app-border p-4">
                <div class="font-semibold text-sm mb-3 flex items-center gap-2">
                  <mat-icon class="text-muted text-base">smart_toy</mat-icon>
                  {{ 'aiRules.activeTools' | transloco }}
                </div>
                @if ((insights.toolUsage ?? []).length === 0) {
                  <p class="text-xs text-muted">{{ 'aiRules.noToolsYet' | transloco }}</p>
                } @else {
                  <div class="flex flex-col gap-2">
                    @for (tool of insights.toolUsage ?? []; track tool.toolName ?? $index) {
                      <div class="flex items-center justify-between text-xs py-1 border-b border-app-border last:border-0">
                        <span class="font-medium font-mono text-ink">{{ tool.toolName }}</span>
                        <div class="flex items-center gap-2 text-muted">
                          <span>{{ tool.projectCount ?? 0 }} {{ 'overview.projects' | transloco }}</span>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Developer adoption -->
              <div class="rounded-lg border border-app-border p-4">
                <div class="font-semibold text-sm mb-3 flex items-center gap-2">
                  <mat-icon class="text-muted text-base">engineering</mat-icon>
                  {{ 'aiRules.userSummaries' | transloco }}
                </div>
                @if ((insights.userRuleSummaries ?? []).length === 0) {
                  <p class="text-xs text-muted">{{ 'aiRules.noPersonalRules' | transloco }}</p>
                } @else {
                  <div class="flex flex-col gap-2">
                    @for (user of insights.userRuleSummaries ?? []; track user.userId ?? $index) {
                      <div class="flex items-center justify-between text-xs py-1 border-b border-app-border last:border-0">
                        <span class="font-medium text-ink">{{ user.userName }}</span>
                        <span class="font-semibold text-stat-slate">{{ user.rulesCount ?? 0 }} {{ 'aiRules.section' | transloco }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Super Admin Detailed Rules Inspection -->
            @if (auth.isSuperAdmin()) {
              <div class="mt-5 pt-4 border-t border-app-border flex items-center justify-between">
                <div class="flex items-center gap-2 text-xs text-muted">
                  <mat-icon class="text-base text-primary">policy</mat-icon>
                  <span class="font-medium">{{ 'aiRules.detailedRulesTitle' | transloco }}</span>
                </div>
                <button mat-stroked-button (click)="showDetailedRules.set(!showDetailedRules())">
                  <mat-icon>{{ showDetailedRules() ? 'expand_less' : 'expand_more' }}</mat-icon>
                  {{ (showDetailedRules() ? 'aiRules.hideDetails' : 'aiRules.inspectDetails') | transloco }}
                </button>
              </div>

              @if (showDetailedRules()) {
                <div class="mt-4 overflow-x-auto">
                  <app-data-table
                    [rows]="detailedRulesRows()"
                    [columns]="detailedRulesColumns()"
                    [search]="true"
                    [searchPlaceholder]="'common.search' | transloco"
                    [emptyIcon]="'psychology'"
                    [emptyMessage]="'aiRules.emptyDetailedRules' | transloco"
                  >
                    <ng-template appDataTableCell="scope" let-row>
                      @if (row.isPersonal) {
                        <app-badge severity="neutral">{{ 'aiRules.personalBadge' | transloco }}</app-badge>
                      } @else if (row.isProjectAdminRule) {
                        <app-badge severity="warning">{{ 'aiRules.projectBadge' | transloco }}</app-badge>
                      } @else {
                        <app-badge severity="primary">{{ 'aiRules.inheritedBadge' | transloco }}</app-badge>
                      }
                    </ng-template>
                    <ng-template appDataTableCell="prompt" let-row>
                      <span class="line-clamp-2 text-xs font-mono text-muted" [title]="row.prompt">{{ row.prompt }}</span>
                    </ng-template>
                    <ng-template appDataTableCell="status" let-row>
                      <app-badge [severity]="row.isActive ? 'success' : 'danger'">
                        {{ (row.isActive ? 'common.active' : 'common.disabled') | transloco }}
                      </app-badge>
                    </ng-template>
                  </app-data-table>
                </div>
              }
            }
          </mat-card-content>
        </mat-card>
      }

      <div class="mb-3 flex items-center justify-between">
        <h2 class="m-0 text-[1.1rem] font-bold">{{ 'overview.breakdown' | transloco }}</h2>
        <button mat-stroked-button (click)="reloadAll()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon> {{ 'common.refresh' | transloco }}
        </button>
      </div>

      <div class="overflow-x-auto">
        <app-data-table
          [rows]="projectRows()"
          [columns]="columns()"
          [emptyIcon]="'folder_open'"
          [emptyMessage]="'overview.emptyProjects' | transloco"
          [emptyHint]="'overview.emptyProjectsHint' | transloco"
        >
          <ng-template appDataTableCell="key" let-row><code>{{ row.key }}</code></ng-template>
          <ng-template appDataTableCell="privateComments" let-row>
            @if (row.privateComments > 0) {
              <span class="inline-flex items-center gap-[3px] rounded-[11px] bg-stat-slate-bg px-2 py-px text-[0.78rem] font-semibold text-stat-slate" [title]="'overview.privateHiddenTooltip' | transloco">
                <mat-icon class="chip-icon !h-[14px] !w-[14px] !text-[14px] !leading-[14px]">lock</mat-icon>{{ row.privateComments }}
              </span>
            } @else {
              <span class="text-muted">—</span>
            }
          </ng-template>
          @for (st of statusCatalog.ordered(); track st.value) {
            <ng-template [appDataTableCell]="'status_' + st.value" let-row>
              <span [style.color]="st.color" class="font-medium">{{ statusCellValue(row, st.value) }}</span>
            </ng-template>
          }
          <ng-template appDataTableCell="status" let-row>
            <app-badge [severity]="row.isActive ? 'success' : 'danger'">
              {{ (row.isActive ? 'common.active' : 'common.disabled') | transloco }}
            </app-badge>
          </ng-template>
        </app-data-table>
      </div>
    } @else if (!loading()) {
      <div class="p-12 text-center">
        <p>No data available.</p>
        <button mat-stroked-button (click)="reloadAll()">{{ 'common.refresh' | transloco }}</button>
      </div>
    }
  `,
})
export class OverviewComponent {
  private usersService = inject(UsersService);
  private snack = inject(MatSnackBar);
  statusCatalog = inject(StatusCatalogService);
  auth = inject(AuthService);

  statsResource = getApiAdminStatsResource();
  pendingResource = getApiAdminUsersResource(signal({ status: 'pending' }));
  rolesResource = getApiAdminRolesResource();
  aiInsightsParams = computed<GetApiAdminAiRulesInsightsParams>(() => ({
    includeDetails: this.auth.isSuperAdmin(),
  }));
  aiInsightsResource = getApiAdminAiRulesInsightsResource(this.aiInsightsParams);

  stats = computed(() => this.statsResource.value());
  aiInsights = computed(() => this.aiInsightsResource.value() as unknown as AiInsightsResponse | undefined);
  /** Rows behind the breakdown table — read as a signal so the empty state reacts. */
  projectRows = computed<ProjectStats[]>(() => this.statsResource.value()?.projects ?? []);
  pendingUsers = computed(() => this.pendingResource.value() ?? []);
  pendingCount = computed(() => this.pendingResource.value()?.length ?? 0);
  roles = computed(() => this.rolesResource.value() ?? []);

  showDetailedRules = signal(false);
  detailedRulesRows = computed<AiRuleResponse[]>(() => this.aiInsights()?.detailedRules ?? []);

  busy = signal(false);
  loading = computed(() => this.statsResource.isLoading() || this.busy());

  approveSelection: Record<number, number> = {};

  reloadAll(): void {
    this.statsResource.reload();
    this.aiInsightsResource.reload();
  }

  private transloco = inject(TranslocoService);

  detailedRulesColumns(): DataTableColumn<AiRuleResponse>[] {
    return [
      { key: 'tenantName', header: this.transloco.translate('aiRules.workspace'), sortable: true },
      { key: 'projectName', header: this.transloco.translate('overview.projects'), sortable: true },
      { key: 'scope', header: this.transloco.translate('aiRules.ruleScope'), sortable: false },
      { key: 'userName', header: this.transloco.translate('aiRules.author'), sortable: true },
      { key: 'title', header: this.transloco.translate('aiRules.titleLabel'), sortable: true },
      { key: 'prompt', header: this.transloco.translate('aiRules.instruction'), sortable: false },
      { key: 'status', header: this.transloco.translate('overview.status'), sortable: true },
    ];
  }

  /** Dynamic columns: key, name, comments, privateComments, status_1..N, status. A method (not a
   *  stored field) so headers stay live if the app language changes. */
  columns(): DataTableColumn<ProjectStats>[] {
    const statusCols: DataTableColumn<ProjectStats>[] = this.statusCatalog.ordered().map((s) => ({
      key: `status_${s.value}`,
      header: this.statusCatalog.displayLabel(s),
      sortable: true,
      headerColor: s.color ?? undefined,
    }));
    return [
      { key: 'key', header: this.transloco.translate('overview.key'), sortable: true },
      { key: 'name', header: this.transloco.translate('overview.name'), sortable: true },
      { key: 'comments', header: this.transloco.translate('overview.comments'), sortable: true },
      { key: 'privateComments', header: this.transloco.translate('overview.private'), sortable: true },
      ...statusCols,
      { key: 'status', header: this.transloco.translate('overview.status'), sortable: true },
    ];
  }

  /** Map status value → count field on ProjectStats. */
  statusCellValue(row: ProjectStats, statusValue: number | undefined): number {
    switch (statusValue) {
      case 1: return row.open ?? 0;
      case 2: return row.pending ?? 0;
      case 3: return row.completed ?? 0;
      case 4: return row.archived ?? 0;
      default: return 0;
    }
  }

  /** Map status value → total from StatsResponse totals. */
  statusTotal(stats: NonNullable<ReturnType<typeof this.stats>>, statusValue: number | undefined): number {
    switch (statusValue) {
      case 1: return stats.totals?.open ?? 0;
      case 2: return stats.totals?.pending ?? 0;
      case 3: return stats.totals?.completed ?? 0;
      case 4: return stats.totals?.archived ?? 0;
      default: return 0;
    }
  }

  activeRoles(): RoleResponse[] { return this.roles().filter(r => r.isActive); }

  approve(user: UserResponse) {
    const roleId = this.approveSelection[user.id!] ?? user.roleId;
    this.busy.set(true);
    this.usersService.postApiAdminUsersIdApprove(user.id!, { roleId }).subscribe({
      next: () => {
        this.busy.set(false);
        this.pendingResource.reload();
        this.statsResource.reload();
      },
      error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
    });
  }

  reject(user: UserResponse) {
    this.busy.set(true);
    this.usersService.postApiAdminUsersIdReject(user.id!).subscribe({
      next: () => {
        this.busy.set(false);
        this.pendingResource.reload();
        this.statsResource.reload();
      },
      error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
    });
  }
}
