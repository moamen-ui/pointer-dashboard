// Settings admin page — super-admin only.
// Three-section form: Access, Email, Demo. Loads current settings into local state;
// one "Save changes" button PUTs the whole UpdateSettingsRequest.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiAdminSettings,
  usePutApiAdminSettings,
  getGetApiAdminSettingsQueryKey,
} from '@moamen-ui/pointer-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySettings = any;

export function SettingsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useGetApiAdminSettings();

  // Unwrap data — the hook may return { data: SettingsResponse } or SettingsResponse directly
  const settings: AnySettings =
    (data as unknown as { data?: AnySettings })?.data ?? (data as AnySettings | undefined);

  // ---- Local form state ----
  const [scopedAdminSignupEnabled, setScopedAdminSignupEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailFromEmail, setEmailFromEmail] = useState('');
  const [emailFromName, setEmailFromName] = useState('');
  const [emailDailyCap, setEmailDailyCap] = useState(1);
  const [demoMaxActive, setDemoMaxActive] = useState(1);
  const [demoTtlHours, setDemoTtlHours] = useState(1);
  const [demoPerEmailPerDay, setDemoPerEmailPerDay] = useState(1);
  const [demoCommentCap, setDemoCommentCap] = useState(1);

  // Seed local state whenever settings loads / refreshes
  useEffect(() => {
    if (!settings) return;
    setScopedAdminSignupEnabled(settings.scopedAdminSignupEnabled ?? false);
    setEmailEnabled(settings.emailEnabled ?? false);
    setEmailFromEmail(settings.emailFromEmail ?? '');
    setEmailFromName(settings.emailFromName ?? '');
    setEmailDailyCap(settings.emailDailyCap ?? 1);
    setDemoMaxActive(settings.demoMaxActive ?? 1);
    setDemoTtlHours(settings.demoTtlHours ?? 1);
    setDemoPerEmailPerDay(settings.demoPerEmailPerDay ?? 1);
    setDemoCommentCap(settings.demoCommentCap ?? 1);
  }, [settings]);

  const reload = () =>
    void qc.invalidateQueries({ queryKey: getGetApiAdminSettingsQueryKey() });

  const updateMut = usePutApiAdminSettings({
    mutation: {
      onSuccess: () => {
        toast(t('settings.saved'));
        reload();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  function save() {
    updateMut.mutate({
      data: {
        scopedAdminSignupEnabled,
        emailEnabled,
        emailFromEmail,
        emailFromName,
        emailDailyCap,
        demoMaxActive,
        demoTtlHours,
        demoPerEmailPerDay,
        demoCommentCap,
      },
    });
  }

  if (isLoading && !data) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {t('settings.loading')}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-destructive">
        {t('settings.loadError')}
      </div>
    );
  }

  const apiKeyConfigured: boolean = settings?.emailApiKeyConfigured ?? false;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">{t('settings.title')}</h2>

      {/* ── Section 1: Access ── */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <h3 className="text-sm font-semibold">{t('settings.accessSection')}</h3>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="signup-enabled" className="text-sm font-medium">
                {t('settings.signupEnabled')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('settings.signupEnabledHint')}</p>
            </div>
            <input
              id="signup-enabled"
              type="checkbox"
              checked={scopedAdminSignupEnabled}
              onChange={(e) => setScopedAdminSignupEnabled(e.target.checked)}
              className="h-4 w-4 cursor-pointer"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Email ── */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <h3 className="text-sm font-semibold">{t('settings.emailSection')}</h3>

          {/* emailEnabled */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="email-enabled" className="text-sm font-medium">
                {t('settings.emailEnabled')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('settings.emailEnabledHint')}</p>
            </div>
            <input
              id="email-enabled"
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              className="h-4 w-4 cursor-pointer"
            />
          </div>

          {/* emailFromEmail */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="email-from" className="text-sm font-medium">
              {t('settings.emailFrom')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('settings.emailFromHint')}</p>
            <Input
              id="email-from"
              type="email"
              value={emailFromEmail}
              onChange={(e) => setEmailFromEmail(e.target.value)}
            />
          </div>

          {/* emailFromName */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="email-from-name" className="text-sm font-medium">
              {t('settings.emailFromName')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('settings.emailFromNameHint')}</p>
            <Input
              id="email-from-name"
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
            />
          </div>

          {/* emailDailyCap */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="email-daily-cap" className="text-sm font-medium">
              {t('settings.emailDailyCap')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('settings.emailDailyCapHint')}</p>
            <Input
              id="email-daily-cap"
              type="number"
              min={1}
              value={emailDailyCap}
              onChange={(e) => setEmailDailyCap(Number(e.target.value))}
              className="max-w-[12rem]"
            />
          </div>

          {/* API key — read-only status line */}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{t('settings.emailApiKey')}</p>
            <p className="text-xs text-muted-foreground">{t('settings.emailApiKeyHint')}</p>
            <p className="text-sm font-medium">
              {apiKeyConfigured ? (
                <span className="text-green-600 dark:text-green-400">
                  ✓ {t('settings.emailApiKeyConfigured')}
                </span>
              ) : (
                <span className="text-destructive">
                  ✗ {t('settings.emailApiKeyMissing')}
                </span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Demo ── */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <h3 className="text-sm font-semibold">{t('settings.demoSection')}</h3>

          {/* demoMaxActive */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="demo-max-active" className="text-sm font-medium">
              {t('settings.demoMaxActive')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('settings.demoMaxActiveHint')}</p>
            <Input
              id="demo-max-active"
              type="number"
              min={1}
              value={demoMaxActive}
              onChange={(e) => setDemoMaxActive(Number(e.target.value))}
              className="max-w-[12rem]"
            />
          </div>

          {/* demoTtlHours */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="demo-ttl-hours" className="text-sm font-medium">
              {t('settings.demoTtlHours')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('settings.demoTtlHoursHint')}</p>
            <Input
              id="demo-ttl-hours"
              type="number"
              min={1}
              value={demoTtlHours}
              onChange={(e) => setDemoTtlHours(Number(e.target.value))}
              className="max-w-[12rem]"
            />
          </div>

          {/* demoPerEmailPerDay */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="demo-per-email" className="text-sm font-medium">
              {t('settings.demoPerEmailPerDay')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('settings.demoPerEmailPerDayHint')}</p>
            <Input
              id="demo-per-email"
              type="number"
              min={1}
              value={demoPerEmailPerDay}
              onChange={(e) => setDemoPerEmailPerDay(Number(e.target.value))}
              className="max-w-[12rem]"
            />
          </div>

          {/* demoCommentCap */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="demo-comment-cap" className="text-sm font-medium">
              {t('settings.demoCommentCap')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('settings.demoCommentCapHint')}</p>
            <Input
              id="demo-comment-cap"
              type="number"
              min={1}
              value={demoCommentCap}
              onChange={(e) => setDemoCommentCap(Number(e.target.value))}
              className="max-w-[12rem]"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Save button ── */}
      <div className="flex justify-end">
        <Button disabled={updateMut.isPending} onClick={save}>
          {t('settings.save')}
        </Button>
      </div>
    </div>
  );
}
