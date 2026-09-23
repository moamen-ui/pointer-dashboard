// VerificationBanner — DB-14 §11.1: a persistent shell banner while the signed-in identity's
// e-mail is unverified AND the gate actually blocks them (`me.emailVerificationRequired` —
// server-computed as `!emailVerified && role grants admin`; already false for super admins,
// verified identities, demo/passwordless identities and non-admin stakeholders, so this
// component needs no extra hiding logic of its own beyond that one flag). Same placement/shape
// family as ImpersonationBanner (a full-width strip above the main content) and the same
// state-ready (amber, "action needed but not danger") hue.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MailWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';
import { usePostApiMeVerificationResend, getGetApiAuthMeQueryKey, type MeResponse } from '@moamen-ui/pointer-react';
import { useQueryClient } from '@tanstack/react-query';

export function VerificationBanner({ me }: { me: MeResponse | undefined }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sent, setSent] = useState(false);

  const resendMut = usePostApiMeVerificationResend({
    mutation: {
      onSuccess: () => {
        setSent(true);
        toast(t('verification.resendSent'), 'success');
        void qc.invalidateQueries({ queryKey: getGetApiAuthMeQueryKey() });
      },
      onError: (e: unknown) => {
        const status = (e as { response?: { status?: number } })?.response?.status;
        toast(status === 429 ? t('common.tooManyRequests') : extractMessage(e), 'warning');
      },
    },
  });

  if (!me?.emailVerificationRequired) return null;

  return (
    <div className="border-b border-state-ready/30 bg-state-ready-tint px-6 py-2.5">
      <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center gap-x-2 gap-y-1.5">
        <MailWarning className="h-4 w-4 shrink-0 text-state-ready" aria-hidden="true" />
        <span className="text-[13px] font-medium text-state-ready">
          {t('verification.bannerText')}
        </span>
        <div className="ms-auto flex shrink-0 items-center gap-3">
          {sent ? (
            <span className="text-[13px] text-state-ready/85">{t('verification.resendSent')}</span>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={resendMut.isPending}
              onClick={() => resendMut.mutate()}
            >
              {t('verification.resendLink')}
            </Button>
          )}
          <Link
            to="/profile"
            className="text-[13px] font-medium text-state-ready underline hover:opacity-75"
          >
            {t('verification.changeAddressLink')}
          </Link>
        </div>
      </div>
    </div>
  );
}
