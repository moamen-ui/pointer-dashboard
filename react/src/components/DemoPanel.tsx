// DemoPanel — shown inside the shell whenever a pointer_demo sessionStorage
// entry exists. Displays project key, four guided copy-pasteable setup steps,
// credentials, and a live countdown to expiry. Dismissible for the current session only.
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

/** Which step's copy button is in the "just copied" state, or null. */
type CopiedStep = 'step1' | 'step2' | 'step3' | 'step4' | null;

export function DemoPanel() {
  const { t } = useTranslation();
  const [session, setSession] = useState<DemoSession | null>(() => readDemoSession());
  const [dismissed, setDismissed] = useState(false);
  const [copiedStep, setCopiedStep] = useState<CopiedStep>(null);
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

  const embedSnippet = `<script src="${serverUrl ?? ''}/pointer.js" defer></script>\n<pointer-feedback project="${projectKey ?? ''}" server="${serverUrl ?? ''}"></pointer-feedback>`;
  const installCmd = `curl -fsSL ${serverUrl ?? ''}/install.sh | sh`;
  const credsBlock = `POINTER_EMAIL=${email ?? ''}\nPOINTER_PASSWORD=${password ?? ''}`;
  // Fixed example prompt — same in every language; do not translate.
  const examplePrompt = 'What are the new Pointer comments?';

  async function copyText(text: string, step: CopiedStep) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStep(step);
      setTimeout(() => setCopiedStep(null), 2000);
    } catch {
      // clipboard not available — silently ignore
    }
  }

  const isExpiringSoon = expiresAt
    ? new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000
    : false;

  return (
    <div className="border-b border-border bg-brand-tint px-4 py-3">
      <div className="mx-auto max-w-5xl">
        {/* Header row: banner badge + project key + countdown + dismiss */}
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
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setDismissed(true)}
            aria-label={t('demo.dismiss')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Three setup steps */}
        <div className="flex flex-col gap-3">
          {/* Step 1 — embed snippet */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold">{t('demo.step1Title')}</span>
            <span className="text-xs text-muted-foreground">{t('demo.step1Hint')}</span>
            <div className="flex items-start gap-2">
              <pre className="m-0 flex-1 overflow-x-auto rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                <code>{embedSnippet}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => copyText(embedSnippet, 'step1')}
                aria-label={t('demo.copy')}
              >
                {copiedStep === 'step1' ? (
                  <Check className="me-1 h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="me-1 h-3.5 w-3.5" />
                )}
                {copiedStep === 'step1' ? t('demo.copied') : t('demo.copy')}
              </Button>
            </div>
          </div>

          {/* Step 2 — install command */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold">{t('demo.step2Title')}</span>
            <span className="text-xs text-muted-foreground">{t('demo.step2Hint')}</span>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                {installCmd}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => copyText(installCmd, 'step2')}
                aria-label={t('demo.copy')}
              >
                {copiedStep === 'step2' ? (
                  <Check className="me-1 h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="me-1 h-3.5 w-3.5" />
                )}
                {copiedStep === 'step2' ? t('demo.copied') : t('demo.copy')}
              </Button>
            </div>
          </div>

          {/* Step 3 — credentials block */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold">{t('demo.step3Title')}</span>
            <span className="text-xs text-muted-foreground">{t('demo.step3Hint')}</span>
            <div className="flex items-start gap-2">
              <pre className="m-0 flex-1 overflow-x-auto rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                <code>{credsBlock}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => copyText(credsBlock, 'step3')}
                aria-label={t('demo.copy')}
              >
                {copiedStep === 'step3' ? (
                  <Check className="me-1 h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="me-1 h-3.5 w-3.5" />
                )}
                {copiedStep === 'step3' ? t('demo.copied') : t('demo.copy')}
              </Button>
            </div>
          </div>

          {/* Step 4 — example prompt for the AI tool */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold">{t('demo.step4Title')}</span>
            <span className="text-xs text-muted-foreground">{t('demo.step4Hint')}</span>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                {examplePrompt}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => copyText(examplePrompt, 'step4')}
                aria-label={t('demo.copy')}
              >
                {copiedStep === 'step4' ? (
                  <Check className="me-1 h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="me-1 h-3.5 w-3.5" />
                )}
                {copiedStep === 'step4' ? t('demo.copied') : t('demo.copy')}
              </Button>
            </div>
          </div>
        </div>

        {/* Widget login credentials (retained for quick reference) */}
        <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{t('demo.widgetLogin')}</span>
          <span>
            <span className="font-medium">{t('demo.email')}:</span> {email}
          </span>
          <span>
            <span className="font-medium">{t('demo.password')}:</span> {password}
          </span>
        </div>
      </div>
    </div>
  );
}
