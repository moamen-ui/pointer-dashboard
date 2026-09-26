// New workspace dialog (DB-19) — lets a signed-in Workspace Admin open another workspace from the
// header switcher's "+ New workspace" item, without a second signup. `POST /api/me/workspaces`
// returns either `status: "active"` (switch straight into it, same as the switcher's own
// `switchWorkspace`) or `status: "pending_approval"` (stays on the current workspace; the new one
// awaits super-admin approval and — per `AuthService.BuildWorkspaceChoicesAsync` — will not appear
// in the switcher list until then, since that list is filtered to live+active+approved
// memberships). Errors: 400 validation (name) rendered inline; 400 plan-limit
// (`isLimitReached`) is caught globally by the axios interceptor (lib/api.ts) and already surfaces
// through `<UpgradePrompt>` — this dialog's own onError only adds the generic toast every other
// mutation in the app uses, never a second limit-specific message; 403 (Forbidden /
// EmailNotVerified) and 429 (rate limit) fall back to the same generic toast, matching
// `usePostApiMeVerificationResend`'s 429 handling in Shell.tsx.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePostApiMeWorkspaces,
  getGetApiMeWorkspacesAllowanceQueryKey,
  getGetApiAuthMeQueryKey,
} from '@moamen-ui/pointer-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/FormField';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';
import { lengthRangeError } from '@/lib/validators';
import { useAuth } from '@/lib/auth';

const MAX_NAME_LENGTH = 120;

interface NewWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful create + (if active) switch, so the caller can navigate. */
  onCreated?: () => void;
}

export function NewWorkspaceDialog({ open, onOpenChange, onCreated }: NewWorkspaceDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { switchWorkspace } = useAuth();

  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [switching, setSwitching] = useState(false);

  const trimmed = name.trim();
  const validationError = lengthRangeError(name, 1, MAX_NAME_LENGTH, t);
  const nameError = touched && validationError ? validationError : undefined;

  function reset() {
    setName('');
    setTouched(false);
  }

  const reload = () => {
    void qc.invalidateQueries({ queryKey: getGetApiMeWorkspacesAllowanceQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetApiAuthMeQueryKey() });
  };

  const createMut = usePostApiMeWorkspaces({
    mutation: {
      onSuccess: async (res) => {
        if (res.status === 'active' && res.workspaceId) {
          setSwitching(true);
          try {
            await switchWorkspace(res.workspaceId);
            toast(t('newWorkspace.activeToast', { name: res.name ?? trimmed }));
            onOpenChange(false);
            reset();
            navigate('/', { replace: true });
            onCreated?.();
          } catch (err) {
            // The workspace was created; only the switch failed (e.g. a transient network
            // error) — tell the admin so they can switch manually from the switcher instead
            // of believing creation itself failed.
            toast(extractMessage(err) || t('newWorkspace.switchFailed'), 'error');
          } finally {
            setSwitching(false);
          }
          return;
        }
        // pending_approval: nothing to switch into yet — it stays out of the switcher list
        // until a super admin approves it (AuthService only returns live/active/approved
        // memberships there).
        toast(t('newWorkspace.pendingToast'));
        reload();
        onOpenChange(false);
        reset();
      },
      onError: (e: unknown) => {
        const status = (e as { response?: { status?: number } })?.response?.status;
        toast(status === 429 ? t('common.tooManyRequests') : extractMessage(e), 'error');
      },
    },
  });

  function submit() {
    if (validationError || createMut.isPending || switching) {
      setTouched(true);
      return;
    }
    createMut.mutate({ data: { name: trimmed } });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold leading-6">
            {t('newWorkspace.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <p className="text-[14px] text-muted-foreground">{t('newWorkspace.description')}</p>
          <FormField label={t('newWorkspace.nameLabel')} htmlFor="new-workspace-name" error={nameError}>
            <Input
              id="new-workspace-name"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </FormField>
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!!validationError || createMut.isPending || switching}
            onClick={submit}
          >
            {t('newWorkspace.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
