// DemoPanel — shown inside the shell whenever a pointer_demo sessionStorage
// entry exists. Displays project key, copy-paste snippet, credentials, and a
// live countdown to expiry. Dismissible for the current session only.
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEMO_SESSION_KEY = 'pointer_demo';

interface DemoSession {
  email: string | null;
  password: string | null;
  projectKey: string | null;
  serverUrl: string | null;
  expiresAt: string | undefined;
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
  const [session, setSession] = useState<DemoSession | null>(() => readDemoSession());
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<string>('');

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
  const snippet = `<pointer-feedback project="${projectKey ?? ''}" server="${serverUrl ?? ''}"></pointer-feedback>`;

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — silently ignore
    }
  }

  const isExpiringSoon = expiresAt
    ? new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000
    : false;

  return (
    <div className="border-b border-border bg-brand-tint px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
        {/* Left: project key + snippet */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
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
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
            <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs">
              {snippet}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={copySnippet}
              aria-label={t('demo.copy')}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Right: credentials */}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:min-w-[180px]">
          <span className="font-semibold text-foreground">{t('demo.widgetLogin')}</span>
          <span>
            <span className="font-medium">{t('demo.email')}:</span> {email}
          </span>
          <span>
            <span className="font-medium">{t('demo.password')}:</span> {password}
          </span>
        </div>

        {/* Dismiss */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 self-start"
          onClick={() => setDismissed(true)}
          aria-label={t('demo.dismiss')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
