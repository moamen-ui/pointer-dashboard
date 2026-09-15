import { Component, inject, Injector, signal, computed, effect, TemplateRef, viewChild } from '@angular/core';
import type { HttpResourceRef } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { BidiModule } from '@angular/cdk/bidi';
import {
  CommentsService,
  getApiAdminProjectsResource,
  getApiProjectsKeyCommentsResource,
  getApiCommentsIdResource,
} from '@moamen-ui/pointer-angular';
import type {
  CommentListItemDto,
  CommentListItemDtoPagedData,
  CommentResponse,
  CommentStatus,
  EnvironmentTag,
  GetApiProjectsKeyCommentsParams,
} from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { AppToastService } from '../../shared/ui/app-toast.service';
import { AppDialogService } from '../../shared/ui/app-dialog.service';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppIconComponent } from '../../shared/ui/app-icon.component';
import { AppSelectComponent, type SelectOption } from '../../shared/ui/app-select.component';
import { AppSwitchComponent } from '../../shared/ui/app-switch.component';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { AppDataTableComponent, type DataTableColumn } from '../../shared/ui/app-data-table.component';
import { DataTableCellDirective } from '../../shared/data-table/data-table-cell.directive';
import type { RowActionItem } from '../../shared/row-actions-menu/row-actions-menu.component';
import type { Severity } from '../../shared/severity';

const LAST_PROJECT_KEY = 'pf.comments.lastProject';

// The generated `CommentStatus`/`EnvironmentTag` are literal-number union types, not TS enums —
// these give the raw values a name without the ugly generated `NUMBER_1` property access.
const STATUS_OPEN = 1 as CommentStatus;
const STATUS_READY = 2 as CommentStatus;
const STATUS_APPLIED = 3 as CommentStatus;
const STATUS_ARCHIVED = 4 as CommentStatus;

const ENV_UNKNOWN = 0 as EnvironmentTag;
const ENV_LOCAL = 1 as EnvironmentTag;
const ENV_STAGING = 2 as EnvironmentTag;
const ENV_PRODUCTION = 3 as EnvironmentTag;

const STATUS_LABEL_KEYS: Record<number, string> = {
  [STATUS_OPEN]: 'comments.statusOpen',
  [STATUS_READY]: 'comments.statusReady',
  [STATUS_APPLIED]: 'comments.statusApplied',
  [STATUS_ARCHIVED]: 'comments.statusArchived',
};

const STATUS_SEVERITY: Record<number, Severity> = {
  [STATUS_OPEN]: 'open',
  [STATUS_READY]: 'warning',
  [STATUS_APPLIED]: 'success',
  [STATUS_ARCHIVED]: 'archived',
};

const ENV_LABEL_KEYS: Record<number, string> = {
  [ENV_UNKNOWN]: 'comments.envUnknown',
  [ENV_LOCAL]: 'comments.envLocal',
  [ENV_STAGING]: 'comments.envStaging',
  [ENV_PRODUCTION]: 'comments.envProduction',
};

