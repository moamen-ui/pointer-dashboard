import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
  usePostApiDemo,
  getApiAuthMe,
  type DemoSessionResponse,
  type WorkspaceChoice,
} from '@moamen-ui/pointer-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/shared/FormField';
import { emailError, requiredError } from '@/lib/validators';
import { useAuth } from '@/lib/auth';
import { setAuthHeader } from '@/lib/api';
import { removeItem, setItem, TOKEN_KEY, USER_KEY } from '@/lib/storage';
import { extractMessage } from '@/lib/error';
import { isPlaceholderWorkspaceName } from '@/lib/workspace';
import { useBranding } from '@/lib/branding';
import { useToast } from '@/components/ui/toast';
import { AuthLayout } from '@/components/AuthLayout';
import { getSafeNextPath } from '@/lib/next-path';
import { RegisterWorkspaceForm } from '@/features/signup/RegisterWorkspaceForm';

// DB-17: the demo form's PDPL notice links to the privacy policy served on the LANDING
// domain (`landing/privacy.html`), not this dashboard app. Falls back to the API's own
// default landing URL (`BrandingDefaults.UrlLanding`) until `useBranding()`'s fetch resolves.
const DEFAULT_LANDING_URL = 'https://pointer.moamen.work';

/** DB-11b: the login response's "choose several workspaces" state, held in local state
 * between the password step and the pick. `selectionToken` is the 5-minute token the API
 * issues for exactly this purpose — never stored, only ever handed back to
 * `switchWorkspace` for the one follow-up call. */
interface WorkspaceChoiceState {
  workspaces: WorkspaceChoice[];
  selectionToken: string;
}

