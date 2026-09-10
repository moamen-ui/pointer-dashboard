import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  usePostApiDemo,
  getApiAuthMe,
  type DemoSessionResponse,
} from '@moamen-ui/pointer-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/shared/FormField';
import { emailError, requiredError } from '@/lib/validators';
import { useAuth } from '@/lib/auth';
import { setAuthHeader } from '@/lib/api';
import { removeItem, setItem, TOKEN_KEY, USER_KEY } from '@/lib/storage';
import { extractMessage } from '@/lib/error';
import { useToast } from '@/components/ui/toast';
import { AuthLayout } from '@/components/AuthLayout';

const DEMO_SESSION_KEY = 'pointer_demo';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const locationState = location.state as { message?: string } | null;
  const { login, isAuthenticated, isAdmin } = useAuth();

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
    return <Navigate to={isAdmin ? '/overview' : '/profile'} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (formInvalid) return;
    setLoading(true);
    setError(null);
    try {
      const user = await login(email, password);
      // Role-based redirect: admin → overview, non-admin → profile.
      if (user?.isAdmin) {
        navigate('/overview', { replace: true });
      } else {
        navigate('/profile', { replace: true });
      }
    } catch (err) {
      setError(extractMessage(err) || t('login.failed'));
    } finally {
      setLoading(false);
    }
  }

  function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  async function onTryDemo() {
    setDemoEmailError(null);
    setDemoError(null);

    if (!demoEmail.trim() || !isValidEmail(demoEmail)) {
      setDemoEmailError(t('login.demoEmailLabel'));
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

      {/* Demo email input */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="demo-email" className="text-[14px]">
          {t('login.demoEmailLabel')}
        </Label>
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
        {demoEmailError && (
          <p className="text-[12px] text-state-danger">{t('login.demoEmailLabel')} is required.</p>
        )}
      </div>

      {demoError && <p className="text-[14px] text-state-danger">{demoError}</p>}

      {/* Secondary "Try the demo" button */}
      <Button
        variant="secondary"
        onClick={onTryDemo}
        disabled={demoMut.isPending}
        className="w-full"
      >
        {demoMut.isPending ? t('login.demoLoading') : t('login.tryDemo')}
      </Button>

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
