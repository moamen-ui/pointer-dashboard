import { Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { BidiModule } from '@angular/cdk/bidi';
import {
  getApiAdminStatsResource,
  getApiAdminUsersResource,
  getApiAdminRolesResource,
  getApiAdminAiRulesInsightsResource,
} from '@moamen-ui/pointer-angular';
import type {
  ProjectStats,
  StatsResponse,
  UserResponse,
  RoleResponse,
  AiInsightsResponse,
  AiRuleResponse,
  GetApiAdminAiRulesInsightsParams,
} from '@moamen-ui/pointer-angular';
import { StatusCatalogService } from '../../core/status/status-catalog.service';
import { extractMessage } from '../../core/api/extract-message';
import { UsersService } from '@moamen-ui/pointer-angular';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppCountCellComponent } from '../../shared/ui/app-count-cell.component';
import { AppDiffstatComponent, type DiffstatItem } from '../../shared/ui/app-diffstat.component';
import { AppIconComponent } from '../../shared/ui/app-icon.component';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { AppToastService } from '../../shared/ui/app-toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { InstallGuideService } from '../../shared/install-guide/install-guide.service';
import { AppDataTableComponent, type DataTableColumn } from '../../shared/ui/app-data-table.component';
import { DataTableCellDirective } from '../../shared/data-table/data-table-cell.directive';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    AppCountCellComponent,
    AppDiffstatComponent,
    BidiModule,
    TranslocoModule,
    DatePipe,
    AppButtonDirective,
    AppIconComponent,
    BadgeComponent,
    AppDataTableComponent,
    DataTableCellDirective,
  ],
  template: `
    <div class="space-y-6">
      <!-- Title row with refresh button -->
      <div class="flex items-center justify-between gap-4 mb-4">
        <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
          {{ 'overview.title' | transloco }}
        </h1>
        <button
          appButton
          variant="secondary"
          size="sm"
          (click)="reloadAll()"
          [disabled]="loading()"
          [attr.aria-label]="'common.refresh' | transloco"
        >
          @if (loading()) {
            <app-icon name="loader-2" [size]="16" class="animate-spin"></app-icon>
          } @else {
            <app-icon name="refresh-cw" [size]="16"></app-icon>
          }
          {{ 'common.refresh' | transloco }}
        </button>
      </div>

      <!-- Diffstat line: comments · open · ready · completed · archived · projects · users -->
      @if (stats(); as s) {
        <app-diffstat [items]="totalsDiffstat(s)"></app-diffstat>

        <!-- Pending approvals section (only when non-empty) -->
        @if (pendingUsers().length > 0) {
          <div>
            <div class="flex items-center gap-2 mb-3">
              <h2 class="text-[16px] font-semibold leading-6">
                {{ 'overview.pendingApprovals' | transloco }}
              </h2>
              <div class="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] font-medium text-state-ready bg-state-ready-tint border-state-ready/30">
                <span class="inline-flex h-1.5 w-1.5 rounded-full bg-state-ready"></span>
                {{ pendingUsers().length }}
              </div>
            </div>
            <div class="rounded-md border border-border overflow-x-auto">
              @for (user of pendingUsers(); track user.id) {
                <div class="min-h-11 px-3 py-2 flex items-center gap-4 border-t border-border-muted first:border-t-0">
                  <div class="flex-1 min-w-0">
                    <div class="text-[14px] font-medium text-foreground">{{ user.displayName }}</div>
                    <div class="flex items-center gap-3 flex-wrap mt-1">
                      <span class="text-[13px] text-muted-foreground">{{ user.email }}</span>
                      <div class="inline-flex h-6 items-center gap-1 rounded-full border border-state-archived/30 px-2 text-[12px] font-medium text-state-archived bg-state-archived-tint">
                        {{ user.roleName }}
                      </div>
                      <span class="text-[12px] text-faint-foreground">
                        {{ 'overview.requested' | transloco }}: {{ user.createdAt | date:'dd-MM-yyyy HH:mm' }}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      appButton
                      variant="primary"
                      size="sm"
                      (click)="openApproveDialog(user)"
                      [disabled]="busy()"
                    >
                      {{ 'overview.approve' | transloco }}
                    </button>
                    <button
                      appButton
                      variant="secondary"
                      size="sm"
                      (click)="openRejectConfirm(user)"
                      [disabled]="busy()"
                    >
                      {{ 'overview.reject' | transloco }}
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Projects table section -->
        <div>
          <h2 class="text-[16px] font-semibold leading-6 mb-3">
            {{ 'overview.projects' | transloco }}
          </h2>
          <div class="rounded-md border border-border overflow-x-auto">
            @if (projectRows().length > 0) {
              <table class="w-full border-collapse">
                <thead>
                  <tr class="h-10 bg-gutter text-[13px] font-medium text-muted-foreground border-b border-border">
                    <th class="w-10 text-end font-mono text-[12px] text-faint-foreground px-3"></th>
                    <th class="px-3 text-start" [attr.aria-sort]="ariaSort('name')">
                      <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-foreground" (click)="toggleSort('name')">
                        {{ 'overview.name' | transloco }}
                        <app-icon [name]="sortGlyph('name')" [size]="14" [class.opacity-40]="sortKey() !== 'name'"></app-icon>
                      </button>
                    </th>
                    <th class="px-3 text-start" [attr.aria-sort]="ariaSort('comments')">
                      <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-foreground" (click)="toggleSort('comments')">
                        {{ 'overview.comments' | transloco }}
                        <app-icon [name]="sortGlyph('comments')" [size]="14" [class.opacity-40]="sortKey() !== 'comments'"></app-icon>
                      </button>
                    </th>
                    <th class="w-8 px-3 text-start" [attr.aria-sort]="ariaSort('privateComments')">
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                        [attr.aria-label]="'overview.privateHiddenTooltip' | transloco"
                        [title]="'overview.privateHiddenTooltip' | transloco"
                        (click)="toggleSort('privateComments')"
                      >
                        <app-icon name="lock" [size]="14"></app-icon>
                        <app-icon [name]="sortGlyph('privateComments')" [size]="14" [class.opacity-40]="sortKey() !== 'privateComments'"></app-icon>
                      </button>
                    </th>
                    @for (st of statusCatalog.ordered(); track st.value) {
                      <th class="px-3 text-start" [class]="toneTextClass(st.value)" [attr.aria-sort]="ariaSort('status_' + st.value)">
                        <button type="button" class="inline-flex items-center gap-1" (click)="toggleSort('status_' + st.value)">
                          {{ statusCatalog.displayLabel(st) }}
                          <app-icon [name]="sortGlyph('status_' + st.value)" [size]="14" [class.opacity-40]="sortKey() !== 'status_' + st.value"></app-icon>
                        </button>
                      </th>
                    }
                    <th class="px-3 text-start" [attr.aria-sort]="ariaSort('isActive')">
                      <button type="button" class="inline-flex items-center gap-1 transition-colors hover:text-foreground" (click)="toggleSort('isActive')">
                        {{ 'overview.status' | transloco }}
                        <app-icon [name]="sortGlyph('isActive')" [size]="14" [class.opacity-40]="sortKey() !== 'isActive'"></app-icon>
                      </button>
                    </th>
                    <th class="w-4"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (project of sortedProjectRows(); track project.projectId; let idx = $index) {
                    <tr
                      class="h-11 border-t border-border-muted hover:bg-gutter/60 transition-colors cursor-pointer"
                      (click)="navigateToProject(project)"
                    >
                      <td class="w-10 text-end font-mono text-[12px] text-faint-foreground px-3">{{ idx + 1 }}</td>
                      <td class="px-3">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="text-[14px] font-medium text-foreground truncate">{{ project.name }}</span>
                          <code class="rounded bg-gutter px-1.5 py-0.5 font-mono text-[13px] shrink-0">{{ project.key }}</code>
                        </div>
                      </td>
                      <td class="px-3 font-mono text-[14px]">{{ project.comments ?? 0 }}</td>
                      <td class="px-3">
                        @if ((project.privateComments ?? 0) > 0) {
                          <span
                            class="inline-flex items-center gap-1 font-mono text-[14px]"
                            [title]="'overview.privateHiddenTooltip' | transloco"
                          >
                            <app-icon name="lock" [size]="16"></app-icon>
                            {{ project.privateComments }}
                          </span>
                        } @else {
                          <span class="text-faint-foreground">—</span>
                        }
                      </td>
                      @for (st of statusCatalog.ordered(); track st.value) {
                        <td class="px-3">
                          <app-count-cell [count]="getProjectStatusCount(project, st.value)" [state]="stateFor(st.value)"></app-count-cell>
                        </td>
                      }
                      <td class="px-3">
                        <app-badge [severity]="project.isActive ? 'success' : 'neutral'">
                          {{ (project.isActive ? 'common.active' : 'common.disabled') | transloco }}
                        </app-badge>
                      </td>
                      <td class="w-4 pe-3">
                        <app-icon
                          name="chevron-right"
                          [size]="16"
                          class="text-muted-foreground rtl:-scale-x-100"
                        ></app-icon>
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
                    <th class="px-3 text-start">{{ 'overview.name' | transloco }}</th>
                    <th class="px-3 text-start">{{ 'overview.comments' | transloco }}</th>
                    <th class="w-8"></th>
                    @for (st of statusCatalog.ordered(); track st.value) {
                      <th class="px-3 text-start" [class]="toneTextClass(st.value)">
                        {{ statusCatalog.displayLabel(st) }}
                      </th>
                    }
                    <th class="px-3 text-start">{{ 'overview.status' | transloco }}</th>
                    <th class="w-4"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="h-11 border-t border-dashed border-border-muted">
                    <td class="px-3 text-[14px] text-muted-foreground">
                      {{ 'overview.emptyProjects' | transloco }}
                    </td>
                    <td colspan="100" class="text-end pe-3">
                      <button
                        appButton
                        variant="primary"
                        size="sm"
                        (click)="openInstallGuide()"
                      >
                        {{ 'install.open' | transloco }}
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

        <!-- AI Insights section (only when data exists) -->
        @if (aiInsights(); as insights) {
          <div>
            <div class="mb-3">
              <h2 class="text-[16px] font-semibold leading-6">
                {{ 'aiRules.insightsTitle' | transloco }}
              </h2>
              <p class="mt-1 text-[14px] text-muted-foreground">
                {{ 'aiRules.insightsSubtitle' | transloco }}
              </p>
            </div>

            <!-- Diffstat line for 4 counts -->
            <app-diffstat [items]="rulesDiffstat(insights)"></app-diffstat>

            <!-- Grid of bordered lists -->
            <div
              [class]="
                auth.isSuperAdmin() && (insights.tenantSummaries?.length ?? 0) > 0
                  ? 'grid gap-4 md:grid-cols-3'
                  : 'grid gap-4 md:grid-cols-2'
              "
            >
              <!-- Workspaces (super admin) -->
              @if (auth.isSuperAdmin() && (insights.tenantSummaries?.length ?? 0) > 0) {
                <div class="rounded-md border border-border overflow-x-auto">
                  <div class="h-11 px-3 py-2 flex items-center gap-2 bg-gutter border-b border-border-muted">
                    <app-icon name="building-2" [size]="16" class="text-muted-foreground"></app-icon>
                    <span class="text-[14px] font-medium text-foreground">
                      {{ 'aiRules.tenantSummaries' | transloco }}
                    </span>
                  </div>
                  <div class="flex flex-col">
                    @for (tenant of insights.tenantSummaries ?? []; track tenant.tenantId; let idx = $index) {
                      <div
                        class="min-h-11 px-3 py-2 flex items-center justify-between gap-4"
                        [class.border-t]="idx > 0"
                        [class.border-border-muted]="idx > 0"
                      >
                        <span class="text-[14px] font-medium text-foreground">
                          {{ tenant.tenantName }}
                        </span>
                        <div class="text-[13px] text-muted-foreground">
                          {{ tenant.projectsCount ?? 0 }} {{ 'overview.projects' | transloco }} · {{ tenant.rulesCount ?? 0 }} {{ 'aiRules.section' | transloco }}
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Active tools -->
              <div class="rounded-md border border-border overflow-x-auto">
                <div class="h-11 px-3 py-2 flex items-center gap-2 bg-gutter border-b border-border-muted">
                  <app-icon name="bot" [size]="16" class="text-muted-foreground"></app-icon>
                  <span class="text-[14px] font-medium text-foreground">
                    {{ 'aiRules.activeTools' | transloco }}
                  </span>
                </div>
                @if ((insights.toolUsage ?? []).length === 0) {
                  <div class="px-3 py-2 text-[13px] text-muted-foreground">
                    {{ 'aiRules.noToolsYet' | transloco }}
                  </div>
                } @else {
                  <div class="flex flex-col">
                    @for (tool of insights.toolUsage ?? []; track tool.toolName; let idx = $index) {
                      <div
                        class="min-h-11 px-3 py-2 flex items-center justify-between gap-4"
                        [class.border-t]="idx > 0"
                        [class.border-border-muted]="idx > 0"
                      >
                        <span class="font-mono text-[13px] font-medium text-foreground">
                          {{ tool.toolName }}
                        </span>
                        <div class="text-[13px] text-muted-foreground">
                          {{ tool.projectCount ?? 0 }} {{ 'overview.projects' | transloco }}
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Developer adoption -->
              <div class="rounded-md border border-border overflow-x-auto">
                <div class="h-11 px-3 py-2 flex items-center gap-2 bg-gutter border-b border-border-muted">
                  <app-icon name="wrench" [size]="16" class="text-muted-foreground"></app-icon>
                  <span class="text-[14px] font-medium text-foreground">
                    {{ 'aiRules.userSummaries' | transloco }}
                  </span>
                </div>
                @if ((insights.userRuleSummaries ?? []).length === 0) {
                  <div class="px-3 py-2 text-[13px] text-muted-foreground">
                    {{ 'aiRules.noPersonalRules' | transloco }}
                  </div>
                } @else {
                  <div class="flex flex-col">
                    @for (user of insights.userRuleSummaries ?? []; track user.userId; let idx = $index) {
                      <div
                        class="min-h-11 px-3 py-2 flex items-center justify-between gap-4"
                        [class.border-t]="idx > 0"
                        [class.border-border-muted]="idx > 0"
                      >
                        <span class="text-[14px] font-medium text-foreground">
                          {{ user.userName }}
                        </span>
                        <div class="text-[13px] text-muted-foreground">
                          {{ user.rulesCount ?? 0 }} {{ 'aiRules.section' | transloco }}
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Super Admin Detailed Rules Inspection -->
            @if (auth.isSuperAdmin()) {
              <div class="space-y-3 border-t border-border pt-4 mt-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <app-icon name="shield-check" [size]="16" class="text-brand"></app-icon>
                    <span class="text-[14px] font-medium text-foreground">
                      {{ 'aiRules.detailedRulesTitle' | transloco }}
                    </span>
                  </div>
                  <button
                    appButton
                    variant="secondary"
                    size="sm"
                    (click)="showDetailedRules.set(!showDetailedRules())"
                  >
                    <app-icon
                      [name]="showDetailedRules() ? 'chevron-up' : 'chevron-down'"
                      [size]="16"
                    ></app-icon>
                    {{ (showDetailedRules() ? 'aiRules.hideDetails' : 'aiRules.inspectDetails') | transloco }}
                  </button>
                </div>

                @if (showDetailedRules()) {
                  <div class="overflow-x-auto">
                    <app-data-table
                      [rows]="detailedRulesRows()"
                      [columns]="detailedRulesColumns()"
                      [searchable]="true"
                      [searchPlaceholder]="'common.search' | transloco"
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
                        <span class="line-clamp-2 text-xs font-mono text-muted-foreground" [title]="row.prompt">{{ row.prompt }}</span>
                      </ng-template>
                      <ng-template appDataTableCell="status" let-row>
                        <app-badge [severity]="row.isActive ? 'success' : 'neutral'">
                          {{ (row.isActive ? 'common.active' : 'common.disabled') | transloco }}
                        </app-badge>
                      </ng-template>
                    </app-data-table>
                  </div>
                }
              </div>
            }
          </div>
        }
      } @else if (!loading()) {
        <div class="p-12 text-center">
          <p class="text-[14px] text-muted-foreground">{{ 'common.noData' | transloco }}</p>
          <button appButton variant="secondary" (click)="reloadAll()" class="mt-4">
            {{ 'common.refresh' | transloco }}
          </button>
        </div>
      }
    </div>
  `,
})
export class OverviewComponent {
  /** The diff hue for a status value as a text class — the vocabulary labels and counts share. */
  toneTextClass(value: number | undefined): string {
    switch (value) {
      case 2: return 'text-state-ready';
      case 3: return 'text-state-completed';
      case 4: return 'text-state-archived';
      default: return 'text-state-open';
    }
  }

