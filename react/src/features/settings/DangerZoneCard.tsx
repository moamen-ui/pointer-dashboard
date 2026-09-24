// DangerZoneCard — DB-18 §11 task 1/2. Workspace-Admin-only card in Settings (gated by
// `useGetApiAdminWorkspace().canManageLifecycle`, which is already false for a Deputy, a live
// demo, or any non-admin — the §3.4 guard evaluated server-side without side effects, so this
// component needs no extra hiding logic of its own beyond that one flag). Three rows: Export data
// (the existing whole-workspace comment export, surfaced), Pause workspace / Resume, and Delete
// workspace, whose dialog offers Export + "Pause instead" before e-mailing a confirmation link.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  useGetApiAdminWorkspace,
  usePostApiAdminWorkspacePause,
  usePostApiAdminWorkspaceResume,
  usePostApiAdminWorkspaceDeletionRequest,
  usePostApiAdminWorkspaceDeletionCancel,
  getGetApiAdminWorkspaceQueryKey,
  getGetApiAuthMeQueryKey,
  getApiExport,
} from '@moamen-ui/pointer-react';
import { AccordionSection } from '@/components/ui/accordion-section';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString();
  } catch {
    return value;
  }
}

type DeleteStep = 'intro' | 'confirm' | 'sent';