const DEMO_SESSION_KEY = 'pointer_demo';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const locationState = location.state as { message?: string } | null;
  const { login, switchWorkspace, completeMfaLogin, isAuthenticated, isAdmin } = useAuth();
  const { branding } = useBranding();
  const privacyUrl = `${branding?.urls.landing || DEFAULT_LANDING_URL}/privacy.html`;
  // `?next=` set by AuthenticatedRoute when it bounced a signed-out visitor here
  // (e.g. /cli-login?code=…) — only a same-origin relative path is honoured.
  const next = getSafeNextPath(searchParams.get('next'));
  // #213: the demo section is opt-in only — the landing page's "Try the demo" button links
  // here with `?demo=1`. Without it, the default entry below the sign-in form is the
  // register-new-workspace form (self-signup), not the demo.
  const demoRequested = searchParams.get('demo') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoEmail, setDemoEmail] = useState('');
  const [demoEmailError, setDemoEmailError] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  // DB-11b: several active memberships → the password step resolves to a workspace
  // choice instead of a session. `pickingId` tracks which row is mid-switch so only that
  // row shows its own spinner while every row is disabled.
  const [choice, setChoice] = useState<WorkspaceChoiceState | null>(null);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  // R5-61: password verified, but the identity is a super admin with TOTP enabled — one
  // more step before a session exists. `mfaPendingToken` is the 5-minute scoped token from
  // that outcome; never persisted, only ever handed to `completeMfaLogin`.
  const [mfaPendingToken, setMfaPendingToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSubmitting, setMfaSubmitting] = useState(false);

  const demoMut = usePostApiDemo();

  // Validation state mirrors the Angular form: errors render once a field is
  // touched (or the form was submitted), while button-disabled uses the raw
  // validity so an invalid form can never be submitted.
  const emailErrorMsg = emailError(email, t);
  const passwordErrorMsg = requiredError(password, t);
  const formInvalid = !!emailErrorMsg || !!passwordErrorMsg;

  // Already authenticated? Bounce to the appropriate landing page. Use <Navigate> (a render
  // result) rather than calling navigate() during render, which triggers React's
  // "cannot update a component while rendering" warning and can double-fire.
  if (isAuthenticated) {
    return <Navigate to={next ?? (isAdmin ? '/overview' : '/profile')} replace />;
  }

  // DB-11b: password auth succeeded but the account has several active memberships —
  // render the picker instead of the credentials form until one is chosen.
  if (choice) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold">{t('login.title')}</h1>
            <p className="text-[13px] text-muted-foreground">{t('login.chooseWorkspace')}</p>
          </div>

          {pickError && <p className="text-[14px] text-state-danger">{pickError}</p>}

          <p className="sr-only" aria-live="polite">
            {pickingId ? t('login.switching') : ''}
          </p>

          <div
            role="group"
            aria-label={t('login.chooseWorkspace')}
            aria-busy={pickingId !== null}
            className="flex flex-col gap-2"
          >
            {choice.workspaces.map((w) => {
              const name = isPlaceholderWorkspaceName(w.name)
                ? t('login.unnamedWorkspace')
                : w.name;
              return (
                <Button
                  key={w.workspaceId}
                  type="button"
                  variant="outline"
                  disabled={pickingId !== null}
                  loading={pickingId === w.workspaceId}
                  onClick={() => onPickWorkspace(w.workspaceId)}
                  className="h-auto w-full justify-between gap-3 px-3 py-2 text-start font-normal"
                >
                  <span className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="truncate text-[14px] font-medium text-foreground">
                      {name}
                    </span>
                    {w.roleName && (
                      <span className="truncate text-[12px] text-muted-foreground">
                        {w.roleName}
                      </span>
                    )}
                  </span>
                  {w.isHome && (
                    <Badge variant="neutral" hideGlyph className="shrink-0">
                      {t('login.homeBadge')}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      </AuthLayout>
    );
  }

  // R5-61: password verified, awaiting the operator's TOTP or recovery code.
  if (mfaPendingToken) {
    return (
      <AuthLayout>
        <form onSubmit={onSubmitMfa} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold">{t('login.title')}</h1>
            <p className="text-[13px] text-muted-foreground">
              {useRecoveryCode ? t('mfa.recoveryCodeHint') : t('mfa.enterCodeHint')}
            </p>
          </div>

          {mfaError && <p className="text-[14px] text-state-danger">{mfaError}</p>}

          <FormField
            label={useRecoveryCode ? t('mfa.recoveryCodeLabel') : t('mfa.codeLabel')}
            htmlFor="mfa-login-code"
          >
            <Input
              id="mfa-login-code"
              inputMode={useRecoveryCode ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              maxLength={useRecoveryCode ? 32 : 6}
              autoFocus
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
            />
          </FormField>

          <Button
            type="submit"
            variant="default"
            disabled={mfaSubmitting || !mfaCode.trim()}
            loading={mfaSubmitting}
            className="w-full"
          >
            {t('mfa.verify')}
          </Button>

          <button
            type="button"
            onClick={() => {
              setUseRecoveryCode((v) => !v);
              setMfaCode('');
              setMfaError(null);
            }}
            className="text-center text-[13px] text-muted-foreground hover:text-foreground"
          >
            {useRecoveryCode ? t('mfa.useCodeInstead') : t('mfa.useRecoveryCodeInstead')}
          </button>

          <button
            type="button"
            onClick={resetToPasswordStep}
            className="text-center text-[13px] text-muted-foreground hover:text-foreground"
          >
            {t('mfa.backToPassword')}
          </button>
        </form>
      </AuthLayout>
    );
  }

  function resetToPasswordStep() {
    setMfaPendingToken(null);
    setMfaCode('');
    setMfaError(null);
    setUseRecoveryCode(false);
  }

  async function onSubmitMfa(e: FormEvent) {
    e.preventDefault();
    if (!mfaCode.trim() || !mfaPendingToken) return;
    setMfaSubmitting(true);
    setMfaError(null);
    try {
      const user = await completeMfaLogin(mfaPendingToken, mfaCode.trim());
      navigate(next ?? (user?.isAdmin ? '/overview' : '/profile'), { replace: true });
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        // The 5-minute pending token expired (or was otherwise rejected) — there is no
        // session to retry into, only back to the password step.
        resetToPasswordStep();
        setError(t('mfa.pendingExpired'));
      } else {
        setMfaError(extractMessage(err) || t('mfa.invalidCode'));
      }
    } finally {
      setMfaSubmitting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (formInvalid) return;
    setLoading(true);
    setError(null);
    try {
      const outcome = await login(email, password);
      if (outcome.status === 'choose-workspace') {
        // `no-workspace` never reaches here — it (like pending/rejected/disabled) is an
        // envelope failure the API returns with isSuccess=false, so it lands in the catch
        // below with the server's message, unchanged from before this feature.
        setChoice({ workspaces: outcome.workspaces, selectionToken: outcome.selectionToken });
        return;
      }
      if (outcome.status === 'mfa_required') {
        setMfaPendingToken(outcome.pendingToken);
        return;
      }
      // `next` (e.g. back to /cli-login?code=…) wins over the role-based default
      // (admin → overview, non-admin → profile).
      navigate(next ?? (outcome.user?.isAdmin ? '/overview' : '/profile'), { replace: true });
    } catch (err) {
      setError(extractMessage(err) || t('login.failed'));
    } finally {
      setLoading(false);
    }
  }

  async function onPickWorkspace(workspaceId: string | undefined) {
    if (!workspaceId || !choice || pickingId) return;
    setPickingId(workspaceId);
    setPickError(null);
    try {
      const user = await switchWorkspace(workspaceId, choice.selectionToken);
      navigate(next ?? (user?.isAdmin ? '/overview' : '/profile'), { replace: true });
    } catch (err) {
      setPickError(extractMessage(err) || t('login.failed'));
      setPickingId(null);
    }
  }

  function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  async function onTryDemo() {
    setDemoEmailError(null);
    setDemoError(null);

    if (!demoEmail.trim()) {
      setDemoEmailError(t('common.fieldRequired'));
      return;
    }
    if (!isValidEmail(demoEmail)) {
      setDemoEmailError(t('common.invalidEmail'));
      return;
    }

    demoMut.mutate({ data: { email: demoEmail.trim() } }, {
      onSuccess: async (rawSession) => {
        // The mutator unwraps the Result<T> envelope at runtime, so the actual
        // value is DemoSessionResponse despite the generated TS type saying
        // DemoSessionResponseResult. Cast accordingly.
        const demoSession = rawSession as unknown as DemoSessionResponse;
        try {
          const token = demoSession.token ?? '';
          // Store token + set auth header so the subsequent getApiAuthMe call is
          // authenticated — this mirrors what auth.tsx does inside login().
          setItem(TOKEN_KEY, token);
          setAuthHeader(token);

          // Fetch the current user with the new token.
          const me = await getApiAuthMe();

          // Write user to localStorage so AuthProvider re-reads on mount.
          setItem(USER_KEY, JSON.stringify(me));

          // Stash demo session details for the DemoPanel.
          sessionStorage.setItem(
            DEMO_SESSION_KEY,
            JSON.stringify({
              email: demoSession.email,
              password: demoSession.password,
              projectKey: demoSession.projectKey,
              serverUrl: demoSession.serverUrl,
              expiresAt: demoSession.expiresAt,
              emailSent: demoSession.emailSent,
            }),
          );

          if (demoSession.emailSent) {
            toast(t('login.demoEmailSent'));
          }

          // Hard-navigate so AuthProvider reinitialises from localStorage.
          window.location.assign(me.isAdmin ? '/overview' : '/profile');
        } catch (err) {
          setDemoError(extractMessage(err) || t('login.demoFailed'));
          // Cleanup on failure.
          removeItem(TOKEN_KEY);
          setAuthHeader(null);
          sessionStorage.removeItem(DEMO_SESSION_KEY);
        }
      },
      onError: (err: unknown) => {
        setDemoError(extractMessage(err) || t('login.demoFailed'));
      },
    });
  }

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {locationState?.message && (
          <p className="text-[14px] text-state-completed">{locationState.message}</p>
        )}

        <FormField
          label={t('login.email')}
          htmlFor="email"
          error={emailTouched || submitted ? emailErrorMsg : undefined}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
          />
        </FormField>

        <FormField
          label={t('login.password')}
          htmlFor="password"
          error={passwordTouched || submitted ? passwordErrorMsg : undefined}
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setPasswordTouched(true)}
          />
        </FormField>

        {error && <p className="text-[14px] text-state-danger">{error}</p>}

        {/* Primary Sign in button, full width */}
        <Button
          type="submit"
          variant="default"
          disabled={loading || formInvalid}
          loading={loading}
          className="w-full"
        >
          {t('login.signIn')}
        </Button>

        {/* Forgot password link — centered, 13px muted */}
        <Link
          to="/forgot"
          className="text-center text-[13px] text-muted-foreground hover:text-foreground"
        >
          {t('login.forgot')}
        </Link>
      </form>

      {/* Hairline divider with "or" */}
      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-border" />
        <span className="text-[12px] text-muted-foreground">{t('login.or')}</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* #213: default entry is the register-new-workspace (self-signup) form; the demo
          section only renders behind `?demo=1`, added by the landing page's demo button. */}
      {demoRequested ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-muted-foreground">{t('login.demoHint')}</p>

          <FormField
            label={t('login.demoEmailLabel')}
            htmlFor="demo-email"
            error={demoEmailError || undefined}
          >
            <Input
              id="demo-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={demoEmail}
              onChange={(e) => {
                setDemoEmail(e.target.value);
                setDemoEmailError(null);
              }}
            />
          </FormField>

          {/* DB-17 PDPL notice — the demo address is used only to deliver the login/reminder
              and is deleted with the workspace after 24h unless kept; links to the landing
              domain's privacy policy (never this app's own — the landing app owns that page). */}
          <p className="text-[12px] text-muted-foreground">
            <Trans
              i18nKey="login.demoPdplNotice"
              components={{
                privacyLink: (
                  <a
                    href={privacyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline"
                  />
                ),
              }}
            />
          </p>

          {demoError && <p className="text-[14px] text-state-danger">{demoError}</p>}

          {/* Secondary "Try the demo" button */}
          <Button
            variant="secondary"
            onClick={onTryDemo}
            disabled={demoMut.isPending}
            loading={demoMut.isPending}
            className="w-full"
          >
            {t('login.tryDemo')}
          </Button>
        </div>
      ) : (
        <RegisterWorkspaceForm embedded />
      )}

      {/* Hairline divider */}
      <div className="border-t border-border" />

      {/* "Need an account? Request access" line — 13px muted + brand link */}
      <div className="text-center text-[13px]">
        <span className="text-muted-foreground">{t('login.signupPrompt')} </span>
        <Link to="/signup" className="text-brand hover:underline">
          {t('login.signupLink')}
        </Link>
      </div>
    </AuthLayout>
  );
}
