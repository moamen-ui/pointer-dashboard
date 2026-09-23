// DemoPanel — shown inside the shell whenever the signed-in identity's current workspace is a
// live demo. DB-17: the countdown's source of truth is `me.demoExpiresAt` (server, survives
// reloads and other tabs) — the `pointer_demo` sessionStorage entry only supplies the widget
// login credentials block, which exists solely in the tab that ran the demo provision/upgrade
// flow. The setup steps themselves live in the shared install guide (also reachable from the
// header icon), opened here via a "View installation steps" button. Dismissal only hides the
// banner — the session holds credentials the guide still needs.
import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { X, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/shared/FormField';
import { emailError, passwordError, requiredError, maxLengthError } from '@/lib/validators';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  usePostApiDemoUpgrade,
  usePostApiDemoExtend,
  getApiAuthMe,
  getGetApiAuthMeQueryKey,
  type MeResponse,
} from '@moamen-ui/pointer-react';
import { setAuthHeader } from '@/lib/api';
import { setItem, TOKEN_KEY, USER_KEY } from '@/lib/storage';
import { extractMessage } from '@/lib/error';
import { useToast } from '@/components/ui/toast';
import { useInstallGuide } from '@/components/InstallGuide';

const DEMO_SESSION_KEY = 'pointer_demo';
/** Banner-only hide flag — the session itself outlives a dismissal. */
const DEMO_DISMISSED_KEY = 'pointer_demo_dismissed';
// DB-14: DemoService.UpgradeAsync now re-validates through PasswordPolicy.Validate (10-128
// chars, not common, not the address) — this constant only drives the client-side "too short"
// check; see `common.passwordPolicyHint` for the hint shown next to the field.
const UPGRADE_MIN_PASSWORD_LENGTH = 10;
// DB-17: UpgradeDemoValidator caps WorkspaceName at 120 chars server-side.
const WORKSPACE_NAME_MAX = 120;
// DB-17: red state mirrors the expiry-warning e-mail's own window (two hours before TTL).
const EXPIRING_SOON_MS = 2 * 60 * 60 * 1000;

interface DemoSession {
  email: string | null;
  password: string | null;
  projectKey: string | null;
  serverUrl: string | null;
  expiresAt: string | undefined;
  emailSent?: boolean;
}