/** Parses a query-param string into a finite number, or `undefined` (blank/invalid). */
function numOrUndefined(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Comments screen (`/comments`): a filterable, paged review queue for one project's feedback,
 * with a detail dialog for the full thread — status, verify, replies, visibility and delete.
 * Query params (`project`, `comment`, `status`, `env`, `flagged`, `live`, `q`) drive the state so
 * links are shareable, and the notifications bell deep-links here with `project` + `comment`.
 */
@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [
    BidiModule,
    FormsModule,
    TranslocoModule,
    AppButtonDirective,
    AppIconComponent,
    AppSelectComponent,
    AppSwitchComponent,
    BadgeComponent,
    EmptyStateComponent,
    AppDataTableComponent,
    DataTableCellDirective,
  ],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:flex-wrap">
        <div>
          <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">{{ 'comments.title' | transloco }}</h1>
          <p class="mt-1 text-[14px] text-muted-foreground">{{ 'comments.subtitle' | transloco }}</p>
        </div>
        <app-select
          class="w-full sm:w-64"
          [options]="projectOptions()"
          [value]="selectedProjectKey()"
          (valueChange)="setProject($event)"
        />
      </div>

      @if (!selectedProjectKey()) {
        <app-empty-state [message]="'comments.selectProject' | transloco" />
      } @else {
        <!-- Filters: a vertical stack below sm — full-width selects, a full-width equal-segment
             control and a full-width search box — flowing into the original wrapped row at sm+. -->
        <div class="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <app-select
            class="w-full sm:w-44"
            [options]="statusFilterOptions()"
            [value]="statusFilter()"
            (valueChange)="setStatusFilter($event)"
          />
          <app-select
            class="w-full sm:w-40"
            [options]="envFilterOptions()"
            [value]="envFilter()"
            (valueChange)="setEnvFilter($event)"
          />
          <button
            type="button"
            appButton
            [variant]="flaggedFilter() ? 'primary' : 'secondary'"
            size="sm"
            class="w-full sm:w-auto"
            (click)="toggleFlagged()"
          >
            <app-icon name="circle-alert" [size]="14"></app-icon>
            {{ 'comments.flagged' | transloco }}
          </button>

          <div class="flex w-full rounded-md border border-border bg-gutter p-0.5 sm:inline-flex sm:w-auto">
            <button
              type="button"
              class="h-11 flex-1 px-3 rounded-[4px] text-[13px] font-medium transition-colors sm:h-7 sm:flex-none"
              [class.bg-background]="liveFilter() === undefined"
              [class.border]="liveFilter() === undefined"
              [class.border-border]="liveFilter() === undefined"
              [class.text-foreground]="liveFilter() === undefined"
              [class.text-muted-foreground]="liveFilter() !== undefined"
              (click)="setLiveFilter(undefined)"
            >
              {{ 'comments.liveAll' | transloco }}
            </button>
            <button
              type="button"
              class="h-11 flex-1 px-3 rounded-[4px] text-[13px] font-medium transition-colors sm:h-7 sm:flex-none"
              [class.bg-background]="liveFilter() === false"
              [class.border]="liveFilter() === false"
              [class.border-border]="liveFilter() === false"
              [class.text-foreground]="liveFilter() === false"
              [class.text-muted-foreground]="liveFilter() !== false"
              (click)="setLiveFilter(false)"
            >
              {{ 'comments.liveNotYet' | transloco }}
            </button>
            <button
              type="button"
              class="h-11 flex-1 px-3 rounded-[4px] text-[13px] font-medium transition-colors sm:h-7 sm:flex-none"
              [class.bg-background]="liveFilter() === true"
              [class.border]="liveFilter() === true"
              [class.border-border]="liveFilter() === true"
              [class.text-foreground]="liveFilter() === true"
              [class.text-muted-foreground]="liveFilter() !== true"
              (click)="setLiveFilter(true)"
            >
              {{ 'comments.liveYes' | transloco }}
            </button>
          </div>

          <div class="flex items-center gap-2 h-11 w-full sm:h-8 sm:flex-1 sm:min-w-[200px] sm:max-w-xs sm:w-auto rounded-md border border-border bg-background px-3">
            <app-icon name="search" [size]="14" class="text-muted-foreground shrink-0"></app-icon>
            <input
              type="text"
              [ngModel]="rawSearch()"
              (ngModelChange)="rawSearch.set($event)"
              [ngModelOptions]="{ standalone: true }"
              [placeholder]="'comments.searchPlaceholder' | transloco"
              class="w-full h-full min-w-0 border-0 bg-transparent p-0 text-[14px] outline-none placeholder:text-faint-foreground"
            />
          </div>
        </div>

        @if (hiddenPrivateCount() > 0) {
          <p class="text-[12px] text-muted-foreground flex items-center gap-1">
            <app-icon name="lock" [size]="12"></app-icon>
            {{ 'comments.hiddenPrivate' | transloco: { count: hiddenPrivateCount() } }}
          </p>
        }

        <app-data-table
          [rows]="items()"
          [columns]="columns()"
          [actions]="actionsFor"
          [actionsAriaLabel]="'common.actions' | transloco"
          [clickableRows]="true"
          (rowClick)="openDetail($event.id!)"
          [paginated]="false"
          [emptyMessage]="emptyMessage()"
          [emptyHint]="emptyHint()"
        >
          @if (filtersActive()) {
            <button emptyAction appButton variant="secondary" size="sm" (click)="clearFilters()">
              {{ 'comments.clearFilters' | transloco }}
            </button>
          }

          <ng-template appDataTableCell="body" let-c>
            <div class="flex flex-col gap-1 max-w-[360px]">
              <div class="flex items-center gap-1.5 flex-wrap">
                @if (c.isPrivate) {
                  <app-icon name="lock" [size]="12" class="text-muted-foreground shrink-0"></app-icon>
                }
                @if (c.hasPayloadFlag) {
                  <app-badge severity="danger">{{ 'comments.flagged' | transloco }}</app-badge>
                }
                @if (c.isBugReport) {
                  <app-badge severity="neutral">{{ 'comments.bug' | transloco }}</app-badge>
                }
              </div>
              <p class="line-clamp-2 text-[14px] text-foreground">{{ c.body }}</p>
            </div>
          </ng-template>

          <ng-template appDataTableCell="status" let-c>
            <app-badge [severity]="statusSeverity(c.status)">{{ statusLabel(c.status) | transloco }}</app-badge>
          </ng-template>

          <ng-template appDataTableCell="environment" let-c>
            <app-badge severity="neutral">{{ envLabel(c.environment) | transloco }}</app-badge>
          </ng-template>

          <ng-template appDataTableCell="route" let-c>
            @if (c.element?.route; as route) {
              <code
                class="block max-w-[160px] truncate font-mono text-[13px] text-muted-foreground"
                [attr.title]="route"
              >{{ route }}</code>
            } @else {
              <span class="text-faint-foreground">—</span>
            }
          </ng-template>

          <ng-template appDataTableCell="author" let-c>
            <span class="text-[14px] text-foreground">{{ c.authorName || '—' }}</span>
          </ng-template>

          <ng-template appDataTableCell="created" let-c>
            <span class="text-[13px] text-muted-foreground" [attr.title]="formatDate(c.createdAt)">
              {{ relativeTime(c.createdAt) }}
            </span>
          </ng-template>

          <ng-template appDataTableCell="deploy" let-c>
            @if (!c.appliedAt) {
              <span class="text-faint-foreground">—</span>
            } @else if (c.deployedAt) {
              <app-badge severity="success" [attr.title]="deployTooltip(c)">{{ 'comments.live' | transloco }}</app-badge>
            } @else {
              <app-badge severity="neutral">{{ 'comments.applied' | transloco }}</app-badge>
            }
          </ng-template>
        </app-data-table>

        @if ((pagination()?.totalPages ?? 0) > 1) {
          <div class="mt-2 h-11 rounded-md border border-border bg-background px-3 flex items-center justify-between text-[13px] text-muted-foreground">
            <span>
              {{ 'table.pageOf' | transloco: { page: pagination()?.pageNumber, pages: pagination()?.totalPages } }}
            </span>
            <div class="flex items-center gap-2">
              <button
                appButton
                variant="secondary"
                size="sm"
                [disabled]="(pagination()?.pageNumber ?? 1) <= 1"
                (click)="previousPage()"
                [attr.aria-label]="'table.previousPage' | transloco"
              >
                <app-icon name="chevron-left" [size]="16" class="rtl:-scale-x-100"></app-icon>
              </button>
              <button
                appButton
                variant="secondary"
                size="sm"
                [disabled]="(pagination()?.pageNumber ?? 1) >= (pagination()?.totalPages ?? 1)"
                (click)="nextPage()"
                [attr.aria-label]="'table.nextPage' | transloco"
              >
                <app-icon name="chevron-right" [size]="16" class="rtl:-scale-x-100"></app-icon>
              </button>
            </div>
          </div>
        }
      }
    </div>

    <!-- Detail dialog -->
    <ng-template #detailDialog>
      <div class="w-[min(720px,calc(100vw-32px))] max-h-[90vh] rounded-lg border border-border bg-background shadow-dialog flex flex-col">
        <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-border-muted">
          <div class="min-w-0">
            <h2 class="text-[16px] font-semibold leading-6">{{ 'comments.detailTitle' | transloco }}</h2>
            @if (detail(); as d) {
              <p class="text-[12px] text-muted-foreground mt-1">
                {{ d.authorName || '—' }} · {{ formatDate(d.createdAt) }}
                @if (d.editedAt) {
                  · {{ 'comments.edited' | transloco }}
                }
              </p>
            }
          </div>
          <button appButton variant="ghost" size="icon" (click)="dialogRef?.close()" [attr.aria-label]="'common.close' | transloco">
            <app-icon name="x" [size]="16"></app-icon>
          </button>
        </div>

        <div class="px-5 py-4 overflow-y-auto flex-1 space-y-5">
          @if (detailLoading() && !detail()) {
            <p class="text-[14px] text-muted-foreground">{{ 'common.loading' | transloco }}</p>
          } @else if (detail(); as d) {
            <div class="flex flex-wrap items-center gap-2">
              <app-badge [severity]="statusSeverity(d.status)">{{ statusLabel(d.status) | transloco }}</app-badge>
              <app-badge severity="neutral">{{ envLabel(d.environment) | transloco }}</app-badge>
              @if (d.isPrivate) {
                <app-badge severity="neutral">
                  <app-icon name="lock" [size]="12"></app-icon>
                  {{ 'comments.privacyTitle' | transloco }}
                </app-badge>
              }
              @if (d.isBugReport) {
                <app-badge severity="neutral">{{ 'comments.bug' | transloco }}</app-badge>
              }
              @if (d.hasPayloadFlag) {
                <app-badge severity="danger">{{ 'comments.flagged' | transloco }}</app-badge>
              }
            </div>

            @if (d.hasPayloadFlag && (d.payloadFlags?.length ?? 0) > 0) {
              <div class="rounded-md border border-state-danger/30 bg-state-danger-tint p-3">
                <p class="text-[13px] font-medium text-state-danger mb-1">{{ 'comments.flaggedReasons' | transloco }}</p>
                <ul class="list-disc ps-4 text-[13px] text-state-danger space-y-0.5">
                  @for (flag of d.payloadFlags; track flag) {
                    <li>{{ flag }}</li>
                  }
                </ul>
              </div>
            }

            <p class="text-[14px] text-foreground whitespace-pre-wrap">{{ d.body }}</p>

            @if ((d.pickedActionTexts?.length ?? 0) > 0) {
              <div class="flex flex-wrap gap-1.5">
                @for (action of d.pickedActionTexts; track action) {
                  <span class="inline-flex items-center rounded-full border border-border bg-gutter px-2 h-6 text-[12px] text-foreground">
                    {{ action }}
                  </span>
                }
              </div>
            }

            @if (d.element; as el) {
              <div class="border-t border-border-muted pt-4">
                <h3 class="text-[14px] font-medium text-foreground mb-2">{{ 'comments.element' | transloco }}</h3>
                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px] items-start">
                  @if (el.route) {
                    <span class="text-muted-foreground">{{ 'comments.colRoute' | transloco }}</span>
                    <code class="font-mono text-foreground break-all">{{ el.route }}</code>
                  }
                  @if (el.pageTitle) {
                    <span class="text-muted-foreground">{{ 'comments.pageTitle' | transloco }}</span>
                    <span class="text-foreground break-all">{{ el.pageTitle }}</span>
                  }
                  @if (el.pageUrl) {
                    <span class="text-muted-foreground">{{ 'comments.pageUrl' | transloco }}</span>
                    <a [href]="el.pageUrl" target="_blank" rel="noopener" class="text-brand hover:underline break-all">{{ el.pageUrl }}</a>
                  }
                  @if (el.selector) {
                    <span class="text-muted-foreground">{{ 'comments.selector' | transloco }}</span>
                    <code class="font-mono text-foreground break-all">{{ el.selector }}</code>
                  }
                  @if (el.sourcePath) {
                    <span class="text-muted-foreground">{{ 'comments.sourcePath' | transloco }}</span>
                    <code class="font-mono text-foreground break-all">{{ el.sourcePath }}</code>
                  }
                  @if (el.deviceType || el.viewportWidth) {
                    <span class="text-muted-foreground">{{ 'comments.device' | transloco }}</span>
                    <span class="text-foreground">
                      {{ el.deviceType }}
                      @if (el.viewportWidth && el.viewportHeight) {
                        · {{ el.viewportWidth }}×{{ el.viewportHeight }}
                      }
                    </span>
                  }
                </div>
                @if (el.screenshotUrl) {
                  <a [href]="el.screenshotUrl" target="_blank" rel="noopener" class="block mt-3">
                    <img [src]="el.screenshotUrl" alt="" class="max-h-40 rounded-md border border-border" />
                  </a>
                }
              </div>
            }

            @if (d.appliedAt) {
              <div class="border-t border-border-muted pt-4">
                <h3 class="text-[14px] font-medium text-foreground mb-2">{{ 'comments.appliedSection' | transloco }}</h3>
                <div class="text-[13px] text-muted-foreground space-y-1.5">
                  <p>{{ 'comments.appliedBy' | transloco }}: <span class="text-foreground">{{ d.appliedByLabel || '—' }}</span> · {{ formatDate(d.appliedAt) }}</p>
                  @if (d.commitUrl) {
                    <p>
                      <a [href]="d.commitUrl" target="_blank" rel="noopener" class="text-brand hover:underline font-mono break-all">
                        {{ (d.commitSha || '').slice(0, 7) || d.commitUrl }}
                      </a>
                    </p>
                  }
                  <p class="flex items-center gap-1.5">
                    @if (d.deployedAt) {
                      <app-badge severity="success">{{ 'comments.live' | transloco }}</app-badge>
                      <span>{{ 'comments.liveSince' | transloco: { date: formatDate(d.deployedAt) } }}</span>
                    } @else {
                      <app-badge severity="neutral">{{ 'comments.applied' | transloco }}</app-badge>
                      <span>{{ 'comments.notYetLive' | transloco }}</span>
                    }
                  </p>
                </div>

                @if (canVerify(d)) {
                  @if (d.verifiedAt) {
                    <p class="mt-3 text-[13px] text-muted-foreground">
                      {{ 'comments.verifiedOn' | transloco: { date: formatDate(d.verifiedAt) } }}
                    </p>
                  } @else {
                    <div class="mt-3 flex items-center gap-2">
                      <button appButton variant="secondary" size="sm" [disabled]="actionBusy()" (click)="verify(true)">
                        <app-icon name="thumbs-up" [size]="16"></app-icon>
                        {{ 'comments.verifyWorks' | transloco }}
                      </button>
                      <button
                        appButton
                        variant="danger-outline"
                        size="sm"
                        [disabled]="actionBusy()"
                        (click)="verifyNoteOpen.set(!verifyNoteOpen())"
                      >
                        <app-icon name="thumbs-down" [size]="16"></app-icon>
                        {{ 'comments.verifyNotFixed' | transloco }}
                      </button>
                    </div>
                    @if (verifyNoteOpen()) {
                      <div class="mt-2 space-y-2">
                        <textarea
                          [ngModel]="verifyNote()"
                          (ngModelChange)="verifyNote.set($event)"
                          [ngModelOptions]="{ standalone: true }"
                          rows="2"
                          [placeholder]="'comments.verifyNotePlaceholder' | transloco"
                          class="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] resize-none"
                        ></textarea>
                        <div class="flex justify-end gap-2">
                          <button appButton variant="secondary" size="sm" (click)="verifyNoteOpen.set(false)">
                            {{ 'common.cancel' | transloco }}
                          </button>
                          <button
                            appButton
                            variant="destructive"
                            size="sm"
                            [disabled]="actionBusy()"
                            (click)="verify(false, verifyNote())"
                          >
                            {{ 'common.confirm' | transloco }}
                          </button>
                        </div>
                      </div>
                    }
                  }
                }
              </div>
            }

            <div class="border-t border-border-muted pt-4">
              <h3 class="text-[14px] font-medium text-foreground mb-2">
                {{ 'comments.replies' | transloco }} ({{ d.replies?.length ?? 0 }})
              </h3>
              <div class="space-y-3">
                @for (r of d.replies; track r.id) {
                  <div class="rounded-md border border-border-muted p-2.5">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-[13px] font-medium text-foreground">{{ r.authorName || '—' }}</span>
                      <span class="text-[12px] text-muted-foreground shrink-0">{{ formatDate(r.createdAt) }}</span>
                    </div>
                    <p class="text-[13px] text-foreground mt-1 whitespace-pre-wrap">{{ r.body }}</p>
                  </div>
                } @empty {
                  <p class="text-[13px] text-muted-foreground">{{ 'comments.noReplies' | transloco }}</p>
                }
              </div>
              <div class="mt-3 space-y-2">
                <textarea
                  [ngModel]="replyBody()"
                  (ngModelChange)="replyBody.set($event)"
                  [ngModelOptions]="{ standalone: true }"
                  rows="2"
                  [placeholder]="'comments.replyPlaceholder' | transloco"
                  class="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] resize-none"
                ></textarea>
                <div class="flex justify-end">
                  <button appButton variant="secondary" size="sm" [disabled]="!replyBody().trim() || actionBusy()" (click)="addReply()">
                    <app-icon name="send" [size]="16"></app-icon>
                    {{ 'comments.addReply' | transloco }}
                  </button>
                </div>
              </div>
            </div>

            @if (isOwnComment(d)) {
              <div class="border-t border-border-muted pt-4 flex items-center justify-between gap-3">
                <div>
                  <div class="text-[14px] font-medium text-foreground">{{ 'comments.privacyTitle' | transloco }}</div>
                  <div class="text-[12px] text-muted-foreground">{{ 'comments.privacyHint' | transloco }}</div>
                </div>
                <app-switch [checked]="!!d.isPrivate" (checkedChange)="toggleVisibility($event)" />
              </div>
            }
          } @else {
            <p class="text-[14px] text-state-danger">{{ 'comments.detailLoadError' | transloco }}</p>
          }
        </div>

        @if (detail(); as d) {
          @if (canManage(d)) {
            <div class="px-5 pb-5 pt-3 border-t border-border flex items-center justify-between gap-2">
              <app-select
                class="w-44"
                [options]="statusOptions()"
                [value]="d.status"
                (valueChange)="changeStatus($event)"
              />
              <button appButton variant="danger-outline" size="sm" [disabled]="actionBusy()" (click)="confirmDelete(d.id!)">
                <app-icon name="trash-2" [size]="16"></app-icon>
                {{ 'common.delete' | transloco }}
              </button>
            </div>
          }
        }
      </div>
    </ng-template>
  `,
})
export class CommentsComponent {
  private readonly commentsService = inject(CommentsService);
  private readonly transloco = inject(TranslocoService);
  private readonly toast = inject(AppToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly appDialog = inject(AppDialogService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);

  private readonly initialParams = this.route.snapshot.queryParamMap;
  private readonly qp = toSignal(this.route.queryParamMap, { initialValue: this.initialParams });

  // --- Project selection ---------------------------------------------------
  readonly selectedProjectKey = signal<string>(
    this.initialParams.get('project') || localStorage.getItem(LAST_PROJECT_KEY) || '',
  );

  readonly projectsResource = getApiAdminProjectsResource();
  readonly projectOptions = computed<SelectOption<string>[]>(() =>
    (this.projectsResource.value() ?? [])
      .filter((p) => !!p.key)
      .map((p) => ({ label: `${p.name} (${p.key})`, value: p.key! })),
  );

  // --- Filters (initial value read once from the URL; each change writes back) ---
  readonly statusFilter = signal<CommentStatus | undefined>(
    numOrUndefined(this.initialParams.get('status')) as CommentStatus | undefined,
  );
  readonly envFilter = signal<EnvironmentTag | undefined>(
    numOrUndefined(this.initialParams.get('env')) as EnvironmentTag | undefined,
  );
  readonly flaggedFilter = signal<boolean>(this.initialParams.get('flagged') === '1');
  readonly liveFilter = signal<boolean | undefined>(
    this.initialParams.get('live') === '1' ? true : this.initialParams.get('live') === '0' ? false : undefined,
  );
  readonly rawSearch = signal<string>(this.initialParams.get('q') || '');
  readonly debouncedSearch = signal<string>(this.initialParams.get('q') || '');
  readonly pageNumber = signal<number>(1);

  readonly filtersActive = computed(
    () =>
      !!this.statusFilter() ||
      !!this.envFilter() ||
      this.flaggedFilter() ||
      this.liveFilter() !== undefined ||
      !!this.debouncedSearch(),
  );

  readonly commentsParams = computed<GetApiProjectsKeyCommentsParams>(() => ({
    Status: this.statusFilter(),
    Environment: this.envFilter(),
    Flagged: this.flaggedFilter() || undefined,
    Live: this.liveFilter(),
    Search: this.debouncedSearch() || undefined,
    PageNumber: this.pageNumber(),
    PageSize: 25,
  }));

  // --- List resource: created lazily once a project key exists, so the resource's key
  // signal is never handed an empty string (that would fire a request against the wrong URL). ---
  private readonly listResource = signal<HttpResourceRef<CommentListItemDtoPagedData | undefined> | null>(null);

  readonly items = computed<CommentListItemDto[]>(() => this.listResource()?.value()?.items ?? []);
  readonly pagination = computed(() => this.listResource()?.value()?.pagination);
  readonly hiddenPrivateCount = computed(() => this.listResource()?.value()?.hiddenPrivateCount ?? 0);

  readonly emptyMessage = computed(() =>
    this.filtersActive() ? this.transloco.translate('comments.emptyFiltered') : this.transloco.translate('comments.empty'),
  );
  readonly emptyHint = computed(() => (this.filtersActive() ? '' : this.transloco.translate('comments.emptyHint')));

  // --- Detail dialog ---------------------------------------------------------
  readonly detailDialog = viewChild.required<TemplateRef<unknown>>('detailDialog');
  dialogRef?: any;
  private dialogOpen = false;

  private readonly detailIdSignal = signal<number>(0);
  private readonly detailResource = signal<HttpResourceRef<CommentResponse | undefined> | null>(null);
  readonly detail = computed(() => this.detailResource()?.value());
  readonly detailLoading = computed(() => this.detailResource()?.isLoading() ?? false);

  readonly actionBusy = signal(false);
  readonly replyBody = signal('');
  readonly verifyNoteOpen = signal(false);
  readonly verifyNote = signal('');

  constructor() {
    // Create the list resource once a project is selected (and keep it reactive thereafter).
    effect(() => {
      if (this.selectedProjectKey() && !this.listResource()) {
        this.listResource.set(
          getApiProjectsKeyCommentsResource(
            computed(() => this.selectedProjectKey()),
            computed(() => this.commentsParams()),
            { injector: this.injector },
          ),
        );
      }
    });

    // No project in the URL or localStorage yet: default to the first one once the list loads.
    // Deliberately not `setProject()` — that also clears a `comment` query param, which would
    // wipe out a deep link that arrived with `comment` but no `project`.
    effect(() => {
      if (this.selectedProjectKey()) return;
      const first = this.projectOptions()[0];
      if (!first) return;
      this.selectedProjectKey.set(first.value);
      localStorage.setItem(LAST_PROJECT_KEY, first.value);
      this.updateQueryParams({ project: first.value });
    });

    // Reset to page 1 whenever the project or a filter changes.
    effect(() => {
      this.selectedProjectKey();
      this.statusFilter();
      this.envFilter();
      this.flaggedFilter();
      this.liveFilter();
      this.debouncedSearch();
      this.pageNumber.set(1);
    });

    // Debounce the search box 300ms before it drives the API call / URL.
    effect((onCleanup) => {
      const value = this.rawSearch();
      const handle = setTimeout(() => {
        this.debouncedSearch.set(value);
        this.updateQueryParams({ q: value || null });
      }, 300);
      onCleanup(() => clearTimeout(handle));
    });

    // React to navigations that change `project`/`comment` while this page stays mounted —
    // the notifications bell, a pasted deep link, or the very first load.
    effect(() => {
      const params = this.qp();
      const project = params.get('project');
      if (project && project !== this.selectedProjectKey()) {
        this.selectedProjectKey.set(project);
        localStorage.setItem(LAST_PROJECT_KEY, project);
      }
      const commentId = numOrUndefined(params.get('comment'));
      if (commentId && commentId !== this.detailIdSignal()) {
        this.openDetail(commentId);
      }
    });
  }

  private updateQueryParams(params: Record<string, string | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  setProject(key: string): void {
    if (!key) return;
    this.selectedProjectKey.set(key);
    localStorage.setItem(LAST_PROJECT_KEY, key);
    this.closeDetailIfOpen();
    this.updateQueryParams({ project: key, comment: null });
  }

  setStatusFilter(value: CommentStatus | undefined): void {
    this.statusFilter.set(value);
    this.updateQueryParams({ status: value ? String(value) : null });
  }

  setEnvFilter(value: EnvironmentTag | undefined): void {
    this.envFilter.set(value);
    this.updateQueryParams({ env: value !== undefined ? String(value) : null });
  }

  toggleFlagged(): void {
    const next = !this.flaggedFilter();
    this.flaggedFilter.set(next);
    this.updateQueryParams({ flagged: next ? '1' : null });
  }

  setLiveFilter(value: boolean | undefined): void {
    this.liveFilter.set(value);
    this.updateQueryParams({ live: value === true ? '1' : value === false ? '0' : null });
  }

  clearFilters(): void {
    this.statusFilter.set(undefined);
    this.envFilter.set(undefined);
    this.flaggedFilter.set(false);
    this.liveFilter.set(undefined);
    this.rawSearch.set('');
    this.debouncedSearch.set('');
    this.updateQueryParams({ status: null, env: null, flagged: null, live: null, q: null });
  }

  previousPage(): void {
    if ((this.pagination()?.pageNumber ?? 1) > 1) this.pageNumber.update((p) => p - 1);
  }

  nextPage(): void {
    const total = this.pagination()?.totalPages ?? 1;
    if ((this.pagination()?.pageNumber ?? 1) < total) this.pageNumber.update((p) => p + 1);
  }

  columns(): DataTableColumn<CommentListItemDto>[] {
    return [
      { key: 'body', header: this.transloco.translate('comments.colBody'), mobile: 'primary' },
      { key: 'status', header: this.transloco.translate('comments.colStatus') },
      { key: 'environment', header: this.transloco.translate('comments.colEnvironment') },
      { key: 'route', header: this.transloco.translate('comments.colRoute') },
      { key: 'author', header: this.transloco.translate('comments.colAuthor') },
      { key: 'created', header: this.transloco.translate('comments.colCreated') },
      { key: 'deploy', header: this.transloco.translate('comments.colDeploy') },
    ];
  }

  statusFilterOptions(): SelectOption<CommentStatus | undefined>[] {
    return [
      { label: this.transloco.translate('comments.allStatuses'), value: undefined },
      { label: this.transloco.translate('comments.statusOpen'), value: STATUS_OPEN },
      { label: this.transloco.translate('comments.statusReady'), value: STATUS_READY },
      { label: this.transloco.translate('comments.statusApplied'), value: STATUS_APPLIED },
      { label: this.transloco.translate('comments.statusArchived'), value: STATUS_ARCHIVED },
    ];
  }

  envFilterOptions(): SelectOption<EnvironmentTag | undefined>[] {
    return [
      { label: this.transloco.translate('comments.allEnvironments'), value: undefined },
      { label: this.transloco.translate('comments.envUnknown'), value: ENV_UNKNOWN },
      { label: this.transloco.translate('comments.envLocal'), value: ENV_LOCAL },
      { label: this.transloco.translate('comments.envStaging'), value: ENV_STAGING },
      { label: this.transloco.translate('comments.envProduction'), value: ENV_PRODUCTION },
    ];
  }

  statusOptions(): SelectOption<CommentStatus>[] {
    return [
      { label: this.transloco.translate('comments.statusOpen'), value: STATUS_OPEN },
      { label: this.transloco.translate('comments.statusReady'), value: STATUS_READY },
      { label: this.transloco.translate('comments.statusApplied'), value: STATUS_APPLIED },
      { label: this.transloco.translate('comments.statusArchived'), value: STATUS_ARCHIVED },
    ];
  }

  statusLabel(status?: number): string {
    return STATUS_LABEL_KEYS[status ?? 0] ?? 'comments.statusOpen';
  }

  statusSeverity(status?: number): Severity {
    return STATUS_SEVERITY[status ?? 0] ?? 'open';
  }

  envLabel(env?: number): string {
    return ENV_LABEL_KEYS[env ?? 0] ?? 'comments.envUnknown';
  }

  deployTooltip(c: CommentListItemDto): string {
    return c.deployedSha
      ? this.transloco.translate('comments.deployedShaTooltip', { sha: c.deployedSha.slice(0, 7) })
      : '';
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  relativeTime(iso?: string | null): string {
    if (!iso) return '—';
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return this.transloco.translate('time.justNow');
    if (minutes < 60) return this.transloco.translate('time.minutesAgo', { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return this.transloco.translate('time.hoursAgo', { n: hours });
    const days = Math.floor(hours / 24);
    return this.transloco.translate('time.daysAgo', { n: days });
  }

  canManage(c: { authorId?: string } | null | undefined): boolean {
    if (!c) return false;
    return this.auth.isAdmin() || c.authorId === this.auth.user()?.id;
  }

  isOwnComment(c: { authorId?: string } | null | undefined): boolean {
    if (!c) return false;
    return c.authorId === this.auth.user()?.id;
  }

  canVerify(d: CommentResponse): boolean {
    return !!d.appliedAt && this.canManage(d);
  }

  readonly actionsFor = (c: CommentListItemDto): RowActionItem[] => {
    const items: RowActionItem[] = [
      { label: this.transloco.translate('comments.viewDetails'), icon: 'eye', onClick: () => this.openDetail(c.id!) },
    ];
    if (this.canManage(c)) {
      items.push({
        label: this.transloco.translate('common.delete'),
        icon: 'trash-2',
        severity: 'danger',
        onClick: () => this.confirmDelete(c.id!),
      });
    }
    return items;
  };

  openDetail(id: number): void {
    this.detailIdSignal.set(id);
    if (!this.detailResource()) {
      this.detailResource.set(getApiCommentsIdResource(this.detailIdSignal, { injector: this.injector }));
    }
    this.replyBody.set('');
    this.verifyNoteOpen.set(false);
    this.verifyNote.set('');
    this.updateQueryParams({ comment: String(id) });

    if (this.dialogOpen) return;
    this.dialogOpen = true;
    // Deferred a tick: this can be reached from a constructor-time effect (a `comment` query
    // param already in the URL on first load) before this component's view — and so the
    // `#detailDialog` template's viewChild — has finished initializing.
    setTimeout(() => this.launchDialog(), 0);
  }

  private launchDialog(): void {
    this.dialogRef = this.appDialog.openRef(this.detailDialog(), { width: 'w-[min(720px,calc(100vw-32px))]' });
    this.dialogRef.closed.subscribe(() => {
      this.dialogOpen = false;
      this.updateQueryParams({ comment: null });
    });
  }

  private closeDetailIfOpen(): void {
    if (this.dialogOpen) this.dialogRef?.close();
  }

  private reloadAfterMutation(): void {
    this.detailResource()?.reload();
    this.listResource()?.reload();
  }

  changeStatus(status: CommentStatus): void {
    const id = this.detailIdSignal();
    if (!id) return;
    this.actionBusy.set(true);
    this.commentsService.patchApiCommentsId(id, { status }).subscribe({
      next: () => {
        this.actionBusy.set(false);
        this.reloadAfterMutation();
        this.toast.show(this.transloco.translate('comments.statusUpdated'), 'success');
      },
      error: (e: unknown) => {
        this.actionBusy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  verify(ok: boolean, note?: string): void {
    const id = this.detailIdSignal();
    if (!id) return;
    this.actionBusy.set(true);
    this.commentsService.postApiCommentsIdVerify(id, { ok, note: note?.trim() || undefined }).subscribe({
      next: () => {
        this.actionBusy.set(false);
        this.verifyNoteOpen.set(false);
        this.verifyNote.set('');
        this.reloadAfterMutation();
        this.toast.show(
          this.transloco.translate(ok ? 'comments.verifiedOk' : 'comments.verifiedNotFixed'),
          'success',
        );
      },
      error: (e: unknown) => {
        this.actionBusy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  addReply(): void {
    const id = this.detailIdSignal();
    const body = this.replyBody().trim();
    if (!id || !body) return;
    this.actionBusy.set(true);
    this.commentsService.postApiCommentsIdReplies(id, { body }).subscribe({
      next: () => {
        this.actionBusy.set(false);
        this.replyBody.set('');
        this.reloadAfterMutation();
        this.toast.show(this.transloco.translate('comments.replyAdded'), 'success');
      },
      error: (e: unknown) => {
        this.actionBusy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  toggleVisibility(isPrivate: boolean): void {
    const id = this.detailIdSignal();
    if (!id) return;
    this.commentsService.patchApiCommentsIdVisibility(id, { isPrivate }).subscribe({
      next: () => {
        this.reloadAfterMutation();
        this.toast.show(this.transloco.translate('comments.visibilityUpdated'), 'success');
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }

  confirmDelete(id: number): void {
    this.confirm
      .confirm({
        message: this.transloco.translate('comments.deleteConfirm'),
        confirmLabel: this.transloco.translate('common.delete'),
        confirmColor: 'danger',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.commentsService.deleteApiCommentsId(id).subscribe({
          next: () => {
            this.toast.show(this.transloco.translate('comments.deleted'), 'success');
            this.closeDetailIfOpen();
            this.listResource()?.reload();
          },
          error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
        });
      });
  }
}
