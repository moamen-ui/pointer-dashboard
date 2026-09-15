import {
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import { TranslocoModule } from '@jsverse/transloco';
import { BidiModule } from '@angular/cdk/bidi';
import {
  getApiMeNotificationsUnreadCountResource,
  getApiMeNotificationsResource,
  MeService,
  type GetApiMeNotificationsParams,
  type NotificationDto,
} from '@moamen-ui/pointer-angular';
import { AppIconComponent } from './ui/app-icon.component';
import { AppButtonDirective } from './ui/app-button.directive';
import { AppToastService } from './ui/app-toast.service';

@Component({
  selector: 'app-notifications-bell',
  standalone: true,
  imports: [
    OverlayModule,
    DatePipe,
    TranslocoModule,
    BidiModule,
    AppIconComponent,
    AppButtonDirective,
  ],
  template: `
    <!-- Bell trigger -->
    <div #trigger cdkOverlayOrigin #origin="cdkOverlayOrigin">
      <button
        appButton
        variant="ghost"
        size="icon"
        type="button"
        (click)="toggleOpen()"
        class="relative"
        [attr.aria-label]="'notifications.bell' | transloco"
      >
        <app-icon name="bell" [size]="16"></app-icon>
        @if (unreadCount() > 0) {
          <span class="absolute -top-1 -end-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-state-danger text-white text-[10px] font-bold">
            {{ unreadCount() > 99 ? '99+' : unreadCount() }}
          </span>
        }
      </button>
    </div>

    <!-- Notifications dropdown -->
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="isOpen()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayViewportMargin]="8"
      (overlayOutsideClick)="isOpen.set(false)"
      (detach)="isOpen.set(false)"
    >
      <div
        class="w-[380px] max-h-[480px] rounded-lg border border-border bg-background shadow-dialog flex flex-col"
        [style.animation]="'scaleIn 120ms ease-out forwards'"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <h3 class="text-[14px] font-semibold text-foreground">
            {{ 'notifications.title' | transloco }}
          </h3>
          @if (unreadCount() > 0) {
            <button
              appButton
              variant="ghost"
              size="sm"
              type="button"
              (click)="markAllRead()"
              [disabled]="marking()"
              class="text-[13px] font-medium"
            >
              {{ 'notifications.markAllRead' | transloco }}
            </button>
          }
        </div>

        <!-- Notifications list -->
        <div class="flex-1 overflow-y-auto">
          @if (notificationsLoading() && notificationItems().length === 0) {
            <!-- Loading state -->
            <div class="px-4 py-8 text-center">
              <p class="text-[13px] text-muted-foreground">
                {{ 'common.loading' | transloco }}
              </p>
            </div>
          } @else if (notificationItems().length === 0) {
            <!-- Empty state -->
            <div class="px-4 py-8 text-center">
              <app-icon name="bell-off" [size]="32" class="mx-auto mb-2 text-muted-foreground"></app-icon>
              <p class="text-[13px] font-medium text-foreground mb-1">
                {{ 'notifications.empty' | transloco }}
              </p>
              <p class="text-[12px] text-muted-foreground">
                {{ 'notifications.emptyHint' | transloco }}
              </p>
            </div>
          } @else {
            <!-- Notifications -->
            <div class="divide-y divide-border-muted">
              @for (notification of notificationItems(); track notification.id) {
                <button
                  type="button"
                  class="w-full px-4 py-3 text-start hover:bg-gutter transition-colors"
                  [class.bg-brand-tint]="!notification.readAt"
                  (click)="handleNotificationClick(notification)"
                >
                  <div class="flex items-start gap-2">
                    <!-- Icon -->
                    <div class="flex-shrink-0 mt-0.5">
                      <app-icon
                        [name]="notificationIcon(notification.type)"
                        [size]="16"
                        [class]="notificationIconClass(notification.type)"
                      ></app-icon>
                    </div>

                    <!-- Content -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-baseline gap-2 mb-0.5">
                        <p class="text-[13px] font-medium text-foreground truncate">
                          {{ notificationLabel(notification.type) }}
                        </p>
                        @if (!notification.readAt) {
                          <span class="h-1.5 w-1.5 rounded-full bg-state-danger flex-shrink-0"></span>
                        }
                      </div>
                      <p class="text-[12px] text-muted-foreground truncate">
                        {{ notification.projectName }} • {{ notification.commentBodyExcerpt }}
                      </p>
                      <p class="text-[11px] text-muted-foreground mt-1">
                        {{ notification.createdAt | date:'short' }}
                      </p>
                    </div>
                  </div>
                </button>
              }
            </div>
          }
        </div>

        <!-- Footer (pagination or empty) -->
        @if (notificationItems().length > 0 && hasPagination()) {
          <div class="px-4 py-3 border-t border-border flex justify-between items-center shrink-0">
            <button
              appButton
              variant="ghost"
              size="sm"
              type="button"
              (click)="loadPrevious()"
              [disabled]="!canPrev()"
            >
              <app-icon name="chevron-left" [size]="16"></app-icon>
            </button>
            <p class="text-[12px] text-muted-foreground">
              {{ currentPageNum() }} / {{ totalPages() }}
            </p>
            <button
              appButton
              variant="ghost"
              size="sm"
              type="button"
              (click)="loadNext()"
              [disabled]="!canNext()"
            >
              <app-icon name="chevron-right" [size]="16"></app-icon>
            </button>
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    @keyframes scaleIn {
      from {
        transform: scale(0.98);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
  `],
  host: {
    class: 'inline-block',
    '(document:keydown.escape)': 'isOpen.set(false)',
  },
})
export class NotificationsBellComponent {
  private readonly meService = inject(MeService);
  private readonly unreadCountResource = getApiMeNotificationsUnreadCountResource();
  private readonly toast = inject(AppToastService);

