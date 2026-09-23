// /cli-login — approve or deny a CLI device-code sign-in from the browser.
// The CLI (`npx pointer-feedback login`) prints and opens
// https://app.pointer.moamen.work/cli-login?code=ABCD-EFGH and polls the API until the
// signed-in dashboard user decides here. Any authenticated workspace user may approve
// (super admins are refused by the API — they have no personal API key to hand out).
//
// Rendered inside AuthenticatedRoute but OUTSIDE Shell (no sidebar) and NOT behind
// ProtectedRoute/SuperAdminRoute — see App.tsx.
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
  useGetApiAuthDeviceUserCode,
  usePostApiAuthDeviceApprove,
  usePostApiAuthDeviceDeny,
  type DeviceLoginInfoResponse,
} from '@moamen-ui/pointer-react';
import { CheckCircle2, XCircle, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/FormField';
import { AuthLayout } from '@/components/AuthLayout';
import { useAuth } from '@/lib/auth';
import { usePreferences } from '@/lib/preferences';
import { extractMessage } from '@/lib/error';

const CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** Uppercases, strips anything but letters/digits, and re-inserts the dash once 4+
 * characters are present — so "abcd1234", "abcd-1234" and "ab cd 1234" all converge
 * on the same "ABCD-1234" shape as the user types or pastes. */
function normalizeCode(raw: string): string {
  const stripped = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  return stripped.length > 4 ? `${stripped.slice(0, 4)}-${stripped.slice(4)}` : stripped;
}

function httpStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object') {
    return (err as { response?: { status?: number } }).response?.status;
  }
  return undefined;
}

function relativeTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const minute = 60_000;
  const hour = 60 * minute;
  if (abs < minute) return rtf.format(Math.round(diffMs / 1000), 'second');
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute');
  return rtf.format(Math.round(diffMs / hour), 'hour');
}

