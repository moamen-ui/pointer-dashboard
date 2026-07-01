import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useGetApiAuthSignupEnabled,
  usePostApiDemo,
  getApiAuthMe,
  type DemoSessionResponse,
} from '@moamen-ui/pointer-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { setAuthHeader } from '@/lib/api';
import { setItem, TOKEN_KEY, USER_KEY } from '@/lib/storage';
import { extractMessage } from '@/lib/error';
import { useToast } from '@/components/ui/toast';

const DEMO_SESSION_KEY = 'pointer_demo';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const locationState = location.state as { message?: string } | null;
  const { login, isAuthenticated, isAdmin } = useAuth();
  const { data: signupData } = useGetApiAuthSignupEnabled();
  const signupEnabled = signupData?.enabled === true;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoEmail, setDemoEmail] = useState('');
  const [demoEmailError, setDemoEmailError] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  const demoMut = usePostApiDemo();

  // Already authenticated? Bounce to the appropriate landing page.
  if (isAuthenticated) {
    navigate(isAdmin ? '/overview' : '/profile', { replace: true });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
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
          setItem(TOKEN_KEY, '');
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
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-[380px] max-w-[92vw]">
        <CardContent className="flex flex-col gap-5 p-6">
          <h1 className="text-center text-xl font-bold">{t('login.title')}</h1>
          {locationState?.message && (
            <p className="text-center text-sm text-green-600">{locationState.message}</p>
          )}
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="mt-1" disabled={loading || !email || !password}>
              {t('login.signIn')}
            </Button>
            {signupEnabled && (
              <Link
                to="/signup"
                className="text-center text-sm text-muted-foreground hover:underline"
              >
                {t('login.createAccount')}
              </Link>
            )}
            <Link
              to="/forgot"
              className="text-center text-sm text-muted-foreground hover:underline"
            >
              {t('login.forgot')}
            </Link>
          </form>

          <div className="relative flex items-center gap-2">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground">{t('login.or')}</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="demo-email">{t('login.demoEmailLabel')}</Label>
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
              <p className="text-sm text-destructive">{t('login.demoEmailLabel')} is required.</p>
            )}
          </div>
          {demoError && <p className="text-sm text-destructive">{demoError}</p>}
          <Button
            variant="outline"
            onClick={onTryDemo}
            disabled={demoMut.isPending}
          >
            {demoMut.isPending ? t('login.demoLoading') : t('login.tryDemo')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