  readonly isOpen = signal(false);
  readonly marking = signal(false);
  readonly currentPageNum = signal(1);
  readonly notificationsLoading = computed(() => this.notificationsResource.isLoading());

  readonly notificationsParams = computed<GetApiMeNotificationsParams>(() => ({
    pageNumber: this.currentPageNum(),
    pageSize: 10,
  }));

  readonly notificationsResource = getApiMeNotificationsResource(
    computed(() => this.notificationsParams()),
  );

  readonly unreadCount = computed(() => {
    const count = this.unreadCountResource.value()?.count ?? 0;
    return Math.max(0, count);
  });

  readonly notificationItems = computed(() =>
    this.notificationsResource.value()?.items ?? [],
  );

  readonly pagination = computed(() => this.notificationsResource.value()?.pagination);
  readonly totalPages = computed(() => this.pagination()?.totalPages ?? 0);
  readonly hasPagination = computed(() => this.totalPages() > 1);
  readonly canPrev = computed(() => this.currentPageNum() > 1);
  readonly canNext = computed(() => this.currentPageNum() < this.totalPages());

  private readonly trigger = viewChild<any>('trigger');

  readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  constructor() {
    // Poll unread count ~60 seconds
    effect(() => {
      if (!this.isOpen()) {
        // Pause polling when dropdown is closed or document is hidden
        return;
      }

      const pollInterval = setInterval(() => {
        if (document.hidden) {
          return; // Pause when page is not visible
        }
        this.unreadCountResource.reload();
      }, 60000);

      return () => clearInterval(pollInterval);
    });

    // Also reload when document becomes visible
    effect(() => {
      const handleVisibilityChange = () => {
        if (!document.hidden && this.isOpen()) {
          this.unreadCountResource.reload();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    });
  }

  toggleOpen(): void {
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.notificationsResource.reload();
    }
  }

  notificationIcon(type?: any): string {
    switch (type) {
      case 1: return 'message-square'; // CommentApplied
      case 2: return 'message-square'; // CommentReopened
      case 3: return 'reply'; // ReplyAdded
      default: return 'bell';
    }
  }

  notificationIconClass(type?: any): string {
    switch (type) {
      case 1: return 'text-state-completed'; // CommentApplied
      case 2: return 'text-state-open'; // CommentReopened
      case 3: return 'text-state-ready'; // ReplyAdded
      default: return 'text-muted-foreground';
    }
  }

  notificationLabel(type?: any): string {
    switch (type) {
      case 1: return 'Comment Applied';
      case 2: return 'Comment Reopened';
      case 3: return 'Reply Added';
      default: return 'Notification';
    }
  }

  handleNotificationClick(notification: NotificationDto): void {
    if (!notification.readAt && notification.id) {
      this.markRead(notification.id);
    }
  }

  markRead(id: number): void {
    this.marking.set(true);
    this.meService.patchApiMeNotificationsIdRead(id).subscribe({
      next: () => {
        this.unreadCountResource.reload();
        this.notificationsResource.reload();
        this.marking.set(false);
      },
      error: () => {
        this.toast.show('Error marking notification as read', 'danger');
        this.marking.set(false);
      },
    });
  }

  markAllRead(): void {
    this.marking.set(true);
    this.meService.postApiMeNotificationsReadAll().subscribe({
      next: () => {
        this.unreadCountResource.reload();
        this.notificationsResource.reload();
        this.currentPageNum.set(1);
        this.marking.set(false);
      },
      error: () => {
        this.toast.show('Error marking all notifications as read', 'danger');
        this.marking.set(false);
      },
    });
  }

  loadNext(): void {
    if (this.canNext()) {
      this.currentPageNum.update(p => p + 1);
      this.notificationsResource.reload();
    }
  }

  loadPrevious(): void {
    if (this.canPrev()) {
      this.currentPageNum.update(p => p - 1);
      this.notificationsResource.reload();
    }
  }
}
