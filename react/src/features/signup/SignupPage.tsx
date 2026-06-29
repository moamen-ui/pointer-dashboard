// Public self-signup page — shown only when scopedAdminSignupEnabled is true.
// Posts to /api/auth/register-admin; on success shows a "pending approval" message.
// Disabled state → "signup closed" notice.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useGetApiAuthSignupEnabled,
  usePostApiAuthRegisterAdmin,
} from '@moamen-ui/pointer-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractMessage } from '@/lib/error';

export function SignupPage() {
  const { t } = useTranslation();

  // The signup-enabled endpoint returns a 200 (with possibly empty body) when
  // enabled, and a 4xx or a specific body when disabled. We treat any successful
  // fetch as "enabled" and any error as "disabled".
  const { isSuccess: signupEnabled, isLoading: checkingEnabled } =
    useGetApiAuthSignupEnabled();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerMut = usePostApiAuthRegisterAdmin({
    mutation: {
      onSuccess: () => {
        setDone(true);
      },
      onError: (e: unknown) => {
        setError(extractMessage(e));
      },
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setError(null);
    registerMut.mutate({
      data: {
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      },
    });
  }

  if (checkingEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <p className="text-sm text-muted-foreground">{t('signup.checking')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-[380px] max-w-[92vw]">
        <CardContent className="flex flex-col gap-5 p-6">
          <h1 className="text-center text-xl font-bold">{t('signup.title')}</h1>

          {!signupEnabled ? (
            <>
              <p className="text-center text-sm text-muted-foreground">{t('signup.closed')}</p>
              <Link to="/login" className="text-center text-sm text-brand hover:underline">
                {t('signup.backToLogin')}
              </Link>
            </>
          ) : done ? (
            <>
              <p className="text-center text-sm text-muted-foreground">
                {t('signup.pending')}
              </p>
              <Link to="/login" className="text-center text-sm text-brand hover:underline">
                {t('signup.backToLogin')}
              </Link>
            </>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-name">{t('signup.displayName')}</Label>
                <Input
                  id="signup-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-email">{t('signup.email')}</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="signup-password">{t('signup.password')}</Label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                className="mt-1"
                disabled={registerMut.isPending || !email || !password}
              >
                {t('signup.submit')}
              </Button>
              <Link to="/login" className="text-center text-sm text-muted-foreground hover:underline">
                {t('signup.backToLogin')}
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
