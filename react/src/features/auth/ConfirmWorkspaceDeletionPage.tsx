// ConfirmWorkspaceDeletionPage — DB-18 §11 task 3. Anonymous landing page for the e-mailed
// confirmation link ({app}/confirm-workspace-deletion?token=…) — works signed out; the token is
// the credential, exactly like DeleteAccountPage/ResetPasswordPage. Loads the preview
// (POST /api/auth/workspace-deletion/preview), offers Export / Pause instead again, then a form
// (typed workspace name + password, password hidden when `requiresPassword` is false) that
// schedules the deletion.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  usePostApiAuthWorkspaceDeletionPreview,
  usePostApiAuthWorkspaceDeletionPauseInstead,
  usePostApiAuthWorkspaceDeletionConfirm,
  getApiExport,
  type WorkspaceDeletionPreviewResponse,
  type WorkspaceDeletionScheduledResponse,
} from '@moamen-ui/pointer-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/shared/FormField';
import { extractMessage } from '@/lib/error';
import { AuthLayout } from '@/components/AuthLayout';
import { useAuth } from '@/lib/auth';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function ConfirmWorkspaceDeletionPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [preview, setPreview] = useState<WorkspaceDeletionPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pausedDone, setPausedDone] = useState(false);
  const [scheduled, setScheduled] = useState<WorkspaceDeletionScheduledResponse | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [workspaceNameInput, setWorkspaceNameInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const previewMut = usePostApiAuthWorkspaceDeletionPreview({
    mutation: {
      onSuccess: (res) => setPreview(res),
      onError: (e) => setPreviewError(extractMessage(e)),
    },
  });

  // Fetch the preview exactly once per token.
  useEffect(() => {
    if (!token) return;
    previewMut.mutate({ data: { token } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const pauseInsteadMut = usePostApiAuthWorkspaceDeletionPauseInstead({
    mutation: {
      onSuccess: () => setPausedDone(true),
      onError: (e) => setConfirmError(extractMessage(e)),
    },
  });

  const confirmMut = usePostApiAuthWorkspaceDeletionConfirm({
    mutation: {
      onSuccess: (res) => setScheduled(res),
      onError: (e) => setConfirmError(extractMessage(e)),
    },
  });

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
    } catch (e) {
      setExportError(extractMessage(e));
    } finally {
      setExporting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-5">
          <h1 className="text-center text-xl font-bold">{t('workspaceLifecycle.confirmTitle')}</h1>
          <p className="text-center text-sm text-destructive">
            {t('workspaceLifecycle.deletionLinkInvalid')}
          </p>
          <Link to="/login" className="text-center text-sm text-brand hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // Invalid/expired/already-used token: server message + link to /login.
  if (previewError) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-5">
          <h1 className="text-center text-xl font-bold">{t('workspaceLifecycle.confirmTitle')}</h1>
          <p className="text-center text-sm text-destructive">{previewError}</p>
          <Link to="/login" className="text-center text-sm text-brand hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (scheduled) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-5">
          <h1 className="text-center text-xl font-bold">{t('workspaceLifecycle.confirmTitle')}</h1>
          <p className="text-center text-sm text-state-completed">
            {t('workspaceLifecycle.confirmDone', {
              date: formatDateTime(scheduled.deletionScheduledFor),
            })}
          </p>
          <Link to="/login" className="text-center text-sm text-brand hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (pausedDone) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-5">
          <h1 className="text-center text-xl font-bold">{t('workspaceLifecycle.confirmTitle')}</h1>
          <p className="text-center text-sm text-state-completed">
            {t('workspaceLifecycle.pausedDone')}
          </p>
          <Link to="/login" className="text-center text-sm text-brand hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (!preview) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-5">
          <h1 className="text-center text-xl font-bold">{t('workspaceLifecycle.confirmTitle')}</h1>
          <p className="text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      </AuthLayout>
    );
  }

  const canExportHere = isAuthenticated && user?.workspaceId === preview.workspaceId;
  const requiresPassword = preview.requiresPassword !== false;
  const nameMatches = workspaceNameInput.trim() === (preview.workspaceName ?? '').trim();
  const canSubmit = nameMatches && (!requiresPassword || password.length > 0);

  function submit() {
    if (!canSubmit) return;
    setConfirmError(null);
    confirmMut.mutate({
      data: {
        token,
        workspaceName: workspaceNameInput.trim(),
        password: requiresPassword ? password : undefined,
      },
    });
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-5">
        <h1 className="text-center text-xl font-bold">{t('workspaceLifecycle.confirmTitle')}</h1>
        <p className="text-center text-sm font-medium">{preview.workspaceName}</p>

        <p className="text-center text-sm text-muted-foreground">
          {t('workspaceLifecycle.confirmCounts', {
            projects: preview.projectCount ?? 0,
            comments: preview.commentCount ?? 0,
            members: preview.memberCount ?? 0,
          })}
        </p>

        {(preview.accountsDeletedWithWorkspace ?? 0) > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {t('workspaceLifecycle.confirmAccounts', {
              count: preview.accountsDeletedWithWorkspace ?? 0,
            })}
          </p>
        )}
        {preview.requesterAccountDeleted && (
          <p className="text-center text-sm font-medium text-state-danger">
            {t('workspaceLifecycle.confirmYourAccount')}
          </p>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {t('workspaceLifecycle.scheduled', { date: formatDateTime(preview.wouldBeDeletedOn) })}
        </p>

        <div className="flex flex-col gap-2">
          {canExportHere ? (
            <Button variant="outline" disabled={exporting} onClick={handleExport}>
              {t('workspaceLifecycle.export')}
            </Button>
          ) : (
            <Link to="/login" className="text-center text-sm text-brand hover:underline">
              {t('workspaceLifecycle.signInToExport')}
            </Link>
          )}
          {exportError && <p className="text-center text-sm text-destructive">{exportError}</p>}

          <Button
            variant="outline"
            disabled={pauseInsteadMut.isPending}
            onClick={() => pauseInsteadMut.mutate({ data: { token } })}
          >
            {t('workspaceLifecycle.pauseInstead')}
          </Button>
          <p className="text-center text-[12px] text-muted-foreground">
            {t('workspaceLifecycle.pauseInsteadHint')}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
          className="flex flex-col gap-4 border-t border-border-muted pt-4"
        >
          <FormField label={t('workspaceLifecycle.typeName')} htmlFor="confirm-workspace-name">
            <Input
              id="confirm-workspace-name"
              value={workspaceNameInput}
              onChange={(e) => setWorkspaceNameInput(e.target.value)}
              autoFocus
            />
          </FormField>

          {requiresPassword && (
            <FormField label={t('workspaceLifecycle.password')} htmlFor="confirm-workspace-password">
              <PasswordInput
                id="confirm-workspace-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
          )}

          {confirmError && <p className="text-sm text-destructive">{confirmError}</p>}

          <Button
            type="submit"
            variant="destructive"
            disabled={!canSubmit || confirmMut.isPending}
          >
            {t('workspaceLifecycle.confirmButton')}
          </Button>
          <Link to="/login" className="text-center text-sm text-muted-foreground hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </form>
      </div>
    </AuthLayout>
  );
}
