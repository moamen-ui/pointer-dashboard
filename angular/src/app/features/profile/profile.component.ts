import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { BidiModule } from '@angular/cdk/bidi';
import {
  getApiMeProfileResource,
  getApiMeApiKeyResource,
  getApiAdminUsersIdProfileResource,
  MeService,
} from '@moamen-ui/pointer-angular';
import type { ProfileProject, ProfileEnvironment } from '@moamen-ui/pointer-angular';
import { StatusCatalogService } from '../../core/status/status-catalog.service';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppIconComponent } from '../../shared/ui/app-icon.component';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { AppToastService } from '../../shared/ui/app-toast.service';

const ENV_LABEL: Record<number, string> = {
  1: 'Local',
  2: 'Staging',
  3: 'Production',
};

function envLabel(env: number | undefined): string {
  if (env == null) return '—';
  return ENV_LABEL[env] ?? String(env);
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    BidiModule,
    TranslocoModule,
    AppButtonDirective,
    AppIconComponent,
  ],
  template: `
    <div class="flex flex-col gap-8">
      <!-- API key — first, because it is the one thing on this page a person comes here to copy.
           Masked by default: it is a bearer credential, and this page is as likely to be open on a
           shared screen as any other. -->
      <section class="rounded-lg border border-border bg-card p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-2">
            <app-icon name="key" [size]="16" class="text-muted-foreground"></app-icon>
            <h2 class="text-[15px] font-semibold leading-6">{{ 'profile.apiKey' | transloco }}</h2>
          </div>
          <button
            appButton
            variant="secondary"
            size="sm"
            type="button"
            (click)="regenerateKey()"
            [disabled]="keyBusy() || !apiKey()"
          >
            @if (keyBusy()) {
              <app-icon name="loader-2" [size]="16" class="animate-spin"></app-icon>
            }
            {{ 'profile.regenerateApiKey' | transloco }}
          </button>
        </div>

        <p class="mt-1 text-[13px] text-muted-foreground">{{ 'profile.apiKeyHint' | transloco }}</p>

        @if (apiKeyResource.isLoading()) {
          <p class="mt-3 text-[13px] text-muted-foreground">{{ 'profile.loading' | transloco }}</p>
        } @else if (apiKey(); as key) {
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <code
              class="flex-1 min-w-[16rem] rounded-md border border-border bg-gutter px-3 py-2 font-mono text-[13px] break-all"
              [attr.aria-label]="'profile.apiKey' | transloco"
            >{{ revealKey() ? key : maskedKey() }}</code>

            <button appButton variant="ghost" size="sm" type="button" (click)="revealKey.set(!revealKey())">
              {{ (revealKey() ? 'install.wizard.hide' : 'install.wizard.reveal') | transloco }}
            </button>
            <button appButton variant="secondary" size="sm" type="button" (click)="copyKey(key)">
              {{ 'profile.copyApiKey' | transloco }}
            </button>
          </div>

          <p class="mt-2 text-[12px] text-muted-foreground">
            {{ 'profile.apiKeyLastUsed' | transloco }}:
            <span class="font-mono">{{ lastUsedLabel() }}</span>
          </p>
        } @else {
          <p class="mt-3 text-[13px] text-muted-foreground">{{ 'profile.apiKeyUnavailable' | transloco }}</p>
        }
      </section>

      <!-- Header with title and refresh -->
      @if (profileData(); as profile) {
        <div class="flex items-center justify-between gap-3">
          <div>
            <h1 class="text-[20px] font-semibold leading-7 tracking-[-0.01em]">
              {{ profile.user?.displayName ?? ('profile.title' | transloco) }}
            </h1>
            @if (profile.user?.email) {
              <p class="mt-0.5 text-[14px] text-muted-foreground">
                {{ profile.user?.email }}
                @if (profile.user?.roleName) {
                  <span> · {{ profile.user?.roleName }}</span>
                }
              </p>
            }
          </div>
          <button
            appButton
            variant="secondary"
            size="sm"
            (click)="reload()"
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

        <!-- Diffstat line: projects · comments · replies · open · ready · completed · archived -->
        @if (profile.totals) {
          <div class="text-[14px] flex flex-wrap items-center gap-2">
            <span class="text-foreground font-mono tabular-nums">{{ profile.totals.projectsInvolved ?? 0 }}</span>
            <span class="text-muted-foreground">{{ 'profile.projects' | transloco }}</span>
            <span class="text-faint-foreground">·</span>
            <span class="text-foreground font-mono tabular-nums">{{ profile.totals.comments ?? 0 }}</span>
            <span class="text-muted-foreground">{{ 'profile.comments' | transloco }}</span>
            <span class="text-faint-foreground">·</span>
            <span class="text-foreground font-mono tabular-nums">{{ profile.totals.replies ?? 0 }}</span>
            <span class="text-muted-foreground">{{ 'profile.replies' | transloco }}</span>
            <span class="text-faint-foreground">·</span>
            <span class="text-state-open font-mono tabular-nums">{{ profile.totals.open ?? 0 }}</span>
            <span class="text-muted-foreground">{{ statusCatalog.displayLabelFor(1) }}</span>
            <span class="text-faint-foreground">·</span>
            <span class="text-state-ready font-mono tabular-nums">{{ profile.totals.readyToApply ?? 0 }}</span>
            <span class="text-muted-foreground">{{ statusCatalog.displayLabelFor(2) }}</span>
            <span class="text-faint-foreground">·</span>
            <span class="text-state-completed font-mono tabular-nums">{{ profile.totals.applied ?? 0 }}</span>
            <span class="text-muted-foreground">{{ statusCatalog.displayLabelFor(3) }}</span>
            <span class="text-faint-foreground">·</span>
            <span class="text-state-archived font-mono tabular-nums">{{ profile.totals.archived ?? 0 }}</span>
            <span class="text-muted-foreground">{{ statusCatalog.displayLabelFor(4) }}</span>
          </div>
        }

        <!-- Projects table section -->
        <div class="space-y-3">
          <h2 class="text-[16px] font-semibold leading-6">{{ 'overview.projects' | transloco }}</h2>
          <div class="rounded-md border border-border overflow-x-auto">
            @if ((profile.projects?.length ?? 0) > 0) {
              <table class="w-full border-collapse">
                <thead>
                  <tr class="h-10 bg-gutter text-[13px] font-medium text-muted-foreground border-b border-border">
                    <th class="w-10 text-end font-mono text-[12px] text-faint-foreground px-3"></th>
                    <th class="px-3 text-start">{{ 'overview.name' | transloco }}</th>
                    <th class="px-3 text-start">{{ 'overview.comments' | transloco }}</th>
                    <th class="px-3 text-start">{{ 'profile.replies' | transloco }}</th>
                    @for (st of statusCatalog.ordered(); track st.value) {
                      <th class="px-3 text-start" [class]="statusCatalog.toneHeaderClass(st.value)">
                        {{ statusCatalog.displayLabel(st) }}
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (project of profile.projects; track project.projectId; let idx = $index) {
                    <ng-container>
                      <tr class="h-11 border-t border-border-muted hover:bg-gutter/60 transition-colors cursor-pointer">
                        <td class="w-10 text-end font-mono text-[12px] text-faint-foreground px-3">{{ idx + 1 }}</td>
                        <td class="px-3">
                          <div class="flex items-center gap-2">
                            <button
                              type="button"
                              class="text-muted-foreground hover:text-foreground p-0"
                              (click)="toggleExpand(project.projectId!)"
                              [attr.aria-label]="isExpanded(project.projectId!) ? 'Collapse environments' : 'Expand environments'"
                            >
                              @if ((project.environments?.length ?? 0) > 0) {
                                <app-icon
                                  [name]="isExpanded(project.projectId!) ? 'chevron-down' : 'chevron-right'"
                                  [size]="16"
                                ></app-icon>
                              } @else {
                                <span class="w-4"></span>
                              }
                            </button>
                            <span class="text-[14px] font-medium">{{ project.name ?? project.key }}</span>
                            @if (project.key && project.name) {
                              <code class="rounded bg-gutter px-1.5 py-0.5 font-mono text-[13px]">
                                {{ project.key }}
                              </code>
                            }
                          </div>
                        </td>
                        <td class="px-3 font-mono text-[14px]">{{ project.comments ?? 0 }}</td>
                        <td class="px-3 font-mono text-[14px]">{{ project.replies ?? 0 }}</td>
                        @for (st of statusCatalog.ordered(); track st.value) {
                          <td class="px-3 font-mono text-[14px]" [class]="getProjectStatusCount(project, st.value) > 0 ? statusCatalog.toneTextClass(st.value) : 'text-faint-foreground'">
                            {{ getProjectStatusCount(project, st.value) }}
                          </td>
                        }
                      </tr>
                      <!-- Expandable environment rows -->
                      @if (isExpanded(project.projectId!) && (project.environments?.length ?? 0) > 0) {
                        @for (env of project.environments; track env.environment) {
                          <tr class="h-11 border-t border-border-muted bg-gutter/30">
                            <td class="w-10 px-3"></td>
                            <td class="ps-12 text-[14px] text-muted-foreground italic">
                              {{ envLabel(env.environment) }}
                            </td>
                            <td class="px-3 font-mono text-[14px]">{{ env.comments ?? 0 }}</td>
                            <td class="px-3 font-mono text-[14px]">{{ env.replies ?? 0 }}</td>
                            @for (st of statusCatalog.ordered(); track st.value) {
                              <td
                                class="px-3 font-mono text-[14px]"
                                [class]="getEnvStatusCount(env, st.value) > 0 ? statusCatalog.toneTextClass(st.value) : 'text-faint-foreground'"
                                [style.opacity]="getEnvStatusCount(env, st.value) === 0 ? '0.6' : '1'"
                              >
                                {{ getEnvStatusCount(env, st.value) }}
                              </td>
                            }
                          </tr>
                        }
                      }
                    </ng-container>
                  }
                </tbody>
              </table>
            } @else {
              <div class="px-3 py-12 text-center">
                <p class="text-[14px] text-muted-foreground">{{ 'profile.noProjects' | transloco }}</p>
              </div>
            }
          </div>
        </div>
      } @else if (!loading()) {
        <div class="p-12 text-center">
          <p class="text-[14px] text-muted-foreground">{{ 'common.noData' | transloco }}</p>
        </div>
      }
    </div>
  `,
})
export class ProfileComponent {

