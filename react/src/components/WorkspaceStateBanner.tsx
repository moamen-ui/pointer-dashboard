// WorkspaceStateBanner — DB-18 §11 task 4: a persistent shell banner while the current session's
// workspace is paused or has a deletion scheduled (`me.workspacePausedAt` /
// `me.workspaceDeletionScheduledFor`). Same placement/shape family as VerificationBanner (a
// full-width strip above the main content), but in the danger hue — a frozen workspace is more
// severe than an unverified e-mail. Admins get Resume / Cancel deletion buttons; a Deputy is
// `isAdmin` too but is not the Workspace Admin the API's lifecycle guard requires, so button
// visibility is driven by `useGetApiAdminWorkspace().canManageLifecycle`, not `isAdmin` alone.
// Everyone else sees the read-only notice with no actions.
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import {
  useGetApiAdminWorkspace,
  usePostApiAdminWorkspaceResume,
  usePostApiAdminWorkspaceDeletionCancel,
  getGetApiAdminWorkspaceQueryKey,
  getGetApiAuthMeQueryKey,
  type MeResponse,
} from '@moamen-ui/pointer-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';
import { useAuth } from '@/lib/auth';

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function WorkspaceStateBanner({ me }: { me: MeResponse | undefined }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin } = useAuth();

  const isPaused = !!me?.workspacePausedAt;
  const isScheduled = !!me?.workspaceDeletionScheduledFor;
  const frozen = isPaused || isScheduled;

  // Only a Workspace Admin (not a Deputy, not a super admin) can ever manage lifecycle — fetch
  // the one field that says so, only once the banner actually has something to show.
  const { data: workspace } = useGetApiAdminWorkspace({
    query: { enabled: frozen && isAdmin && !isSuperAdmin },
  });

  const reload = () => {
    void qc.invalidateQueries({ queryKey: getGetApiAdminWorkspaceQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetApiAuthMeQueryKey() });
  };
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  const resumeMut = usePostApiAdminWorkspaceResume({ mutation: { onSuccess: reload, onError } });
  const cancelMut = usePostApiAdminWorkspaceDeletionCancel({
    mutation: { onSuccess: reload, onError },
  });

  if (!frozen) return null;

  const canManage = !!workspace?.canManageLifecycle;

  const text = isScheduled
    ? t('workspaceLifecycle.bannerScheduled', {
        date: formatDate(me?.workspaceDeletionScheduledFor),
      })
    : me?.workspacePausedByOperator
      ? t('workspaceLifecycle.bannerPausedOperator')
      : t('workspaceLifecycle.bannerPaused');

  return (
    <div className="border-b border-state-danger/30 bg-state-danger-tint px-6 py-2.5">
      <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center gap-x-2 gap-y-1.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-state-danger" aria-hidden="true" />
        <span className="text-[13px] font-medium text-state-danger">{text}</span>
        {canManage && (
          <div className="ms-auto flex shrink-0 items-center gap-2">
            {isScheduled && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={cancelMut.isPending}
                onClick={() => cancelMut.mutate()}
              >
                {t('workspaceLifecycle.cancelDeletion')}
              </Button>
            )}
            {isPaused && !me?.workspacePausedByOperator && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={resumeMut.isPending}
                onClick={() => resumeMut.mutate()}
              >
                {t('workspaceLifecycle.resume')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
