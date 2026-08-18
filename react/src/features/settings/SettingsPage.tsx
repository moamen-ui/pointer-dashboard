// Settings admin page — super-admin only.
// Three-section form: Access, Email, Demo. Loads current settings into local state;
// one "Save changes" button PUTs the whole UpdateSettingsRequest.
// Phase B: Predefined actions section at the bottom (tenant-wide, projectId == null).
// Phase D: Suggestions review section (admin only).
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiAdminSettings,
  usePutApiAdminSettings,
  getGetApiAdminSettingsQueryKey,
  useGetApiAdminPredefinedActions,
  getGetApiAdminPredefinedActionsQueryKey,
  usePostApiAdminPredefinedActions,
  usePatchApiAdminPredefinedActionsId,
  useDeleteApiAdminPredefinedActionsId,
  type PredefinedActionResponse,
  useGetApiAdminPredefinedActionSuggestions,
  getGetApiAdminPredefinedActionSuggestionsQueryKey,
  usePostApiAdminPredefinedActionSuggestionsIdApprove,
  usePostApiAdminPredefinedActionSuggestionsIdReject,
  type SuggestionResponse,
} from '@moamen-ui/pointer-react';
import { Plus, Trash2, CheckCircle2, XCircle, EllipsisVertical } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AccordionSection } from '@/components/ui/accordion-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySettings = any;

