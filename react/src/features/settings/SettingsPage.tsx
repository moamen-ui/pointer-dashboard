// Settings admin page — super-admin only.
// Toggle the scoped-admin self-signup feature flag.
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiAdminSettings,
  usePutApiAdminSettings,
  getGetApiAdminSettingsQueryKey,
} from '@moamen-ui/pointer-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';

export function SettingsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useGetApiAdminSettings();

  // data is SettingsResponseResult — unwrap .data if needed
  const settings = (data as unknown as { data?: { scopedAdminSignupEnabled?: boolean } })?.data
    ?? (data as { scopedAdminSignupEnabled?: boolean } | undefined);

  const enabled = settings?.scopedAdminSignupEnabled ?? false;

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

  function toggle() {
    updateMut.mutate({ data: { scopedAdminSignupEnabled: !enabled } });
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

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t('settings.title')}</h2>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{t('settings.signupEnabled')}</p>
              <p className="text-xs text-muted-foreground">{t('settings.signupEnabledHint')}</p>
            </div>
            <Button
              variant={enabled ? 'destructive' : 'default'}
              disabled={updateMut.isPending}
              onClick={toggle}
            >
              {enabled ? t('common.disable') : t('common.enable')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('settings.signupStatus')}{' '}
            <span className={enabled ? 'text-green-600 dark:text-green-400' : 'text-destructive'}>
              {t(enabled ? 'common.active' : 'common.disabled')}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
