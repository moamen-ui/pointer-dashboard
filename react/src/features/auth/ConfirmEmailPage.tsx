// ConfirmEmailPage — anonymous route landed on from the e-mailed link
// POST /api/me/change-email sends to the NEW address (DB-11d §3.2/§11). Reads ?token= from
// the URL and, on one confirm click, calls POST /api/auth/confirm-email-change. No session is
// required or used — the token is the credential, exactly like /reset and /delete-account.
// The button-click (never on-mount) requirement matters here specifically: a mail client's link
// pre-fetch/scanner must not consume the single-use token before the person ever opens the mail.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePostApiAuthConfirmEmailChange } from '@moamen-ui/pointer-react';
import { Button } from '@/components/ui/button';
import { extractMessage } from '@/lib/error';
import { AuthLayout } from '@/components/AuthLayout';

export function ConfirmEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [done, setDone] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const confirmMut = usePostApiAuthConfirmEmailChange();

  if (!token) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-5">
          <h1 className="text-center text-xl font-bold">{t('auth.confirmEmailTitle')}</h1>
          <p className="text-center text-sm text-destructive">{t('auth.confirmEmailInvalid')}</p>
          <Link to="/login" className="text-center text-sm text-brand hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  function onConfirm() {
    setApiError(null);
    confirmMut.mutate(
      { data: { token } },
      {
        // The generated client unwraps the success envelope down to `data.data`, which is
        // undefined for a bare `Result` — same shape DeleteAccountPage documents — so on
        // success we show our own copy (mirrors the server's fixed User.EmailChanged message)
        // rather than a value we no longer have access to. A 400/409 never reaches this
        // branch: axios rejects non-2xx responses before the client's own unwrap runs, so the
        // real server message is still available in onError.
        onSuccess: () => setDone(true),
        onError: (err: unknown) => setApiError(extractMessage(err)),
      },
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-5">
        <h1 className="text-center text-xl font-bold">{t('auth.confirmEmailTitle')}</h1>

        {done ? (
          <div className="flex flex-col gap-4">
            <p className="text-center text-sm text-state-completed">{t('auth.confirmEmailDone')}</p>
            <Link to="/login" className="text-center text-sm text-brand hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-center text-sm text-muted-foreground">{t('auth.confirmEmailIntro')}</p>
            {apiError && <p className="text-center text-sm text-destructive">{apiError}</p>}
            <Button
              className="mt-1"
              disabled={confirmMut.isPending}
              onClick={onConfirm}
            >
              {t('auth.confirmEmailConfirm')}
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
