// ForgotPasswordPage — collects an email and calls POST /api/auth/forgot-password.
// Always shows the same neutral confirmation to avoid email enumeration.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePostApiAuthForgotPassword } from '@moamen-ui/pointer-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  const forgotMut = usePostApiAuthForgotPassword();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    forgotMut.mutate(
      { data: { email: email.trim() } },
      {
        onSuccess: () => setDone(true),
        // Always show the same confirmation on success OR error to avoid leaking
        // whether the address is registered.
        onError: () => setDone(true),
      },
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-[380px] max-w-[92vw]">
        <CardContent className="flex flex-col gap-5 p-6">
          <h1 className="text-center text-xl font-bold">{t('auth.forgotTitle')}</h1>

          {done ? (
            <>
              <p className="text-center text-sm text-muted-foreground">{t('auth.forgotSent')}</p>
              <Link to="/login" className="text-center text-sm text-brand hover:underline">
                {t('auth.backToLogin')}
              </Link>
            </>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="forgot-email">{t('login.email')}</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="mt-1"
                disabled={forgotMut.isPending || !email.trim()}
              >
                {t('auth.forgotSubmit')}
              </Button>
              <Link to="/login" className="text-center text-sm text-muted-foreground hover:underline">
                {t('auth.backToLogin')}
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