  private route = inject(ActivatedRoute);
  readonly statusCatalog = inject(StatusCatalogService);
  private auth = inject(AuthService);
  private me = inject(MeService);
  private confirm = inject(ConfirmService);
  private toast = inject(AppToastService);
  private transloco = inject(TranslocoService);

  readonly meResource = getApiMeProfileResource();

  // --- API key -------------------------------------------------------------
  //
  // GET mints on first read, so simply asking for it is also how a user gets one. The full value is
  // held only in this resource; `revealKey` decides what the template renders, so the key is not
  // sitting in the DOM while it is supposed to be hidden.
  readonly apiKeyResource = getApiMeApiKeyResource();
  readonly revealKey = signal(false);
  readonly keyBusy = signal(false);

  readonly apiKey = computed(() => {
    // httpResource throws from value() while in an error state, unlike a plain signal. A user
    // whose key cannot be read should see the "unavailable" line, not a broken page.
    try {
      return this.apiKeyResource.value()?.apiKey ?? null;
    } catch {
      return null;
    }
  });

  readonly maskedKey = computed(() => {
    const key = this.apiKey();
    if (!key) return '';
    // The server's own prefix when it sent one — it is the value meant for exactly this, and it
    // lets someone match the key against a list without revealing it.
    let prefix: string | null | undefined;
    try {
      prefix = this.apiKeyResource.value()?.prefix;
    } catch {
      prefix = undefined;
    }
    return `${prefix || key.slice(0, 12)}${'•'.repeat(24)}`;
  });

