// DemoPanel — shown inside the shell whenever a pointer_demo sessionStorage
// entry exists. Displays project key, widget login, and a live countdown to
// expiry. The setup steps themselves live in the shared install guide (also
// reachable from the header icon), opened here via a "View installation steps"
// button. Dismissal only hides the banner — the session holds credentials the
// guide still needs.
import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePostApiDemoUpgrade } from '@moamen-ui/pointer-react';
import { getApiAuthMe } from '@moamen-ui/pointer-react';
import { setAuthHeader } from '@/lib/api';
import { setItem, TOKEN_KEY, USER_KEY } from '@/lib/storage';
import { extractMessage } from '@/lib/error';
import { useToast } from '@/components/ui/toast';
import { useInstallGuide } from '@/components/InstallGuide';

const DEMO_SESSION_KEY = 'pointer_demo';
/** Banner-only hide flag — the session itself outlives a dismissal. */
const DEMO_DISMISSED_KEY = 'pointer_demo_dismissed';

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

export function DemoPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const installGuide = useInstallGuide();
  const [session, setSession] = useState<DemoSession | null>(() => readDemoSession());
  const [dismissed, setDismissed] = useState(() => readDismissed());
  const [countdown, setCountdown] = useState<string>('');

  // Upgrade dialog state
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [upgradeConfirmPassword, setUpgradeConfirmPassword] = useState('');
  const [upgradeDisplayName, setUpgradeDisplayName] = useState('');
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const upgradeMut = usePostApiDemoUpgrade();

  function openUpgradeDialog() {
    setUpgradeEmail(session?.email ?? '');
    setUpgradePassword('');
    setUpgradeConfirmPassword('');
    setUpgradeDisplayName('');
    setUpgradeError(null);
    setUpgradeOpen(true);
  }

  function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  async function onUpgradeSubmit(e: FormEvent) {
    e.preventDefault();
    setUpgradeError(null);

    if (!isValidEmail(upgradeEmail)) {
      setUpgradeError(t('demo.email') + ' is required.');
      return;
    }
    if (upgradePassword.length < 8) {
      setUpgradeError(t('demo.password') + ' must be at least 8 characters.');
      return;
    }
    if (upgradePassword !== upgradeConfirmPassword) {
      setUpgradeError(t('demo.passwordMismatch'));
      return;
    }

    upgradeMut.mutate(
      {
        data: {
          email: upgradeEmail.trim(),
          password: upgradePassword,
          displayName: upgradeDisplayName.trim() || undefined,
        },
      },
      {
        onSuccess: async (res) => {
          try {
            const token = res.token ?? '';
            setItem(TOKEN_KEY, token);
            setAuthHeader(token);
            const me = await getApiAuthMe();
            setItem(USER_KEY, JSON.stringify(me));
            sessionStorage.removeItem(DEMO_SESSION_KEY);
            setUpgradeOpen(false);
            toast(t('demo.upgradeSuccess'));
            window.location.assign(me.isAdmin ? '/overview' : '/profile');
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

  const refreshCountdown = useCallback(() => {
    if (!session?.expiresAt) return;
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    setCountdown(formatCountdown(ms));
    if (ms <= 0) {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
      setSession(null);
    }
  }, [session]);

  useEffect(() => {
    refreshCountdown();
    const id = setInterval(refreshCountdown, 1000);
    return () => clearInterval(id);
  }, [refreshCountdown]);

  if (!session || dismissed) return null;

  const { projectKey, serverUrl, email, password, expiresAt } = session;

  const isExpiringSoon = expiresAt
    ? new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000
    : false;

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
    <div className="border-b border-border bg-brand-tint px-4 py-3">
      <div className="mx-auto max-w-5xl">
        {/* Header row: banner badge + project key + countdown + keep + dismiss */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand">
            {t('demo.banner')}
          </span>
          <span className="rounded bg-brand px-1.5 py-0.5 text-xs font-mono text-white">
            {projectKey}
          </span>
          {expiresAt && (
            <span
              className={`ms-auto text-xs font-mono ${isExpiringSoon ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {t('demo.expires')} {countdown}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-6 shrink-0 text-xs"
            onClick={openUpgradeDialog}
          >
            {t('demo.keepWorkspace')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={dismiss}
            aria-label={t('demo.dismiss')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Widget login credentials */}
        <div className="mb-3 grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-[0.75rem] font-semibold uppercase text-muted-foreground">
              {t('demo.widgetLogin')}
            </div>
            <div className="mt-1 text-xs">
              <span className="font-medium">{email}</span>
              {password ? (
                <>
                  <span className="text-muted-foreground"> · </span>
                  <code className="rounded bg-background px-1.5 py-0.5 border border-border">{password}</code>
                </>
              ) : (
                <span className="ms-1 text-muted-foreground italic">{t('demo.credsEmailed')}</span>
              )}
            </div>
          </div>
        </div>

        {/* The steps themselves live in the shared install guide (also on the
            header icon), so demo and permanent accounts read the same thing. */}
        <div className="mb-3">
          <Button variant="outline" size="sm" onClick={installGuide.open}>
            <Rocket className="h-3.5 w-3.5" />
            {t('install.open')}
          </Button>
        </div>

        {/* Server URL reference */}
        {serverUrl && (
          <div className="mt-2 text-[0.7rem] text-muted-foreground">
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
          <form onSubmit={onUpgradeSubmit} className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="upgrade-email">{t('demo.email')}</Label>
              <Input
                id="upgrade-email"
                type="email"
                autoComplete="email"
                value={upgradeEmail}
                onChange={(e) => setUpgradeEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="upgrade-password">{t('demo.password')}</Label>
              <PasswordInput
                id="upgrade-password"
                autoComplete="new-password"
                value={upgradePassword}
                onChange={(e) => setUpgradePassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="upgrade-confirm-password">{t('demo.confirmPassword')}</Label>
              <PasswordInput
                id="upgrade-confirm-password"
                autoComplete="new-password"
                value={upgradeConfirmPassword}
                onChange={(e) => setUpgradeConfirmPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="upgrade-display-name">{t('demo.displayName')}</Label>
              <Input
                id="upgrade-display-name"
                value={upgradeDisplayName}
                onChange={(e) => setUpgradeDisplayName(e.target.value)}
              />
            </div>
            {upgradeError && (
              <p className="text-sm text-destructive">{upgradeError}</p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setUpgradeOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={upgradeMut.isPending}>
                {t('demo.upgradeSubmit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
