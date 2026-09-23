// DeleteAccountPage — anonymous route landed on from the e-mailed link
// POST /api/me/request-erase sends for a passwordless (quick-access) identity
// (DB-11c §3.4b). Reads ?token= from the URL and, on one confirm click, calls
// POST /api/auth/confirm-erase. No session is required or used — the token is
// the credential, exactly like /reset. Copied from ResetPasswordPage's shape.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePostApiAuthConfirmErase } from '@moamen-ui/pointer-react';
import { Button } from '@/components/ui/button';
import { extractMessage } from '@/lib/error';
import { AuthLayout } from '@/components/AuthLayout';

export function DeleteAccountPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [done, setDone] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const confirmMut = usePostApiAuthConfirmErase();

  if (!token) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-5">
          <h1 className="text-center text-xl font-bold">{t('auth.deleteAccountTitle')}</h1>
          <p className="text-center text-sm text-destructive">{t('auth.deleteAccountInvalid')}</p>
          <Link to="/login" className="text-center text-sm text-brand hover:underline">
            {t('auth.deleteAccountBackToLogin')}
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
        // undefined for a bare Result — so on success we show our own copy (it mirrors the
        // server's fixed User.Erased message) rather than a value we no longer have access to.
        // A 400/409 never reaches this branch: axios rejects non-2xx responses before the
        // client's own unwrap runs, so the real server message is still available in `onError`.
        onSuccess: () => setDone(true),
        onError: (err: unknown) => setApiError(extractMessage(err)),
      },
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-5">
        <h1 className="text-center text-xl font-bold">{t('auth.deleteAccountTitle')}</h1>

        {done ? (
          <div className="flex flex-col gap-4">
            <p className="text-center text-sm text-state-completed">{t('auth.deleteAccountDone')}</p>
            <Link to="/login" className="text-center text-sm text-brand hover:underline">
              {t('auth.deleteAccountBackToLogin')}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-center text-sm text-muted-foreground">{t('auth.deleteAccountIntro')}</p>
            {apiError && <p className="text-center text-sm text-destructive">{apiError}</p>}
            <Button
              variant="destructive"
              className="mt-1"
              disabled={confirmMut.isPending}
              onClick={onConfirm}
            >
              {t('auth.deleteAccountConfirm')}
            </Button>
            <Link to="/login" className="text-center text-sm text-muted-foreground hover:underline">
              {t('auth.deleteAccountBackToLogin')}
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