export function CliLoginPage() {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [codeInput, setCodeInput] = useState(() => normalizeCode(searchParams.get('code') ?? ''));
  // The approve/deny mutations return the same DeviceLoginInfoResponse shape as the
  // GET — once the user decides, prefer this over the (now stale) query result so the
  // success/denied screen shows immediately without waiting on a refetch.
  const [actionResult, setActionResult] = useState<DeviceLoginInfoResponse | null>(null);

  const isValidFormat = CODE_PATTERN.test(codeInput);

  const infoQuery = useGetApiAuthDeviceUserCode(codeInput, {
    query: { enabled: isValidFormat, retry: false },
  });

  const approveMut = usePostApiAuthDeviceApprove();
  const denyMut = usePostApiAuthDeviceDeny();

  function onCodeChange(value: string) {
    setActionResult(null);
    setCodeInput(normalizeCode(value));
  }

  function onApprove() {
    approveMut.mutate(
      { data: { userCode: codeInput } },
      {
        onSuccess: (res) => setActionResult(res as unknown as DeviceLoginInfoResponse),
        onError: (err) => {
          // 409 = already decided (double click, or someone/something else raced us) —
          // refetch to show the true current state instead of a stale error.
          if (httpStatus(err) === 409) infoQuery.refetch();
        },
      },
    );
  }

  function onDeny() {
    denyMut.mutate(
      { data: { userCode: codeInput } },
      {
        onSuccess: (res) => setActionResult(res as unknown as DeviceLoginInfoResponse),
        onError: (err) => {
          if (httpStatus(err) === 409) infoQuery.refetch();
        },
      },
    );
  }

  const current = actionResult ?? infoQuery.data;
  const status = current?.status ?? null;
  const deciding = approveMut.isPending || denyMut.isPending;

  const codeField = (
    <FormField
      label={t('cliLogin.codeLabel')}
      htmlFor="cli-login-code"
      hint={!isValidFormat ? t('cliLogin.codeHint') : undefined}
    >
      <Input
        id="cli-login-code"
        value={codeInput}
        onChange={(e) => onCodeChange(e.target.value)}
        placeholder="ABCD-EFGH"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={9}
        className="h-12 max-md:h-12 text-center font-mono text-[22px] tracking-[0.2em]"
      />
    </FormField>
  );

  // ---- Not enough code yet: just the input, no request fired. ----
  if (!isValidFormat) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-5">
          <h1 className="text-center text-xl font-bold">{t('cliLogin.title')}</h1>
          {codeField}
        </div>
      </AuthLayout>
    );
  }

  const infoErrorStatus = infoQuery.isError ? httpStatus(infoQuery.error) : undefined;

  // ---- Loading the request info ----
  const isInitialLoading = infoQuery.isLoading && !actionResult;

  // ---- 403: super admins cannot use the CLI ----
  const isForbidden = infoErrorStatus === 403 && !actionResult;

  // ---- 404 / expired / unknown: treat identically ----
  const isInvalid =
    !actionResult &&
    ((infoQuery.isError && infoErrorStatus !== 403 && infoErrorStatus !== undefined) ||
      status === 'expired' ||
      status === 'unknown');

  // ---- Other network/unexpected error (no response, or unmapped status) ----
  const isGenericError =
    !actionResult && infoQuery.isError && infoErrorStatus === undefined;

  let body: ReactNode;

  if (isInitialLoading) {
    body = <p className="text-center text-sm text-muted-foreground">{t('common.loading')}</p>;
  } else if (isForbidden) {
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <ShieldAlert className="h-8 w-8 text-state-danger" aria-hidden="true" />
        <p className="text-sm text-foreground">{extractMessage(infoQuery.error)}</p>
      </div>
    );
  } else if (isGenericError) {
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-state-danger" aria-hidden="true" />
        <p className="text-sm text-foreground">{t('cliLogin.errorBody')}</p>
        <Button variant="outline" size="sm" onClick={() => infoQuery.refetch()}>
          {t('cliLogin.retry')}
        </Button>
      </div>
    );
  } else if (isInvalid) {
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-foreground">{t('cliLogin.invalidBody')}</p>
      </div>
    );
  } else if (status === 'approved') {
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-8 w-8 text-state-completed" aria-hidden="true" />
        <p className="text-sm text-foreground">{t('cliLogin.approvedBody')}</p>
        <p className="text-xs text-muted-foreground">{t('cliLogin.approvedNote')}</p>
      </div>
    );
  } else if (status === 'denied') {
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <XCircle className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-foreground">{t('cliLogin.deniedBody')}</p>
      </div>
    );
  } else if (status === 'pending' && current) {
    const createdLabel = relativeTime(current.createdAt, language);
    const expiresLabel = relativeTime(current.expiresAt, language);
    body = (
      <div className="flex flex-col gap-4">
        <p className="text-center text-[15px] text-foreground">
          <Trans
            i18nKey="cliLogin.confirmPrompt"
            values={{ client: current.clientName ?? t('cliLogin.unknownClient') }}
            components={{ strong: <strong className="font-semibold" /> }}
          />
        </p>

        <div className="flex flex-col gap-1 text-center text-[12px] text-muted-foreground">
          {createdLabel && <span>{t('cliLogin.createdAt', { time: createdLabel })}</span>}
          {expiresLabel && <span>{t('cliLogin.expiresAt', { time: expiresLabel })}</span>}
        </div>

        {user && (
          <div className="rounded-md border border-border bg-gutter/40 px-3 py-2 text-center text-[13px]">
            <span className="text-muted-foreground">{t('cliLogin.signedInAs')} </span>
            <span className="font-medium text-foreground">{user.displayName}</span>
            {user.email && <span className="text-muted-foreground"> ({user.email})</span>}
            {user.tenantName && (
              <p className="mt-1 text-muted-foreground">
                <Trans
                  i18nKey="cliLogin.signInto"
                  values={{ name: user.tenantName }}
                  components={{ strong: <strong className="font-semibold text-foreground" /> }}
                />
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="h-11 flex-1"
            onClick={onDeny}
            disabled={deciding || status !== 'pending'}
            loading={denyMut.isPending}
          >
            {t('cliLogin.deny')}
          </Button>
          <Button
            variant="default"
            className="h-11 flex-1"
            onClick={onApprove}
            disabled={deciding || status !== 'pending'}
            loading={approveMut.isPending}
          >
            {t('cliLogin.approve')}
          </Button>
        </div>
      </div>
    );
  } else {
    // Defensive fallback — should not normally be reached.
    body = (
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-foreground">{t('cliLogin.invalidBody')}</p>
      </div>
    );
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-5">
        <h1 className="text-center text-xl font-bold">{t('cliLogin.title')}</h1>
        {codeField}
        <div aria-live="polite">{body}</div>
      </div>
    </AuthLayout>
  );
}
