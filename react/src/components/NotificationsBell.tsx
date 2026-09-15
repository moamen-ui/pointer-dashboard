import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiMeNotificationsUnreadCount,
  useGetApiMeNotifications,
  usePatchApiMeNotificationsIdRead,
  usePostApiMeNotificationsReadAll,
  getGetApiMeNotificationsUnreadCountQueryKey,
  getGetApiMeNotificationsQueryKey,
  NotificationType,
  type NotificationDto,
} from '@moamen-ui/pointer-react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { formatRelativeTime } from '@/lib/format';

const POLL_INTERVAL = 60000; // 60 seconds

// NotificationType is a numeric enum (1 CommentApplied, 2 CommentReopened, 3 ReplyAdded).
function getNotificationLabelKey(type: NotificationType | undefined): string {
  switch (type) {
    case NotificationType.NUMBER_1: return 'notifications.commentApplied';
    case NotificationType.NUMBER_2: return 'notifications.commentReopened';
    case NotificationType.NUMBER_3: return 'notifications.replyAdded';
    default: return '';
  }
}

export function NotificationsBell() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Fetch unread count
  const { data: countData } = useGetApiMeNotificationsUnreadCount({});
  const unreadCount = countData?.count ?? 0;

  // Fetch notifications list
  const { data: notificationsData } = useGetApiMeNotifications({}, {
    query: {
      enabled: open,
      refetchInterval: open ? POLL_INTERVAL : false,
    }
  });
  const notifications: NotificationDto[] = notificationsData?.items ?? [];

  // Mutations
  const markReadMut = usePatchApiMeNotificationsIdRead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetApiMeNotificationsUnreadCountQueryKey() });
        qc.invalidateQueries({ queryKey: getGetApiMeNotificationsQueryKey() });
      },
    },
  });

  const markAllReadMut = usePostApiMeNotificationsReadAll({
    mutation: {
      onSuccess: () => {
        setOpen(false);
        qc.invalidateQueries({ queryKey: getGetApiMeNotificationsUnreadCountQueryKey() });
        qc.invalidateQueries({ queryKey: getGetApiMeNotificationsQueryKey() });
        toast(t('notifications.markedRead'));
      },
      onError: () => {
        toast(t('common.error'), 'error');
      },
    },
  });

  // Pause polling when document hidden
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        // Pause polling by invalidating the query
      } else {
        // Resume if needed
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title={t('notifications.bell')} className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[350px]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-[13px] font-medium">{t('notifications.title')}</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[12px] h-auto px-2 py-1"
              onClick={() => markAllReadMut.mutate()}
              disabled={markAllReadMut.isPending}
            >
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-3 text-center text-[13px] text-muted-foreground">
              {t('notifications.empty')}
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`px-3 py-2 border-b border-border-muted last:border-b-0 cursor-pointer hover:bg-gutter ${
                  !notif.readAt ? 'bg-brand-tint' : ''
                }`}
                onClick={() => {
                  if (!notif.readAt && notif.id) {
                    markReadMut.mutate({ id: notif.id });
                  }
                  setOpen(false);
                  if (notif.projectKey && notif.commentId != null) {
                    navigate(`/comments?project=${encodeURIComponent(notif.projectKey)}&comment=${notif.commentId}`);
                  }
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">
                      {(() => {
                        const key = getNotificationLabelKey(notif.type);
                        return key ? t(key) : String(notif.type ?? '');
                      })()}
                    </div>
                    {notif.commentBodyExcerpt && (
                      <div className="text-[12px] text-muted-foreground mt-0.5 truncate">
                        {notif.commentBodyExcerpt}
                      </div>
                    )}
                    <div className="text-[12px] text-muted-foreground mt-1">
                      {formatRelativeTime(t, notif.createdAt)}
                    </div>
                  </div>
                  {!notif.readAt && (
                    <div className="h-2 w-2 rounded-full bg-brand shrink-0 mt-1.5" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
