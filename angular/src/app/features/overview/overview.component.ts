import { Component, inject, signal, computed, effect, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { UsersService } from '@moamen-ui/pointer-angular';
import { getApiAdminStatsResource } from '@moamen-ui/pointer-angular';
import { getApiAdminUsersResource } from '@moamen-ui/pointer-angular';
import { getApiAdminRolesResource } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import type { ProjectStats, UserResponse, RoleResponse } from '@moamen-ui/pointer-angular';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatProgressBarModule,
    MatIconModule,
    MatSortModule,
    MatMenuModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    DatePipe,
    TranslocoModule,
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
        <mat-card class="rounded-[14px] bg-panel text-ink" appearance="outlined">
          <mat-card-content class="flex items-center gap-3.5 p-4">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stat-blue-bg text-stat-blue"><mat-icon>radio_button_unchecked</mat-icon></div>
            <div class="flex flex-col"><div class="text-[1.7rem] font-bold leading-[1.1] text-stat-blue">{{ s.totals?.open }}</div><div class="mt-0.5 text-[0.72rem] uppercase tracking-[0.04em] text-muted">{{ 'overview.open' | transloco }}</div></div>
          </mat-card-content>
        </mat-card>
        <mat-card class="rounded-[14px] bg-panel text-ink" appearance="outlined">
          <mat-card-content class="flex items-center gap-3.5 p-4">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stat-amber-bg text-stat-amber"><mat-icon>schedule</mat-icon></div>
            <div class="flex flex-col"><div class="text-[1.7rem] font-bold leading-[1.1] text-stat-amber">{{ s.totals?.pending }}</div><div class="mt-0.5 text-[0.72rem] uppercase tracking-[0.04em] text-muted">{{ 'overview.pending' | transloco }}</div></div>
          </mat-card-content>
        </mat-card>
        <mat-card class="rounded-[14px] bg-panel text-ink" appearance="outlined">
          <mat-card-content class="flex items-center gap-3.5 p-4">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stat-green-bg text-stat-green"><mat-icon>check_circle</mat-icon></div>
            <div class="flex flex-col"><div class="text-[1.7rem] font-bold leading-[1.1] text-stat-green">{{ s.totals?.completed }}</div><div class="mt-0.5 text-[0.72rem] uppercase tracking-[0.04em] text-muted">{{ 'overview.completed' | transloco }}</div></div>
          </mat-card-content>
        </mat-card>
        <mat-card class="rounded-[14px] bg-panel text-ink" appearance="outlined">
          <mat-card-content class="flex items-center gap-3.5 p-4">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stat-slate-bg text-stat-slate"><mat-icon>archive</mat-icon></div>
            <div class="flex flex-col"><div class="text-[1.7rem] font-bold leading-[1.1] text-stat-slate">{{ s.totals?.archived }}</div><div class="mt-0.5 text-[0.72rem] uppercase tracking-[0.04em] text-muted">{{ 'overview.archived' | transloco }}</div></div>
          </mat-card-content>
        </mat-card>
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
            <p class="mb-0 mt-2 text-muted">{{ 'overview.noPending' | transloco }}</p>
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
                        <span class="text-[0.8rem]">{{ $any(u).createdAt | date:'mediumDate' }}</span>
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

      <div class="mb-3 flex items-center justify-between">
        <h2 class="m-0 text-[1.1rem] font-bold">{{ 'overview.breakdown' | transloco }}</h2>
        <button mat-stroked-button (click)="statsResource.reload()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon> {{ 'common.refresh' | transloco }}
        </button>
      </div>

      <div class="overflow-x-auto">
        <table mat-table [dataSource]="tableDataSource" matSort class="w-full mat-elevation-z1">
          <ng-container matColumnDef="key">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'overview.key' | transloco }}</th>
            <td mat-cell *matCellDef="let row"><code>{{ row.key }}</code></td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'overview.name' | transloco }}</th>
            <td mat-cell *matCellDef="let row">{{ row.name }}</td>
          </ng-container>
          <ng-container matColumnDef="comments">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'overview.comments' | transloco }}</th>
            <td mat-cell *matCellDef="let row">{{ row.comments }}</td>
          </ng-container>
          <ng-container matColumnDef="privateComments">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'overview.private' | transloco }}</th>
            <td mat-cell *matCellDef="let row">
              @if (row.privateComments > 0) {
                <span class="inline-flex items-center gap-[3px] rounded-[11px] bg-stat-slate-bg px-2 py-px text-[0.78rem] font-semibold text-stat-slate" [title]="'overview.privateHiddenTooltip' | transloco">
                  <mat-icon class="chip-icon !h-[14px] !w-[14px] !text-[14px] !leading-[14px]">lock</mat-icon>{{ row.privateComments }}
                </span>
              } @else {
                <span class="text-muted">—</span>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="open">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'overview.open' | transloco }}</th>
            <td mat-cell *matCellDef="let row" class="font-medium text-stat-blue">{{ row.open }}</td>
          </ng-container>
          <ng-container matColumnDef="pending">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'overview.pending' | transloco }}</th>
            <td mat-cell *matCellDef="let row" class="font-medium text-stat-amber">{{ row.pending }}</td>
          </ng-container>
          <ng-container matColumnDef="completed">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'overview.completed' | transloco }}</th>
            <td mat-cell *matCellDef="let row" class="font-medium text-stat-green">{{ row.completed }}</td>
          </ng-container>
          <ng-container matColumnDef="archived">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'overview.archived' | transloco }}</th>
            <td mat-cell *matCellDef="let row" class="font-medium text-stat-slate">{{ row.archived }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'overview.status' | transloco }}</th>
            <td mat-cell *matCellDef="let row">
              <span [class]="row.isActive ? 'chip chip-active' : 'chip chip-disabled'">
                {{ (row.isActive ? 'common.active' : 'common.disabled') | transloco }}
              </span>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>
    } @else if (!loading()) {
      <div class="p-12 text-center">
        <p>No data available.</p>
        <button mat-stroked-button (click)="statsResource.reload()">{{ 'common.refresh' | transloco }}</button>
      </div>
    }
  `,
})
export class OverviewComponent {
  private usersService = inject(UsersService);
  private snack = inject(MatSnackBar);

  statsResource = getApiAdminStatsResource();
  pendingResource = getApiAdminUsersResource(signal({ status: 'pending' }));
  rolesResource = getApiAdminRolesResource();

  stats = computed(() => this.statsResource.value());
  pendingUsers = computed(() => this.pendingResource.value() ?? []);
  pendingCount = computed(() => this.pendingResource.value()?.length ?? 0);
  roles = computed(() => this.rolesResource.value() ?? []);

  busy = signal(false);
  loading = computed(() => this.statsResource.isLoading() || this.busy());

  approveSelection: Record<number, number> = {};
  tableDataSource = new MatTableDataSource<ProjectStats>([]);
  displayedColumns = ['key', 'name', 'comments', 'privateComments', 'open', 'pending', 'completed', 'archived', 'status'];

  readonly sort = viewChild(MatSort);

  constructor() {
    effect(() => {
      const stats = this.statsResource.value();
      if (stats?.projects) {
        this.tableDataSource.data = stats.projects;
      }
    });
    // Wire the sort header to the data source once it's in the view.
    effect(() => {
      const sort = this.sort();
      if (sort) this.tableDataSource.sort = sort;
    });
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