  /** Built-in status values 1..4 mapped to the diff hue used by app-count-cell. */
  stateFor(value: number | undefined): 'open' | 'ready' | 'completed' | 'archived' {
    return value === 2 ? 'ready' : value === 3 ? 'completed' : value === 4 ? 'archived' : 'open';
  }

  private usersService = inject(UsersService);
  private transloco = inject(TranslocoService);
  private toast = inject(AppToastService);
  readonly auth = inject(AuthService);
  private installGuide = inject(InstallGuideService);
  readonly statusCatalog = inject(StatusCatalogService);

  readonly statsResource = getApiAdminStatsResource();
  readonly pendingResource = getApiAdminUsersResource(signal({ status: 'pending' }));
  readonly rolesResource = getApiAdminRolesResource();
  readonly aiInsightsParams = computed<GetApiAdminAiRulesInsightsParams>(() => ({
    includeDetails: this.auth.isSuperAdmin(),
  }));
  readonly aiInsightsResource = getApiAdminAiRulesInsightsResource(this.aiInsightsParams);

  readonly stats = computed(() => this.statsResource.value());
  readonly projectRows = computed<ProjectStats[]>(() => this.stats()?.projects ?? []);

  /** Overview totals as a diffstat line — same items, order and tones as React/Vue. */
  totalsDiffstat(s: StatsResponse): DiffstatItem[] {
    const t = s.totals;
    const items: DiffstatItem[] = [
      { label: this.transloco.translate('overview.comments'), count: t?.comments ?? 0, tone: 'open' },
      { label: this.statusCatalog.displayLabelFor(1), count: t?.open ?? 0, tone: 'open' },
      { label: this.statusCatalog.displayLabelFor(2), count: t?.pending ?? 0, tone: 'ready' },
      { label: this.statusCatalog.displayLabelFor(3), count: t?.completed ?? 0, tone: 'completed' },
      { label: this.statusCatalog.displayLabelFor(4), count: t?.archived ?? 0, tone: 'archived' },
      { label: this.transloco.translate('overview.projects'), count: t?.projects ?? 0 },
      { label: this.transloco.translate('overview.users'), count: t?.users ?? 0 },
    ];
    if ((t?.privateComments ?? 0) > 0) {
      items.push({
        label: this.transloco.translate('overview.private'),
        count: t?.privateComments ?? 0,
        icon: 'lock',
        title: this.transloco.translate('overview.privateHiddenTooltip'),
      });
    }
    return items;
  }

