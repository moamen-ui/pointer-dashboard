// ForgotPasswordPage — collects an email and calls POST /api/auth/forgot-password.
// Always shows the same neutral confirmation to avoid email enumeration.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePostApiAuthForgotPassword } from '@moamen-ui/pointer-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/FormField';
import { emailError } from '@/lib/validators';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);

  const forgotMut = usePostApiAuthForgotPassword();

  const emailErrorMsg = emailError(email, t);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (emailErrorMsg) return;
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
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
              <FormField
                label={t('login.email')}
                htmlFor="forgot-email"
                error={emailTouched || submitted ? emailErrorMsg : undefined}
              >
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  autoFocus
                />
              </FormField>
              <Button
                type="submit"
                className="mt-1"
                disabled={forgotMut.isPending || !!emailErrorMsg}
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
