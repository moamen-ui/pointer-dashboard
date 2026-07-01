// Settings admin page — super-admin only.
// Three-section form: Access, Email, Demo. Loads current settings into local state;
// one "Save changes" button PUTs the whole UpdateSettingsRequest.
// Phase B: Predefined actions section at the bottom (tenant-wide, projectId == null).
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiAdminSettings,
  usePutApiAdminSettings,
  getGetApiAdminSettingsQueryKey,
  AXIOS_INSTANCE,
  type PredefinedActionResponse,
} from '@moamen-ui/pointer-react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySettings = any;

// Local editable row for a predefined action
interface PredefinedActionEditable extends PredefinedActionResponse {
  _localText: string;
  _localPrompt: string;
  _dirty: boolean;
  _saving: boolean;
}

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

  // ---- Predefined actions (tenant-wide, projectId == null) ----
  const [predefinedActions, setPredefinedActions] = useState<PredefinedActionEditable[]>([]);
  const [predefinedLoading, setPredefinedLoading] = useState(false);
  const [addingAction, setAddingAction] = useState(false);
  const [newActionText, setNewActionText] = useState('');
  const [newActionPrompt, setNewActionPrompt] = useState('');

  const loadPredefinedActions = useCallback(async () => {
    setPredefinedLoading(true);
    try {
      const res = await AXIOS_INSTANCE.get<PredefinedActionResponse[] | { data: PredefinedActionResponse[] }>(
        '/api/admin/predefined-actions',
      );
      const raw = (res.data as { data?: PredefinedActionResponse[] })?.data
        ?? (res.data as PredefinedActionResponse[]);
      const tenantWide = raw.filter((a) => a.projectId == null);
      setPredefinedActions(
        tenantWide.map((a) => ({
          ...a,
          _localText: a.text ?? '',
          _localPrompt: a.prompt ?? '',
          _dirty: false,
          _saving: false,
        })),
      );
    } catch (e) {
      toast(extractMessage(e), 'error');
    } finally {
      setPredefinedLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadPredefinedActions();
  }, [loadPredefinedActions]);

  function updateLocalAction(id: number, field: '_localText' | '_localPrompt', value: string) {
    setPredefinedActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value, _dirty: true } : a)),
    );
  }

  async function saveAction(action: PredefinedActionEditable) {
    setPredefinedActions((prev) =>
      prev.map((a) => (a.id === action.id ? { ...a, _saving: true } : a)),
    );
    try {
      await AXIOS_INSTANCE.patch(`/api/admin/predefined-actions/${action.id}`, {
        text: action._localText,
        prompt: action._localPrompt,
        isActive: action.isActive,
      });
      setPredefinedActions((prev) =>
        prev.map((a) => (a.id === action.id ? { ...a, _dirty: false, _saving: false } : a)),
      );
    } catch (e) {
      toast(extractMessage(e), 'error');
      setPredefinedActions((prev) =>
        prev.map((a) => (a.id === action.id ? { ...a, _saving: false } : a)),
      );
    }
  }

  async function deleteAction(id: number) {
    try {
      await AXIOS_INSTANCE.delete(`/api/admin/predefined-actions/${id}`);
      setPredefinedActions((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      toast(extractMessage(e), 'error');
    }
  }

  async function addAction() {
    if (!newActionText.trim()) return;
    setAddingAction(true);
    try {
      const res = await AXIOS_INSTANCE.post<PredefinedActionResponse | { data: PredefinedActionResponse }>(
        '/api/admin/predefined-actions',
        {
          text: newActionText.trim(),
          prompt: newActionPrompt.trim(),
          isActive: true,
          sortOrder: predefinedActions.length,
        },
      );
      const created =
        (res.data as { data?: PredefinedActionResponse })?.data ??
        (res.data as PredefinedActionResponse);
      setPredefinedActions((prev) => [
        ...prev,
        {
          ...created,
          _localText: created.text ?? '',
          _localPrompt: created.prompt ?? '',
          _dirty: false,
          _saving: false,
        },
      ]);
      setNewActionText('');
      setNewActionPrompt('');
    } catch (e) {
      toast(extractMessage(e), 'error');
    } finally {
      setAddingAction(false);
    }
  }

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

      {/* ── Section 4: Predefined actions (tenant-wide) ── */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <h3 className="text-sm font-semibold">{t('predefined.section')}</h3>
          <p className="text-xs text-muted-foreground">{t('predefined.tenantHelp')}</p>

          {predefinedLoading && (
            <p className="text-sm text-muted-foreground">{t('settings.loading')}</p>
          )}

          {!predefinedLoading && predefinedActions.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('predefined.empty')}</p>
          )}

          {predefinedActions.map((action) => (
            <div
              key={action.id}
              className="flex flex-col gap-2 rounded-md border border-border p-3"
            >
              <div className="flex items-start gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <Label className="text-xs">{t('predefined.text')}</Label>
                  <Input
                    value={action._localText}
                    onChange={(e) => updateLocalAction(action.id!, '_localText', e.target.value)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-5 h-7 w-7 shrink-0 text-destructive"
                  onClick={() => deleteAction(action.id!)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t('predefined.prompt')}</Label>
                <textarea
                  value={action._localPrompt}
                  onChange={(e) => updateLocalAction(action.id!, '_localPrompt', e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              {action._dirty && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={action._saving}
                    onClick={() => saveAction(action)}
                  >
                    {t('common.save')}
                  </Button>
                </div>
              )}
            </div>
          ))}

          {/* Add new action */}
          <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t('predefined.text')}</Label>
              <Input
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                placeholder={t('predefined.text')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t('predefined.prompt')}</Label>
              <textarea
                value={newActionPrompt}
                onChange={(e) => setNewActionPrompt(e.target.value)}
                rows={2}
                placeholder={t('predefined.prompt')}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={!newActionText.trim() || addingAction}
                onClick={addAction}
                type="button"
              >
                <Plus className="h-4 w-4" />
                {t('predefined.add')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