  /** Rules-insight counts as a diffstat line — same tones as React/Vue (workspace = open, developer = ready). */
  rulesDiffstat(insights: AiInsightsResponse): DiffstatItem[] {
    return [
      { label: this.transloco.translate('aiRules.totalRules'), count: insights.totalRulesCount ?? 0 },
      { label: this.transloco.translate('aiRules.tenantRules'), count: insights.tenantRulesCount ?? 0, tone: 'open' },
      { label: this.transloco.translate('aiRules.projectRules'), count: insights.projectRulesCount ?? 0 },
      { label: this.transloco.translate('aiRules.userRules'), count: insights.userPersonalRulesCount ?? 0, tone: 'ready' },
    ];
  }

  /** Overview table sorting — same three-step cycle as React/Vue (asc → desc → unsorted). */
  readonly sortKey = signal<string | null>(null);
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  readonly sortedProjectRows = computed<ProjectStats[]>(() => {
    const rows = this.projectRows();
    const key = this.sortKey();
    if (!key) return rows;
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = this.sortValue(a, key);
      const bv = this.sortValue(b, key);
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
      }
      return ((av as number) - (bv as number)) * dir;
    });
  });

  private sortValue(row: ProjectStats, key: string): string | number {
    if (key.startsWith('status_')) {
      return this.getProjectStatusCount(row, Number(key.slice('status_'.length)));
    }
    switch (key) {
      case 'name': return row.name ?? '';
      case 'comments': return row.comments ?? 0;
      case 'privateComments': return row.privateComments ?? 0;
      case 'isActive': return row.isActive ? 1 : 0;
      default: return '';
    }
  }

  toggleSort(key: string): void {
    if (this.sortKey() !== key) {
      this.sortKey.set(key);
      this.sortDir.set('asc');
      return;
    }
    if (this.sortDir() === 'asc') {
      this.sortDir.set('desc');
      return;
    }
    this.sortKey.set(null);
  }

  /** Two-way arrow at 40% opacity until the column is sorted, then the direction arrow. */
  sortGlyph(key: string): 'arrow-up' | 'arrow-down' | 'arrow-up-down' {
    if (this.sortKey() !== key) return 'arrow-up-down';
    return this.sortDir() === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }
  readonly pendingUsers = computed(() => this.pendingResource.value() ?? []);
  readonly roles = computed(() => this.rolesResource.value() ?? []);
  readonly aiInsights = computed(() => this.aiInsightsResource.value() as unknown as AiInsightsResponse | undefined);

  readonly showDetailedRules = signal(false);
  readonly detailedRulesRows = computed<AiRuleResponse[]>(() => this.aiInsights()?.detailedRules ?? []);

  readonly busy = signal(false);
  readonly loading = computed(() => this.statsResource.isLoading() || this.busy());

  private approveSelection: Record<number, number> = {};

  reloadAll(): void {
    this.statsResource.reload();
    this.aiInsightsResource.reload();
  }

  navigateToProject(_: ProjectStats): void {
    // Will be implemented when routing is set up
    // For now, the row is clickable but does nothing
  }

  openApproveDialog(user: UserResponse): void {
    const activeRoles = this.roles().filter((r) => r.isActive);
    this.approveSelection[user.id!] = user.roleId ?? activeRoles[0]?.id ?? 0;
    // Will open the approve dialog when it's built
    // For now, just approve with the current role
    this.approve(user, this.approveSelection[user.id!]);
  }

  openRejectConfirm(user: UserResponse): void {
    // Will open the reject confirmation dialog when it's built
    // For now, just reject directly
    this.reject(user);
  }

  approve(user: UserResponse, roleId: number): void {
    this.busy.set(true);
    this.usersService.postApiAdminUsersIdApprove(user.id!, { roleId }).subscribe({
      next: () => {
        this.busy.set(false);
        this.pendingResource.reload();
        this.statsResource.reload();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  reject(user: UserResponse): void {
    this.busy.set(true);
    this.usersService.postApiAdminUsersIdReject(user.id!).subscribe({
      next: () => {
        this.busy.set(false);
        this.pendingResource.reload();
        this.statsResource.reload();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  getProjectStatusCount(row: ProjectStats, statusValue: number | undefined): number {
    switch (statusValue) {
      case 1: return row.open ?? 0;
      case 2: return row.pending ?? 0;
      case 3: return row.completed ?? 0;
      case 4: return row.archived ?? 0;
      default: return 0;
    }
  }


  detailedRulesColumns(): DataTableColumn<AiRuleResponse>[] {
    return [
      { key: 'tenantName', header: 'aiRules.workspace', sortable: true },
      { key: 'projectName', header: 'overview.projects', sortable: true },
      { key: 'scope', header: 'aiRules.ruleScope', sortable: false },
      { key: 'userName', header: 'aiRules.author', sortable: true },
      { key: 'title', header: 'aiRules.titleLabel', sortable: true },
      { key: 'prompt', header: 'aiRules.instruction', sortable: false },
      { key: 'status', header: 'overview.status', sortable: true },
    ];
  }

  openInstallGuide(): void {
    this.installGuide.open();
  }
}
