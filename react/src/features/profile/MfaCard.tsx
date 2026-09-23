// R5-61 §11 — "Two-factor authentication" card, super-admin self-view only. `mfaEnabled`
// (from MeResponse, fetched by ProfilePage) drives Off ("Enable" → password → QR/secret +
// recovery codes → code → verify) vs On ("Disable" → password + code/recovery code).
//
// No QR library is installed in this app (node_modules has none, and the task explicitly
// forbids adding one) — the otpauth URL is shown as a copyable link plus the base32 secret
// for manual entry, exactly as R5-61 §3.2/§11 allows as the no-new-dependency fallback.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  usePostApiMeMfaEnrol,
  usePostApiMeMfaVerify,
  usePostApiMeMfaDisable,
  getGetApiAuthMeQueryKey,
} from '@moamen-ui/pointer-react';
import { ShieldCheck, ShieldOff, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/shared/FormField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';

interface MfaCardProps {
  mfaEnabled: boolean;
}

type EnrolStage = 'password' | 'setup' | 'recovery';

export function MfaCard({ mfaEnabled }: MfaCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  function invalidateMe() {
    queryClient.invalidateQueries({ queryKey: getGetApiAuthMeQueryKey() });
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('profile.copied'), 'success');
    } catch {
      toast(t('demo.copyFailed'), 'error');
    }
  }

  // ---- Enrol dialog: password → QR/secret → recovery codes ----
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [enrolStage, setEnrolStage] = useState<EnrolStage>('password');
  const [enrolPassword, setEnrolPassword] = useState('');
  const [enrolError, setEnrolError] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [enrolCode, setEnrolCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const enrolMut = usePostApiMeMfaEnrol({
    mutation: {
      onSuccess: (res) => {
        setSecret(res.secret ?? '');
        setOtpauthUrl(res.otpauthUrl ?? '');
        setEnrolError(null);
        setEnrolStage('setup');
      },
      onError: (e: unknown) => setEnrolError(extractMessage(e)),
    },
  });

  const verifyMut = usePostApiMeMfaVerify({
    mutation: {
      onSuccess: (res) => {
        setRecoveryCodes(res.recoveryCodes ?? []);
        setEnrolError(null);
        setEnrolStage('recovery');
      },
      onError: (e: unknown) => setEnrolError(extractMessage(e)),
    },
  });

  function openEnrol() {
    setEnrolStage('password');
    setEnrolPassword('');
    setEnrolCode('');
    setEnrolError(null);
    setSecret('');
    setOtpauthUrl('');
    setRecoveryCodes([]);
    setEnrolOpen(true);
  }

  function submitEnrolPassword() {
    if (!enrolPassword) return;
    setEnrolError(null);
    enrolMut.mutate({ data: { currentPassword: enrolPassword } });
  }

  function submitEnrolCode() {
    if (!enrolCode.trim()) return;
    setEnrolError(null);
    verifyMut.mutate({ data: { code: enrolCode.trim() } });
  }

  function finishEnrol() {
    setEnrolOpen(false);
    invalidateMe();
    toast(t('mfa.on'), 'success');
  }

  function downloadRecoveryCodes() {
    const blob = new Blob([recoveryCodes.join('\n') + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pointer-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---- Disable dialog: password + code/recovery code ----
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState<string | null>(null);

  const disableMut = usePostApiMeMfaDisable({
    mutation: {
      onSuccess: () => {
        setDisableOpen(false);
        invalidateMe();
        toast(t('mfa.off'), 'success');
      },
      onError: (e: unknown) => setDisableError(extractMessage(e)),
    },
  });

  function openDisable() {
    setDisablePassword('');
    setDisableCode('');
    setDisableError(null);
    setDisableOpen(true);
  }

  function submitDisable() {
    if (!disablePassword || !disableCode.trim()) return;
    setDisableError(null);
    disableMut.mutate({ data: { currentPassword: disablePassword, code: disableCode.trim() } });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {mfaEnabled ? (
            <ShieldCheck className="h-4 w-4 text-state-completed" />
          ) : (
            <ShieldOff className="h-4 w-4 text-muted-foreground" />
          )}
          <h2 className="text-[15px] font-semibold leading-6">{t('mfa.title')}</h2>
        </div>
        {mfaEnabled ? (
          <Button variant="outline" size="sm" onClick={openDisable}>
            {t('mfa.disable')}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={openEnrol}>
            {t('mfa.enable')}
          </Button>
        )}
      </div>

      <p className="mt-1 text-[13px] text-muted-foreground">{t('mfa.subtitle')}</p>
      <p className="mt-2 text-[13px] font-medium">{mfaEnabled ? t('mfa.on') : t('mfa.off')}</p>

      {/* Enrol dialog */}
      <Dialog open={enrolOpen} onOpenChange={(o) => !o && setEnrolOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('mfa.enableTitle')}</DialogTitle>
            {enrolStage === 'password' && (
              <DialogDescription>{t('mfa.enrolPasswordHint')}</DialogDescription>
            )}
            {enrolStage === 'setup' && <DialogDescription>{t('mfa.scanHint')}</DialogDescription>}
            {enrolStage === 'recovery' && (
              <DialogDescription>{t('mfa.recoveryCodesHint')}</DialogDescription>
            )}
          </DialogHeader>

          {enrolError && (
            <p role="alert" className="text-[13px] text-state-danger">
              {enrolError}
            </p>
          )}

          {enrolStage === 'password' && (
            <div className="flex flex-col gap-4 pt-1">
              <FormField label={t('changePassword.current')} htmlFor="mfa-enrol-password">
                <PasswordInput
                  id="mfa-enrol-password"
                  autoComplete="current-password"
                  value={enrolPassword}
                  onChange={(e) => setEnrolPassword(e.target.value)}
                  autoFocus
                />
              </FormField>
            </div>
          )}

          {enrolStage === 'setup' && (
            <div className="flex flex-col gap-4 pt-1">
              <div className="flex flex-col gap-1">
                <p className="text-[12px] text-muted-foreground">{t('mfa.otpauthLinkHint')}</p>
                <div className="flex items-center gap-2">
                  <a
                    href={otpauthUrl}
                    className="min-w-0 flex-1 truncate rounded-md border border-border bg-gutter px-3 py-2 font-mono text-[12px] text-brand hover:underline"
                  >
                    {otpauthUrl}
                  </a>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t('profile.copyApiKey')}
                    onClick={() => copyText(otpauthUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[12px] text-muted-foreground">{t('mfa.manualEntryHint')}</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-gutter px-3 py-2 font-mono text-[13px]">
                    {secret}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t('profile.copyApiKey')}
                    onClick={() => copyText(secret)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <FormField label={t('mfa.verifyCodeLabel')} htmlFor="mfa-enrol-code">
                <Input
                  id="mfa-enrol-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={enrolCode}
                  onChange={(e) => setEnrolCode(e.target.value)}
                  autoFocus
                />
              </FormField>
            </div>
          )}

          {enrolStage === 'recovery' && (
            <div className="flex flex-col gap-3 pt-1">
              <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-gutter p-3 font-mono text-[13px]">
                {recoveryCodes.map((code) => (
                  <span key={code}>{code}</span>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyText(recoveryCodes.join('\n'))}
                >
                  <Copy className="h-4 w-4" />
                  {t('profile.copyApiKey')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={downloadRecoveryCodes}>
                  <Download className="h-4 w-4" />
                  {t('mfa.download')}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {enrolStage !== 'recovery' && (
              <Button variant="outline" onClick={() => setEnrolOpen(false)}>
                {t('common.cancel')}
              </Button>
            )}
            {enrolStage === 'password' && (
              <Button
                disabled={!enrolPassword || enrolMut.isPending}
                onClick={submitEnrolPassword}
              >
                {t('mfa.enrolSubmit')}
              </Button>
            )}
            {enrolStage === 'setup' && (
              <Button disabled={!enrolCode.trim() || verifyMut.isPending} onClick={submitEnrolCode}>
                {t('mfa.verify')}
              </Button>
            )}
            {enrolStage === 'recovery' && (
              <Button onClick={finishEnrol}>{t('mfa.recoveryCodesSaved')}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable dialog */}
      <Dialog open={disableOpen} onOpenChange={(o) => !o && setDisableOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('mfa.disableTitle')}</DialogTitle>
            <DialogDescription>{t('mfa.disableCodeHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            {disableError && (
              <p role="alert" className="text-[13px] text-state-danger">
                {disableError}
              </p>
            )}
            <FormField label={t('changePassword.current')} htmlFor="mfa-disable-password">
              <PasswordInput
                id="mfa-disable-password"
                autoComplete="current-password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoFocus
              />
            </FormField>
            <FormField label={t('mfa.codeLabel')} htmlFor="mfa-disable-code">
              <Input
                id="mfa-disable-code"
                autoComplete="one-time-code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDisableOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={!disablePassword || !disableCode.trim() || disableMut.isPending}
              onClick={submitDisable}
            >
              {t('mfa.disableSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