  readonly lastUsedLabel = computed(() => {
    let value: string | null | undefined;
    try {
      value = this.apiKeyResource.value()?.lastUsedAt;
    } catch {
      value = undefined;
    }
    if (!value) return this.transloco.translate('profile.apiKeyNeverUsed');
    return new Date(value).toLocaleString();
  });

  copyKey(key: string): void {
    navigator.clipboard?.writeText(key).then(
      () => this.toast.show(this.transloco.translate('profile.copied'), 'success'),
      () => this.toast.show(this.transloco.translate('demo.copyFailed'), 'danger'),
    );
  }

  regenerateKey(): void {
    // Confirmed, and destructive: the old key stops working the moment this returns, so anything
    // already using it — a teammate's checkout, a CI job — breaks until it is updated.
    this.confirm
      .confirm({
        message: this.transloco.translate('profile.regenerateApiKeyConfirm'),
        confirmLabel: this.transloco.translate('profile.regenerateApiKey'),
        confirmColor: 'danger',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.keyBusy.set(true);
        this.me.postApiMeApiKeyRegenerate().subscribe({
          next: () => {
            this.keyBusy.set(false);
            // Reveal the new one straight away: the user just asked for it, and the old value is
            // already dead, so there is nothing left to protect by hiding it.
            this.revealKey.set(true);
            this.apiKeyResource.reload();
            this.toast.show(this.transloco.translate('profile.apiKeyRegenerated'), 'success');
          },
          error: () => {
            this.keyBusy.set(false);
            this.toast.show(this.transloco.translate('profile.error'), 'danger');
          },
        });
      });
  }
  readonly adminResource = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && this.auth.isAdmin()) {
      return getApiAdminUsersIdProfileResource(signal(Number(id)));
    }
    return null;
  });

  readonly profileData = computed(() => {
    const adminRes = this.adminResource();
    if (adminRes) {
      return adminRes.value();
    }
    return this.meResource.value();
  });

  readonly loading = computed(() => {
    const adminRes = this.adminResource();
    if (adminRes) {
      return adminRes.isLoading();
    }
    return this.meResource.isLoading();
  });

  readonly expanded = signal<Set<number>>(new Set());

  reload(): void {
    const adminRes = this.adminResource();
    if (adminRes) {
      adminRes.reload();
    } else {
      this.meResource.reload();
    }
  }

  isExpanded(projectId: number): boolean {
    return this.expanded().has(projectId);
  }

  toggleExpand(projectId: number): void {
    const newSet = new Set(this.expanded());
    if (newSet.has(projectId)) {
      newSet.delete(projectId);
    } else {
      newSet.add(projectId);
    }
    this.expanded.set(newSet);
  }

  getProjectStatusCount(project: ProfileProject, statusValue: number | undefined): number {
    switch (statusValue) {
      case 1: return project.open ?? 0;
      case 2: return project.readyToApply ?? 0;
      case 3: return project.applied ?? 0;
      case 4: return project.archived ?? 0;
      default: return 0;
    }
  }


  getEnvStatusCount(env: ProfileEnvironment, statusValue: number | undefined): number {
    switch (statusValue) {
      case 1: return env.open ?? 0;
      case 2: return env.readyToApply ?? 0;
      case 3: return env.applied ?? 0;
      case 4: return env.archived ?? 0;
      default: return 0;
    }
  }

  protected readonly envLabel = envLabel;
}
