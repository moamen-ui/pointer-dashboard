// DemoPanel — shown inside the shell whenever a pointer_demo sessionStorage
// entry exists. Displays project key, widget login, a live countdown to expiry,
// and a 6-step data-driven setup guide shown one step at a time (Back / Next slider).
// Dismissible for the current session only.
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEMO_SESSION_KEY = 'pointer_demo';

interface DemoSession {
  email: string | null;
  password: string | null;
  projectKey: string | null;
  serverUrl: string | null;
  expiresAt: string | undefined;
}

/** One setup step in the guide slider. `code` is optional — instruction-only steps omit it. */
interface SetupStep {
  titleKey: string;
  hintKey: string;
  code?: string;
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

function buildSteps(session: DemoSession): SetupStep[] {
  const srv = session.serverUrl ?? '';
  const proj = session.projectKey ?? '';
  const email = session.email ?? '';
  const password = session.password ?? '';
  return [
    {
      titleKey: 'demo.step1Title',
      hintKey: 'demo.step1Hint',
      code: `<script src="${srv}/pointer.js" defer></script>`,
    },
    {
      titleKey: 'demo.step2Title',
      hintKey: 'demo.step2Hint',
      code: `<pointer-feedback project="${proj}" server="${srv}"></pointer-feedback>`,
    },
    {
      titleKey: 'demo.step3Title',
      hintKey: 'demo.step3Hint',
      code: `curl -fsSL ${srv}/install.sh | sh`,
    },
    {
      titleKey: 'demo.step4Title',
      hintKey: 'demo.step4Hint',
      code: `POINTER_EMAIL=${email}\nPOINTER_PASSWORD=${password}`,
    },
    {
      titleKey: 'demo.step5Title',
      hintKey: 'demo.step5Hint',
      // no code — instruction-only step
    },
    {
      titleKey: 'demo.step6Title',
      hintKey: 'demo.step6Hint',
      // Fixed English literal — do NOT translate.
      code: 'What are the new Pointer comments?',
    },
  ];
}

export function DemoPanel() {
  const { t } = useTranslation();
  const [session, setSession] = useState<DemoSession | null>(() => readDemoSession());
  const [dismissed, setDismissed] = useState(false);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [step, setStep] = useState(1);

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

  const steps = buildSteps(session);
  const currentStep = steps[step - 1];

  async function copyText(text: string, stepIndex: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStep(stepIndex);
      setTimeout(() => setCopiedStep(null), 2000);
    } catch {
      // clipboard not available — silently ignore
    }
  }

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

        {/* Widget login credentials */}
        <div className="mb-3 grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-[0.75rem] font-semibold uppercase text-muted-foreground">
              {t('demo.widgetLogin')}
            </div>
            <div className="mt-1 text-xs">
              <span className="font-medium">{email}</span>
              <span className="text-muted-foreground"> · </span>
              <code className="rounded bg-background px-1.5 py-0.5 border border-border">{password}</code>
            </div>
          </div>
        </div>

        {/* Setup guide slider */}
        <div className="rounded-lg border border-border bg-background/40 p-3">
          {/* Current step content */}
          <div className="mb-3">
            <div className="text-xs font-semibold">{t(currentStep.titleKey)}</div>
            <div className="text-xs text-muted-foreground">{t(currentStep.hintKey)}</div>
            {currentStep.code !== undefined && (
              <div className="mt-1 flex items-start gap-2">
                <pre className="m-0 flex-1 overflow-x-auto rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                  <code>{currentStep.code}</code>
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => copyText(currentStep.code!, step)}
                  aria-label={t('demo.copy')}
                >
                  {copiedStep === step ? (
                    <Check className="me-1 h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="me-1 h-3.5 w-3.5" />
                  )}
                  {copiedStep === step ? t('demo.copied') : t('demo.copy')}
                </Button>
              </div>
            )}
          </div>

          {/* Navigation row: Back · counter · Next */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              aria-label={t('demo.back')}
            >
              <ChevronLeft className="me-1 h-3.5 w-3.5" />
              {t('demo.back')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {step} / {steps.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ms-auto"
              onClick={() => setStep((s) => Math.min(steps.length, s + 1))}
              disabled={step === steps.length}
              aria-label={t('demo.next')}
            >
              {t('demo.next')}
              <ChevronRight className="ms-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Server URL reference */}
        {serverUrl && (
          <div className="mt-2 text-[0.7rem] text-muted-foreground">
            {serverUrl}
          </div>
        )}
      </div>
    </div>
  );
}
