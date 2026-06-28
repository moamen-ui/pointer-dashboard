import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoModule } from '@jsverse/transloco';
import { getApiMeProfileResource, getApiAdminUsersIdProfileResource } from '@moamen-ui/pointer-angular';
import { HttpResourceRef } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { StatusCatalogService } from '../../core/status/status-catalog.service';
import type { ProfileProject, ProfileEnvironment, UserProfileResponse } from '@moamen-ui/pointer-angular';

const ENV_LABELS: Record<number, string> = { 1: 'Local', 2: 'Staging', 3: 'Production' };

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    MatCardModule,
    MatProgressBarModule,
    MatIconModule,
    MatButtonModule,
    TranslocoModule,
  ],
  template: `
    @if (loading()) {
      <mat-progress-bar mode="indeterminate" class="fixed inset-x-0 top-0 z-[1000]"></mat-progress-bar>
    }

    @if (profile(); as p) {
      <!-- Header -->
      <div class="mb-6">
        <h1 class="m-0 text-[1.6rem] font-bold">
          @if (p.user?.displayName) { {{ p.user!.displayName }} } @else { {{ 'profile.title' | transloco }} }
        </h1>
        @if (p.user?.email) {
          <p class="mt-1 text-[0.9rem] text-muted">{{ p.user!.email }} · {{ p.user!.roleName }}</p>
        }
      </div>

      <!-- Headline stats -->
      <div class="mb-6 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
        <mat-card class="rounded-[14px] bg-panel text-ink" appearance="outlined">
          <mat-card-content class="flex items-center gap-3 p-4">
            <mat-icon class="text-brand">folder</mat-icon>
            <div>
              <div class="text-[1.5rem] font-bold leading-[1.1]">{{ p.totals?.projectsInvolved ?? 0 }}</div>
              <div class="text-[0.72rem] uppercase tracking-[0.04em] text-muted">{{ 'profile.projects' | transloco }}</div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="rounded-[14px] bg-panel text-ink" appearance="outlined">
          <mat-card-content class="flex items-center gap-3 p-4">
            <mat-icon class="text-muted">chat_bubble_outline</mat-icon>
            <div>
              <div class="text-[1.5rem] font-bold leading-[1.1]">{{ p.totals?.comments ?? 0 }}</div>
              <div class="text-[0.72rem] uppercase tracking-[0.04em] text-muted">{{ 'profile.comments' | transloco }}</div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="rounded-[14px] bg-panel text-ink" appearance="outlined">
          <mat-card-content class="flex items-center gap-3 p-4">
            <mat-icon class="text-muted">reply</mat-icon>
            <div>
              <div class="text-[1.5rem] font-bold leading-[1.1]">{{ p.totals?.replies ?? 0 }}</div>
              <div class="text-[0.72rem] uppercase tracking-[0.04em] text-muted">{{ 'profile.replies' | transloco }}</div>
            </div>
          </mat-card-content>
        </mat-card>
        <!-- Overall status split from catalog -->
        @for (st of statusCatalog.ordered(); track st.value) {
          <mat-card class="rounded-[14px] bg-panel text-ink" appearance="outlined">
            <mat-card-content class="flex items-center gap-3 p-4">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" [style.background-color]="st.color + '22'" [style.color]="st.color">
                <mat-icon>radio_button_unchecked</mat-icon>
              </div>
              <div>
                <div class="text-[1.5rem] font-bold leading-[1.1]" [style.color]="st.color">{{ totalForStatus(p, st.value) }}</div>
                <div class="text-[0.72rem] uppercase tracking-[0.04em] text-muted">{{ st.label }}</div>
              </div>
            </mat-card-content>
          </mat-card>
        }
      </div>

      <!-- Projects breakdown -->
      @if ((p.projects ?? []).length === 0) {
        <p class="py-6 text-muted">{{ 'profile.noProjects' | transloco }}</p>
      } @else {
        <div class="flex flex-col gap-3">
          @for (proj of p.projects ?? []; track proj.projectId) {
            <mat-card class="rounded-[14px] bg-panel text-ink" appearance="outlined">
              <mat-card-content class="p-4">
                <!-- Project row header -->
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span class="font-semibold">{{ proj.name ?? proj.key }}</span>
                    @if (proj.key) { <code class="ms-2 rounded bg-slate-100 px-1.5 py-0.5 text-[0.78rem] text-muted dark:bg-slate-800">{{ proj.key }}</code> }
                  </div>
                  <div class="flex flex-wrap items-center gap-2.5">
                    <!-- Status badges -->
                    @for (st of statusCatalog.ordered(); track st.value) {
                      <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.78rem] font-semibold"
                        [style.background-color]="st.color + '22'" [style.color]="st.color">
                        {{ st.label }}: {{ projStatusValue(proj, st.value) }}
                      </span>
                    }
                    <!-- Replies always separate -->
                    <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[0.78rem] font-semibold text-muted dark:bg-slate-800">
                      <mat-icon class="!h-[14px] !w-[14px] !text-[14px] !leading-[14px]">reply</mat-icon>
                      {{ proj.replies ?? 0 }} {{ 'profile.replies' | transloco }}
                    </span>
                    <span class="text-[0.85rem] font-medium text-muted">
                      {{ 'profile.total' | transloco }}: {{ proj.comments ?? 0 }}
                    </span>
                    <!-- Expand/collapse -->
                    <button mat-icon-button (click)="toggleProject(proj.projectId!)"
                      [attr.aria-label]="expandedProjects().has(proj.projectId!) ? 'Collapse' : 'Expand'">
                      <mat-icon>{{ expandedProjects().has(proj.projectId!) ? 'expand_less' : 'expand_more' }}</mat-icon>
                    </button>
                  </div>
                </div>

                <!-- Expanded environment breakdown -->
                @if (expandedProjects().has(proj.projectId!)) {
                  <div class="mt-3 border-t border-app-border pt-3">
                    <div class="mb-1.5 text-[0.78rem] uppercase tracking-[0.04em] text-muted">{{ 'profile.environment' | transloco }}</div>
                    @if ((proj.environments ?? []).length === 0) {
                      <p class="text-[0.85rem] text-muted">—</p>
                    } @else {
                      <div class="flex flex-col gap-2">
                        @for (env of proj.environments ?? []; track env.environment) {
                          <div class="flex flex-wrap items-center gap-2.5 rounded-lg bg-app px-3 py-2">
                            <span class="w-24 shrink-0 text-[0.85rem] font-medium">{{ envLabel(env.environment) }}</span>
                            @for (st of statusCatalog.ordered(); track st.value) {
                              <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.75rem] font-semibold"
                                [style.background-color]="st.color + '22'" [style.color]="st.color">
                                {{ st.label }}: {{ envStatusValue(env, st.value) }}
                              </span>
                            }
                            <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[0.75rem] font-semibold text-muted dark:bg-slate-800">
                              <mat-icon class="!h-[12px] !w-[12px] !text-[12px] !leading-[12px]">reply</mat-icon>
                              {{ env.replies ?? 0 }}
                            </span>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    } @else if (hasError()) {
      <div class="p-12 text-center">
        <p class="text-muted">{{ 'profile.error' | transloco }}</p>
      </div>
    }
  `,
})
export class ProfileComponent {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  statusCatalog = inject(StatusCatalogService);