// ---- Suggestions review card (admin-only) ----
function SuggestionsCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: suggestionsRaw = [], isLoading, isError } =
    useGetApiAdminPredefinedActionSuggestions();
  const suggestions: SuggestionResponse[] = suggestionsRaw as SuggestionResponse[];

  // status 1 = Pending, 2 = Approved, 3 = Rejected (from SuggestionStatus enum)
  const pending = suggestions.filter((s) => s.status === 1);

  const reloadSuggestions = () =>
    void qc.invalidateQueries({ queryKey: getGetApiAdminPredefinedActionSuggestionsQueryKey() });

  const approveMut = usePostApiAdminPredefinedActionSuggestionsIdApprove({
    mutation: {
      onSuccess: () => {
        toast(t('suggestions.approved'));
        reloadSuggestions();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  const rejectMut = usePostApiAdminPredefinedActionSuggestionsIdReject({
    mutation: {
      onSuccess: () => {
        toast(t('suggestions.rejected'));
        reloadSuggestions();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  const pendingCount = pending.length;
  const sectionTitle = pendingCount > 0
    ? `${t('suggestions.section')} — ${t('suggestions.pending', { count: pendingCount })}`
    : t('suggestions.section');

  return (
    <AccordionSection
      title={
        <>
          {sectionTitle}
          {/* Count stays in the header so it is visible while collapsed. */}
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
              {pendingCount}
            </span>
          )}
        </>
      }
    >

        {isLoading && (
          <p className="text-sm text-muted-foreground">{t('settings.loading')}</p>
        )}
        {isError && (
          <p className="text-sm text-destructive">{t('settings.loadError')}</p>
        )}
        {!isLoading && !isError && pending.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('suggestions.empty')}</p>
        )}

        {pending.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('suggestions.project')}</TableHead>
                <TableHead>{t('suggestions.by')}</TableHead>
                <TableHead>{t('predefined.text')}</TableHead>
                <TableHead>{t('predefined.prompt')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm">
                    <span className="font-medium">{s.projectName ?? '—'}</span>
                    {s.projectKey && (
                      <code className="ms-1 rounded bg-muted px-1 py-0.5 text-xs">
                        {s.projectKey}
                      </code>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.suggestedByName ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm">{s.text ?? '—'}</TableCell>
                  <TableCell className="max-w-[200px] text-sm text-muted-foreground truncate">
                    {s.prompt ?? '—'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" type="button">
                          <EllipsisVertical className="h-4 w-4" />
                          <span className="sr-only">{t('users.actions')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-green-600 focus:text-green-600 dark:text-green-400 dark:focus:text-green-400"
                          onSelect={() => approveMut.mutate({ id: s.id! })}
                          disabled={approveMut.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {t('suggestions.approve')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => rejectMut.mutate({ id: s.id! })}
                          disabled={rejectMut.isPending}
                        >
                          <XCircle className="h-4 w-4" />
                          {t('suggestions.reject')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
    </AccordionSection>
  );
}

/** One shared empty array, so an unloaded query does not change identity per render. */
const EMPTY_ACTIONS: PredefinedActionResponse[] = [];

export function SettingsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

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
  const [localEdits, setLocalEdits] = useState<
    Record<number, { text: string; prompt: string; dirty: boolean }>
  >({});
  const [newActionText, setNewActionText] = useState('');
  const [newActionPrompt, setNewActionPrompt] = useState('');

  const reloadPredefined = () =>
    void qc.invalidateQueries({ queryKey: getGetApiAdminPredefinedActionsQueryKey() });

  // `= []` as a default mints a NEW array on every render while data is undefined,
  // which re-fires the seeding effect below — one stable empty array instead. That,
  // together with an effect that always wrote a new object, pinned this page in a
  // "Maximum update depth exceeded" render loop.
  const { data: predefinedData, isLoading: predefinedLoading } =
    useGetApiAdminPredefinedActions();
  const rawPredefined = predefinedData ?? EMPTY_ACTIONS;
  const predefinedActions = rawPredefined.filter((a) => a.projectId == null);

  // Seed local edit state when server data arrives (only for items not already edited)
  useEffect(() => {
    setLocalEdits((prev) => {
      let added = false;
      const next = { ...prev };
      for (const a of predefinedActions) {
        if (a.id != null && !(a.id in next)) {
          next[a.id] = { text: a.text ?? '', prompt: a.prompt ?? '', dirty: false };
          added = true;
        }
      }
      // Returning `prev` unchanged lets React bail out instead of re-rendering, so a
      // no-op seed cannot feed itself another pass.
      return added ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPredefined]);

  function updateLocalAction(id: number, field: 'text' | 'prompt', value: string) {
    setLocalEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, dirty: true },
    }));
  }

  const patchActionMut = usePatchApiAdminPredefinedActionsId({
    mutation: {
      onSuccess: (_data, vars) => {
        setLocalEdits((prev) => ({
          ...prev,
          [vars.id]: { ...prev[vars.id], dirty: false },
        }));
        reloadPredefined();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  function saveAction(action: PredefinedActionResponse) {
    const edit = localEdits[action.id!];
    if (!edit) return;
    patchActionMut.mutate({
      id: action.id!,
      data: {
        text: edit.text,
        prompt: edit.prompt,
        isActive: action.isActive,
      },
    });
  }

  const deleteActionMut = useDeleteApiAdminPredefinedActionsId({
    mutation: {
      onSuccess: (_data, vars) => {
        setLocalEdits((prev) => {
          const next = { ...prev };
          delete next[vars.id];
          return next;
        });
        reloadPredefined();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  const addActionMut = usePostApiAdminPredefinedActions({
    mutation: {
      onSuccess: () => {
        setNewActionText('');
        setNewActionPrompt('');
        reloadPredefined();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  function addAction() {
    if (!newActionText.trim()) return;
    addActionMut.mutate({
      data: {
        text: newActionText.trim(),
        prompt: newActionPrompt.trim(),
        isActive: true,
        sortOrder: predefinedActions.length,
      },
    });
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
      <AccordionSection title={t('settings.accessSection')} defaultOpen>

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
      </AccordionSection>

      {/* ── Section 2: Email ── */}
      <AccordionSection title={t('settings.emailSection')}>

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
      </AccordionSection>

      {/* ── Section 3: Demo ── */}
      <AccordionSection title={t('settings.demoSection')}>

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
      </AccordionSection>

      {/* ── Save button ── */}
      <div className="flex justify-end">
        <Button disabled={updateMut.isPending} onClick={save}>
          {t('settings.save')}
        </Button>
      </div>

      {/* ── Section 4: Predefined actions (tenant-wide) ── */}
      <AccordionSection title={t('predefined.section')}>
          <p className="text-xs text-muted-foreground">{t('predefined.tenantHelp')}</p>

          {predefinedLoading && (
            <p className="text-sm text-muted-foreground">{t('settings.loading')}</p>
          )}

          {!predefinedLoading && predefinedActions.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('predefined.empty')}</p>
          )}

          {predefinedActions.map((action) => {
            const edit = localEdits[action.id!] ?? {
              text: action.text ?? '',
              prompt: action.prompt ?? '',
              dirty: false,
            };
            const isSaving =
              patchActionMut.isPending &&
              (patchActionMut.variables as { id?: number } | undefined)?.id === action.id;
            return (
              <div
                key={action.id}
                className="flex flex-col gap-2 rounded-md border border-border p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="flex flex-1 flex-col gap-1">
                    <Label className="text-xs">{t('predefined.text')}</Label>
                    <Input
                      value={edit.text}
                      onChange={(e) => updateLocalAction(action.id!, 'text', e.target.value)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mt-5 h-7 w-7 shrink-0 text-destructive"
                    onClick={() => deleteActionMut.mutate({ id: action.id! })}
                    disabled={deleteActionMut.isPending}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t('predefined.prompt')}</Label>
                  <textarea
                    value={edit.prompt}
                    onChange={(e) => updateLocalAction(action.id!, 'prompt', e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                {edit.dirty && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={isSaving}
                      onClick={() => saveAction(action)}
                    >
                      {t('common.save')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

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
                disabled={!newActionText.trim() || addActionMut.isPending}
                onClick={addAction}
                type="button"
              >
                <Plus className="h-4 w-4" />
                {t('predefined.add')}
              </Button>
            </div>
          </div>
      </AccordionSection>

      {/* ── Section 5: Suggestions review (admin only) ── */}
      {isAdmin && <SuggestionsCard />}
    </div>
  );
}