export function DangerZoneCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data } = useGetApiAdminWorkspace();

  const reload = () => {
    void qc.invalidateQueries({ queryKey: getGetApiAdminWorkspaceQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetApiAuthMeQueryKey() });
  };
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // ---- Export (whole-workspace comment export — GET /api/export, surfaced honestly) ----
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const exportData = await getApiExport({ IncludePrivate: true });
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.download = `pointer-export-workspace-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast(t('exportImport.exported'));
    } catch (e) {
      // The 5 000-comment refusal (MaxExportCommentCount) surfaces its server message here,
      // with a link to export per project instead (§11 task 1).
      setExportError(extractMessage(e));
    } finally {
      setExporting(false);
    }
  }

  // ---- Pause / Resume ----
  const [confirmPauseOpen, setConfirmPauseOpen] = useState(false);
  const pauseMut = usePostApiAdminWorkspacePause({
    mutation: {
      onSuccess: () => {
        toast(t('workspaceLifecycle.pause'));
        reload();
      },
      onError,
    },
  });
  const resumeMut = usePostApiAdminWorkspaceResume({
    mutation: {
      onSuccess: () => {
        toast(t('workspaceLifecycle.resume'));
        reload();
      },
      onError,
    },
  });

  // ---- Delete dialog ----
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>('intro');
  const [dialogError, setDialogError] = useState<string | null>(null);

  const requestMut = usePostApiAdminWorkspaceDeletionRequest({
    mutation: {
      onSuccess: () => {
        setDialogError(null);
        setDeleteStep('sent');
        reload();
      },
      onError: (e) => setDialogError(extractMessage(e)),
    },
  });
  const cancelMut = usePostApiAdminWorkspaceDeletionCancel({
    mutation: {
      onSuccess: () => {
        toast(t('workspaceLifecycle.cancelDeletion'));
        reload();
      },
      onError,
    },
  });

  function openDelete() {
    setDeleteStep('intro');
    setDialogError(null);
    setDeleteOpen(true);
  }

  function pauseInsteadFromDialog() {
    setDeleteOpen(false);
    pauseMut.mutate();
  }

  if (!data?.canManageLifecycle) return null;

  const isPaused = !!data.pausedAt;
  const isScheduled = !!data.deletionScheduledFor;
  const isPendingRequest = !!data.deletionRequestedAt && !isScheduled;
  const graceDays = data.graceDays ?? 7;

  return (
    <AccordionSection title={t('workspaceLifecycle.dangerZone')}>
      <div className="flex flex-col gap-5">
        {/* Export */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-medium">{t('workspaceLifecycle.export')}</span>
            <span className="max-w-[56ch] text-[12px] text-muted-foreground">
              {t('workspaceLifecycle.exportCaption')}
            </span>
            {exportError && (
              <p className="text-[12px] text-state-danger">
                {exportError}{' '}
                <Link to="/projects" className="underline hover:opacity-75">
                  {t('workspaceLifecycle.exportPerProjectLink')}
                </Link>
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
            {t('workspaceLifecycle.export')}
          </Button>
        </div>

        {/* Pause / Resume */}
        <div className="flex items-center justify-between gap-4 border-t border-border-muted pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-medium">
              {isPaused ? t('workspaceLifecycle.resume') : t('workspaceLifecycle.pause')}
            </span>
            <span className="max-w-[56ch] text-[12px] text-muted-foreground">
              {t('workspaceLifecycle.pauseHint')}
            </span>
            {data.pausedByOperator && (
              <span className="text-[12px] text-state-danger">
                {t('workspaceLifecycle.bannerPausedOperator')}
              </span>
            )}
          </div>
          {isPaused ? (
            <Button
              variant="outline"
              size="sm"
              disabled={data.pausedByOperator || resumeMut.isPending || isScheduled}
              onClick={() => resumeMut.mutate()}
            >
              {t('workspaceLifecycle.resume')}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={isScheduled || pauseMut.isPending}
              onClick={() => setConfirmPauseOpen(true)}
            >
              {t('workspaceLifecycle.pause')}
            </Button>
          )}
        </div>

        {/* Delete */}
        <div className="flex items-center justify-between gap-4 border-t border-border-muted pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-medium text-destructive">
              {t('workspaceLifecycle.delete')}
            </span>
            {isScheduled && (
              <span className="text-[12px] text-state-danger">
                {t('workspaceLifecycle.scheduled', {
                  date: formatDateTime(data.deletionScheduledFor),
                })}
              </span>
            )}
            {isPendingRequest && (
              <span className="text-[12px] text-muted-foreground">
                {t('workspaceLifecycle.emailSent', {
                  time: formatTime(data.deletionRequestedAt),
                })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isScheduled ? (
              <Button
                variant="outline"
                size="sm"
                disabled={cancelMut.isPending}
                onClick={() => cancelMut.mutate()}
              >
                {t('workspaceLifecycle.cancelDeletion')}
              </Button>
            ) : isPendingRequest ? (
              <Button
                variant="outline"
                size="sm"
                disabled={cancelMut.isPending}
                onClick={() => cancelMut.mutate()}
              >
                {t('workspaceLifecycle.cancelRequest')}
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                disabled={data.pausedByOperator}
                onClick={openDelete}
              >
                {t('workspaceLifecycle.delete')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmPauseOpen}
        message={t('workspaceLifecycle.pauseHint')}
        confirmLabel={t('workspaceLifecycle.pause')}
        onConfirm={() => {
          setConfirmPauseOpen(false);
          pauseMut.mutate();
        }}
        onCancel={() => setConfirmPauseOpen(false)}
      />

      {/* Delete dialog — step 1 "before you delete" (Export / Pause instead), step 2 what
          happens + Send confirmation e-mail, step 3 "check your inbox". */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          {deleteStep === 'intro' && (
            <>
              <DialogHeader>
                <DialogTitle>{t('workspaceLifecycle.beforeDelete')}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <Button variant="outline" onClick={handleExport} disabled={exporting}>
                  {t('workspaceLifecycle.export')}
                </Button>
                <Button
                  variant="outline"
                  onClick={pauseInsteadFromDialog}
                  disabled={pauseMut.isPending}
                >
                  {t('workspaceLifecycle.pauseInstead')}
                </Button>
                <p className="text-[12px] text-muted-foreground">
                  {t('workspaceLifecycle.pauseInsteadHint')}
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button variant="destructive" onClick={() => setDeleteStep('confirm')}>
                  {t('workspaceLifecycle.continueDelete')}
                </Button>
              </DialogFooter>
            </>
          )}

          {deleteStep === 'confirm' && (
            <>
              <DialogHeader>
                <DialogTitle>{t('workspaceLifecycle.delete')}</DialogTitle>
                <DialogDescription>
                  {t('workspaceLifecycle.whatHappens', { days: graceDays })}
                </DialogDescription>
              </DialogHeader>
              {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleteStep('intro')}>
                  {t('workspaceLifecycle.back')}
                </Button>
                <Button
                  variant="destructive"
                  disabled={requestMut.isPending}
                  onClick={() => requestMut.mutate()}
                >
                  {t('workspaceLifecycle.sendEmail')}
                </Button>
              </DialogFooter>
            </>
          )}

          {deleteStep === 'sent' && (
            <>
              <DialogHeader>
                <DialogTitle>{t('workspaceLifecycle.sendEmail')}</DialogTitle>
                <DialogDescription>{t('workspaceLifecycle.checkInbox')}</DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button onClick={() => setDeleteOpen(false)}>{t('common.close')}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AccordionSection>
  );
}