  /** The active resource — either the admin endpoint or the /me endpoint, never both. */
  private readonly activeResource: HttpResourceRef<UserProfileResponse | undefined>;

  /** Set of expanded project ids — signal so OnPush/zoneless change detection picks up mutations. */
  expandedProjects = signal(new Set<number>());

  profile: () => UserProfileResponse | undefined;
  loading: () => boolean;
  hasError: () => boolean;

  constructor() {
    const rawId = this.route.snapshot.paramMap.get('id');
    const numericId = rawId !== null ? parseInt(rawId, 10) : NaN;

    if (!isNaN(numericId) && this.auth.isAdmin()) {
      // Admin viewing another user's profile — use admin endpoint only.
      this.activeResource = getApiAdminUsersIdProfileResource(signal(numericId));
    } else {
      // Own profile (or non-admin) — use /me endpoint only.
      this.activeResource = getApiMeProfileResource();
    }

    this.profile = () => this.activeResource.value();
    this.loading = () => this.activeResource.isLoading();
    this.hasError = computed(() => this.activeResource.error() != null);
  }

  toggleProject(projectId: number): void {
    this.expandedProjects.update(s => {
      const n = new Set(s);
      n.has(projectId) ? n.delete(projectId) : n.add(projectId);
      return n;
    });
  }

  /** Map status value → count on a ProfileTotals-shaped object. */
  totalForStatus(p: UserProfileResponse, statusValue: number | undefined): number {
    switch (statusValue) {
      case 1: return p.totals?.open ?? 0;
      case 2: return p.totals?.readyToApply ?? 0;
      case 3: return p.totals?.applied ?? 0;
      case 4: return p.totals?.archived ?? 0;
      default: return 0;
    }
  }

  projStatusValue(proj: ProfileProject, statusValue: number | undefined): number {
    switch (statusValue) {
      case 1: return proj.open ?? 0;
      case 2: return proj.readyToApply ?? 0;
      case 3: return proj.applied ?? 0;
      case 4: return proj.archived ?? 0;
      default: return 0;
    }
  }

  envStatusValue(env: ProfileEnvironment, statusValue: number | undefined): number {
    switch (statusValue) {
      case 1: return env.open ?? 0;
      case 2: return env.readyToApply ?? 0;
      case 3: return env.applied ?? 0;
      case 4: return env.archived ?? 0;
      default: return 0;
    }
  }

  envLabel(env: number | undefined): string {
    if (env == null) return '—';
    return ENV_LABELS[env] ?? String(env);
  }
}