function readDemoSession(): DemoSession | null {
  try {
    const raw = sessionStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoSession;
  } catch {
    return null;
  }
}

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DEMO_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function DemoPanel({ me }: { me: MeResponse | undefined }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const installGuide = useInstallGuide();
  // Credentials-only: the widget login/password/project key this tab's own demo
  // provision (or upgrade) call stashed. Absent in another tab or after a reload
  // that outlived it — the banner itself does not depend on this.
  const [session] = useState<DemoSession | null>(() => readDemoSession());
  const [dismissed, setDismissed] = useState(() => readDismissed());
  const [countdown, setCountdown] = useState<string>('');

  // Upgrade dialog state
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [upgradeConfirmPassword, setUpgradeConfirmPassword] = useState('');
  const [upgradeDisplayName, setUpgradeDisplayName] = useState('');
  const [upgradeWorkspaceName, setUpgradeWorkspaceName] = useState('');
  const [upgradeEmailTouched, setUpgradeEmailTouched] = useState(false);
  const [upgradePasswordTouched, setUpgradePasswordTouched] = useState(false);
  const [upgradeConfirmTouched, setUpgradeConfirmTouched] = useState(false);
  const [upgradeWorkspaceNameTouched, setUpgradeWorkspaceNameTouched] = useState(false);
  const [upgradeSubmitted, setUpgradeSubmitted] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const upgradeMut = usePostApiDemoUpgrade();

  // DB-17: "Extend once (+24 h)" — hidden entirely when the server says it's already used
  // (or the workspace isn't a live demo at all); on success the /me query is invalidated so
  // the countdown (this component's own source of truth) picks up the new expiry.
  const extendMut = usePostApiDemoExtend({
    mutation: {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getGetApiAuthMeQueryKey() });
        toast(t('demo.extendSuccess'));
      },
      onError: (err: unknown) => {
        toast(extractMessage(err), 'error');
      },
    },
  });

  const upgradeEmailErrorMsg = emailError(upgradeEmail, t);
  const upgradePasswordErrorMsg = passwordError(
    upgradePassword,
    UPGRADE_MIN_PASSWORD_LENGTH,
    t,
  );
  const upgradeConfirmErrorMsg = requiredError(upgradeConfirmPassword, t);
  const upgradeWorkspaceNameErrorMsg = maxLengthError(upgradeWorkspaceName, WORKSPACE_NAME_MAX, t);
  // Cross-field check — like the Angular form's group validator, it only fires
  // when both passwords are non-empty and is not a per-field error.
  const upgradePasswordsMismatch =
    !!upgradePassword && !!upgradeConfirmPassword && upgradePassword !== upgradeConfirmPassword;
  const upgradeFormInvalid =
    !!upgradeEmailErrorMsg ||
    !!upgradePasswordErrorMsg ||
    !!upgradeConfirmErrorMsg ||
    !!upgradeWorkspaceNameErrorMsg ||
    upgradePasswordsMismatch;

  function openUpgradeDialog() {
    setUpgradeEmail(session?.email ?? '');
    setUpgradePassword('');
    setUpgradeConfirmPassword('');
    setUpgradeDisplayName('');
    setUpgradeWorkspaceName('');
    setUpgradeEmailTouched(false);
    setUpgradePasswordTouched(false);
    setUpgradeConfirmTouched(false);
    setUpgradeWorkspaceNameTouched(false);
    setUpgradeSubmitted(false);
    setUpgradeError(null);
    setUpgradeOpen(true);
  }

  async function onUpgradeSubmit(e: FormEvent) {
    e.preventDefault();
    setUpgradeSubmitted(true);
    setUpgradeError(null);
    if (upgradeFormInvalid) return;

    upgradeMut.mutate(
      {
        data: {
          email: upgradeEmail.trim(),
          password: upgradePassword,
          displayName: upgradeDisplayName.trim() || undefined,
          // DB-17: left blank, the API falls back to the placeholder name so the
          // dashboard's own "name your workspace" prompt (DB-03b) takes over from there.
          workspaceName: upgradeWorkspaceName.trim() || undefined,
        },
      },
      {
        onSuccess: async (res) => {
          try {
            const token = res.token ?? '';
            setItem(TOKEN_KEY, token);
            setAuthHeader(token);
            const meAfter = await getApiAuthMe();
            setItem(USER_KEY, JSON.stringify(meAfter));
            sessionStorage.removeItem(DEMO_SESSION_KEY);
            setUpgradeOpen(false);
            toast(t('demo.upgradeSuccess'));
            window.location.assign(meAfter.isAdmin ? '/overview' : '/profile');
          } catch (err) {
            setUpgradeError(extractMessage(err));
          }
        },
        onError: (err: unknown) => {
          setUpgradeError(extractMessage(err));
        },
      },
    );
  }

  // DB-17: the workspace's own DemoExpiresAt, carried on every /me response for whichever
  // workspace is current — non-null exactly while it's a live demo (null once converted or
  // expired-and-swept). Reading this instead of the sessionStorage snapshot is what makes the
  // banner (and its countdown) survive a reload or a second tab.
  const demoExpiresAt = me?.demoExpiresAt ?? null;

  const refreshCountdown = useCallback(() => {
    if (!demoExpiresAt) {
      setCountdown('');
      return;
    }
    const ms = new Date(demoExpiresAt).getTime() - Date.now();
    setCountdown(formatCountdown(ms));
  }, [demoExpiresAt]);

  useEffect(() => {
    refreshCountdown();
    const id = setInterval(refreshCountdown, 1000);
    return () => clearInterval(id);
  }, [refreshCountdown]);

  if (!demoExpiresAt || dismissed) return null;

  const { projectKey, serverUrl, email, password } = session ?? {
    projectKey: null,
    serverUrl: null,
    email: null,
    password: null,
  };

  const isExpiringSoon = new Date(demoExpiresAt).getTime() - Date.now() < EXPIRING_SOON_MS;

  /**
   * Hides the banner but keeps the session: it holds the demo project key and
   * the widget login, which the install guide still needs. Deleting it here
   * used to throw those credentials away with no way to get them back.
   */
  function dismiss() {
    try {
      sessionStorage.setItem(DEMO_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <div className="border-b border-border bg-gutter px-6 py-3">
      <div className="mx-auto w-full max-w-[1120px]">
        {/* Header row: banner badge + project key + countdown + extend + keep + dismiss */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-medium text-muted-foreground">
            {t('demo.banner')}
          </span>
          {projectKey && (
            <span className="font-mono text-[13px] rounded bg-brand text-brand-foreground px-2 py-0.5">
              {projectKey}
            </span>
          )}
          <span
            className={`font-mono text-[13px] ${isExpiringSoon ? 'text-state-danger' : 'text-muted-foreground'}`}
          >
            {t('demo.expires')} {countdown}
          </span>
          <div className="ms-auto flex items-center gap-2">
            {me?.demoCanExtend && (
              <Button
                variant="secondary"
                size="sm"
                disabled={extendMut.isPending}
                loading={extendMut.isPending}
                onClick={() => extendMut.mutate()}
              >
                {t('demo.extendOnce')}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={openUpgradeDialog}
            >
              {t('demo.keepWorkspace')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={dismiss}
              aria-label={t('demo.dismiss')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Widget login credentials — only present in the tab that ran the demo flow */}
        {session && (
          <div className="text-[13px]">
            <div className="font-medium text-muted-foreground">
              {t('demo.widgetLogin')}
            </div>
            <div className="mt-1">
              <span className="font-medium text-foreground">{email}</span>
              {password ? (
                <>
                  <span className="text-muted-foreground"> · </span>
                  <code className="font-mono text-[13px] rounded bg-background px-1.5 py-0.5 border border-border">{password}</code>
                </>
              ) : (
                <span className="ms-1 text-muted-foreground italic">{t('demo.credsEmailed')}</span>
              )}
            </div>
          </div>
        )}

        {/* The steps themselves live in the shared install guide (also on the
            header icon), so demo and permanent accounts read the same thing. */}
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={installGuide.open}>
            <Rocket className="h-4 w-4" />
            {t('install.open')}
          </Button>
        </div>

        {/* Server URL reference */}
        {serverUrl && (
          <div className="mt-2 text-[12px] text-muted-foreground">
            {serverUrl}
          </div>
        )}
      </div>

      {/* Upgrade dialog */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('demo.upgradeTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('demo.upgradeIntro')}</p>
          <form onSubmit={onUpgradeSubmit} noValidate className="flex flex-col gap-4 pt-1">
            <FormField
              label={t('demo.email')}
              htmlFor="upgrade-email"
              error={upgradeEmailTouched || upgradeSubmitted ? upgradeEmailErrorMsg : undefined}
            >
              <Input
                id="upgrade-email"
                type="email"
                autoComplete="email"
                value={upgradeEmail}
                onChange={(e) => setUpgradeEmail(e.target.value)}
                onBlur={() => setUpgradeEmailTouched(true)}
              />
            </FormField>
            <FormField
              label={t('demo.password')}
              htmlFor="upgrade-password"
              error={upgradePasswordTouched || upgradeSubmitted ? upgradePasswordErrorMsg : undefined}
              hint={t('common.passwordPolicyHint')}
            >
              <PasswordInput
                id="upgrade-password"
                autoComplete="new-password"
                value={upgradePassword}
                onChange={(e) => setUpgradePassword(e.target.value)}
                onBlur={() => setUpgradePasswordTouched(true)}
              />
            </FormField>
            <FormField
              label={t('demo.confirmPassword')}
              htmlFor="upgrade-confirm-password"
              error={upgradeConfirmTouched || upgradeSubmitted ? upgradeConfirmErrorMsg : undefined}
            >
              <PasswordInput
                id="upgrade-confirm-password"
                autoComplete="new-password"
                value={upgradeConfirmPassword}
                onChange={(e) => setUpgradeConfirmPassword(e.target.value)}
                onBlur={() => setUpgradeConfirmTouched(true)}
              />
            </FormField>
            {/* Cross-field mismatch compares both passwords, so it isn't a
                 per-field error and stays OUT of FormField's own error slot —
                 it renders here, below both fields. */}
            {upgradeConfirmTouched || upgradeSubmitted ? (
              upgradePasswordsMismatch && (
                <p className="text-sm text-destructive">{t('demo.passwordMismatch')}</p>
              )
            ) : null}
            <FormField label={t('demo.displayName')} htmlFor="upgrade-display-name">
              <Input
                id="upgrade-display-name"
                value={upgradeDisplayName}
                onChange={(e) => setUpgradeDisplayName(e.target.value)}
              />
            </FormField>
            <FormField
              label={t('demo.workspaceName')}
              htmlFor="upgrade-workspace-name"
              error={
                upgradeWorkspaceNameTouched || upgradeSubmitted
                  ? upgradeWorkspaceNameErrorMsg || undefined
                  : undefined
              }
            >
              <Input
                id="upgrade-workspace-name"
                maxLength={WORKSPACE_NAME_MAX}
                value={upgradeWorkspaceName}
                onChange={(e) => setUpgradeWorkspaceName(e.target.value)}
                onBlur={() => setUpgradeWorkspaceNameTouched(true)}
              />
            </FormField>
            {upgradeError && (
              <p className="text-sm text-destructive">{upgradeError}</p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setUpgradeOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={upgradeMut.isPending || upgradeFormInvalid}>
                {t('demo.upgradeSubmit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
