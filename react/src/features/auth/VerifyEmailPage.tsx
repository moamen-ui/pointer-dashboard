// VerifyEmailPage — DB-14 §11.3: anonymous route landed on from the e-mailed verification link
// (`{app}/verify-email?token=…`, EmailVerificationService.SendAsync). Reads ?token= from the URL
// and, on one confirm click, calls POST /api/auth/verify-email. No session is required — the
// token is the credential, exactly like /reset and /confirm-email. The button-click (never
// on-mount) requirement matters here specifically: a mail client's link pre-fetch/scanner must
// not consume the single-use token before the person ever opens the mail.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { usePostApiAuthVerifyEmail, getGetApiAuthMeQueryKey } from '@moamen-ui/pointer-react';
import { Button } from '@/components/ui/button';
import { extractMessage } from '@/lib/error';
import { useAuth } from '@/lib/auth';
import { AuthLayout } from '@/components/AuthLayout';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();

  const [done, setDone] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const verifyMut = usePostApiAuthVerifyEmail();

  if (!token) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-5">
          <h1 className="text-center text-xl font-bold">{t('auth.verifyEmailTitle')}</h1>
          <p className="text-center text-sm text-destructive">{t('auth.verifyEmailInvalid')}</p>
          <Link to="/login" className="text-center text-sm text-brand hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  function onVerify() {
    setApiError(null);
    verifyMut.mutate(
      { data: { token } },
      {
        // Same shape as ConfirmEmailPage: the generated client unwraps the success envelope
        // down to `data.data`, which is undefined for a bare `Result` — so we show our own
        // copy on success rather than a value we no longer have access to. A 400 (invalid/
        // expired token) never reaches this branch — the real server message is in onError.
        onSuccess: () => {
          setDone(true);
          // A person can click the link while still signed in (e.g. verifying right after
          // registering in the same tab) — refresh the cached `me` so the banner/gate drop
          // immediately instead of waiting for the next 60s cache window server-side.
          if (isAuthenticated) {
            void qc.invalidateQueries({ queryKey: getGetApiAuthMeQueryKey() });
          }
        },
        onError: (err: unknown) => setApiError(extractMessage(err)),
      },
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-5">
        <h1 className="text-center text-xl font-bold">{t('auth.verifyEmailTitle')}</h1>

        {done ? (
          <div className="flex flex-col gap-4">
            <p className="text-center text-sm text-state-completed">{t('auth.verifyEmailDone')}</p>
            <Link to="/login" className="text-center text-sm text-brand hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-center text-sm text-muted-foreground">{t('auth.verifyEmailIntro')}</p>
            {apiError && <p className="text-center text-sm text-destructive">{apiError}</p>}
            <Button
              className="mt-1"
              disabled={verifyMut.isPending}
              onClick={onVerify}
            >
              {t('auth.verifyEmailConfirm')}
            </Button>
            <Link to="/login" className="text-center text-sm text-muted-foreground hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
