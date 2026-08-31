// ResetPasswordPage — reads ?token= from the URL, collects a new password,
// and calls POST /api/auth/reset-password. On success redirects to /login with
// a state message; on error shows the API message.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePostApiAuthResetPassword } from '@moamen-ui/pointer-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/shared/FormField';
import { passwordError, requiredError } from '@/lib/validators';
import { extractMessage } from '@/lib/error';

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const resetMut = usePostApiAuthResetPassword();

  const newPasswordErrorMsg = passwordError(newPassword, MIN_PASSWORD_LENGTH, t);
  const confirmPasswordErrorMsg = requiredError(confirmPassword, t);
  // Cross-field check — like the Angular form's group validator, it compares
  // both values and is not a per-field error.
  const passwordsMismatch = newPassword !== confirmPassword;
  const formInvalid =
    !!newPasswordErrorMsg || !!confirmPasswordErrorMsg || passwordsMismatch;

  // If no token in URL, show invalid link message immediately.
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Card className="w-[380px] max-w-[92vw]">
          <CardContent className="flex flex-col gap-5 p-6">
            <h1 className="text-center text-xl font-bold">{t('auth.resetTitle')}</h1>
            <p className="text-center text-sm text-destructive">{t('auth.resetInvalid')}</p>
            <Link to="/login" className="text-center text-sm text-brand hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setApiError(null);
    if (formInvalid) return;

    resetMut.mutate(
      { data: { token, newPassword } },
      {
        onSuccess: () => {
          navigate('/login', {
            replace: true,
            state: { message: t('auth.resetDone') },
          });
        },
        onError: (err: unknown) => {
          setApiError(extractMessage(err));
        },
      },
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-[380px] max-w-[92vw]">
        <CardContent className="flex flex-col gap-5 p-6">
          <h1 className="text-center text-xl font-bold">{t('auth.resetTitle')}</h1>

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <FormField
              label={t('auth.newPassword')}
              htmlFor="new-password"
              error={newPasswordTouched || submitted ? newPasswordErrorMsg : undefined}
            >
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onBlur={() => setNewPasswordTouched(true)}
                autoFocus
              />
            </FormField>
            <FormField
              label={t('auth.confirmPassword')}
              htmlFor="confirm-password"
              error={confirmPasswordTouched || submitted ? confirmPasswordErrorMsg : undefined}
            >
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setConfirmPasswordTouched(true)}
              />
            </FormField>
            {/* Cross-field mismatch compares both passwords, so it isn't a
                 per-field error and stays OUT of FormField's own error slot —
                 it renders here, below both fields. */}
            {confirmPasswordTouched || submitted ? (
              passwordsMismatch && (
                <p className="text-sm text-destructive">{t('auth.passwordMismatch')}</p>
              )
            ) : null}
            {apiError && <p className="text-sm text-destructive">{apiError}</p>}
            <Button
              type="submit"
              className="mt-1"
              disabled={resetMut.isPending || formInvalid}
            >
              {t('auth.resetSubmit')}
            </Button>
            <Link to="/login" className="text-center text-sm text-muted-foreground hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
