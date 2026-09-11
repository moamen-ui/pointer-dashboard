// Settings admin page — reachable by any admin, but the first three sections
// (Access, Email, Demo — instance-wide settings, one "Save changes" button PUTs the whole
// UpdateSettingsRequest) are super-admin only, matching the backend's SettingsController policy.
// Predefined actions (tenant-wide, projectId == null) and the suggestions review section below
// are available to any admin.
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
  useGetApiAdminAiRulesTenant,
  getGetApiAdminAiRulesTenantQueryKey,
  usePostApiAdminAiRules,
  usePutApiAdminAiRulesId,
  useDeleteApiAdminAiRulesId,
  type AiRuleResponse,
} from '@moamen-ui/pointer-react';
import { Plus, Trash2, CheckCircle2, XCircle, EllipsisVertical } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AccordionSection } from '@/components/ui/accordion-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/components/shared/FormField';
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
  const sectionTitle = t('suggestions.section');

  return (
    <AccordionSection
      title={
        <>
          {sectionTitle}
          {/* Count stays in the header so it is visible while collapsed. */}
          {pendingCount > 0 && (
            <Badge variant="default" className="ms-2 text-[11px]">
              {pendingCount}
            </Badge>
          )}
        </>
      }
    >
        {isLoading && (
          <p className="text-[14px] text-muted-foreground">{t('settings.loading')}</p>
        )}
        {isError && (
          <p className="text-[14px] text-state-danger">{t('settings.loadError')}</p>
        )}
        {!isLoading && !isError && pending.length === 0 && (
          <p className="text-[14px] text-muted-foreground">{t('suggestions.empty')}</p>
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
                  <TableCell className="text-[14px]">
                    <span className="font-medium">{s.projectName ?? '—'}</span>
                    {s.projectKey && (
                      <code className="ms-1 rounded bg-gutter px-1.5 py-0.5 text-[12px] font-mono">
                        {s.projectKey}
                      </code>
                    )}
                  </TableCell>
                  <TableCell className="text-[14px] text-muted-foreground">
                    {s.suggestedByName ?? '—'}
                  </TableCell>
                  <TableCell className="text-[14px]">{s.text ?? '—'}</TableCell>
                  <TableCell className="max-w-[200px] text-[14px] text-muted-foreground truncate">
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
                          className="text-state-completed"
                          onSelect={() => approveMut.mutate({ id: s.id! })}
                          disabled={approveMut.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {t('suggestions.approve')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-state-danger"
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

type EditableRule = {
  id?: number;
  title: string;
  prompt: string;
  isActive: boolean;
  sortOrder: number;
  dirty: boolean;
};

// ---- Workspace AI Rules card (workspace admins/deputies) ----
function AiRulesCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: rawRules = [], isLoading } = useGetApiAdminAiRulesTenant();
  const rules: AiRuleResponse[] = (rawRules as AiRuleResponse[]) ?? [];

  const [localRules, setLocalRules] = useState<Record<number, EditableRule>>({});
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  const reloadRules = () => {
    void qc.invalidateQueries({ queryKey: getGetApiAdminAiRulesTenantQueryKey() });
  };

  useEffect(() => {
    setLocalRules((prev) => {
      let added = false;
      const next = { ...prev };
      for (const r of rules) {
        if (r.id != null && !(r.id in next)) {
          next[r.id] = {
            id: r.id,
            title: r.title ?? '',
            prompt: r.prompt ?? '',
            isActive: r.isActive ?? true,
            sortOrder: r.sortOrder ?? 0,
            dirty: false,
          };
          added = true;
        }
      }
      return added ? next : prev;
    });
  }, [rules]);

  function updateRule(id: number, field: 'title' | 'prompt' | 'isActive', value: any) {
    setLocalRules((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, dirty: true },
    }));
  }

  const putMut = usePutApiAdminAiRulesId({
    mutation: {
      onSuccess: (_data, vars) => {
        setLocalRules((prev) => ({
          ...prev,
          [vars.id]: { ...prev[vars.id], dirty: false },
        }));
        reloadRules();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  const deleteMut = useDeleteApiAdminAiRulesId({
    mutation: {
      onSuccess: (_data, vars) => {
        setLocalRules((prev) => {
          const next = { ...prev };
          delete next[vars.id];
          return next;
        });
        reloadRules();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  const createMut = usePostApiAdminAiRules({
    mutation: {
      onSuccess: () => {
        setNewTitle('');
        setNewPrompt('');
        reloadRules();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  function saveRule(ruleId: number) {
    const edit = localRules[ruleId];
    if (!edit) return;
    putMut.mutate({
      id: ruleId,
      data: {
        title: edit.title.trim(),
        prompt: edit.prompt.trim(),
        isActive: edit.isActive,
      },
    });
  }

  function handleCreate() {
    if (!newTitle.trim() || !newPrompt.trim()) return;
    createMut.mutate({
      data: {
        title: newTitle.trim(),
        prompt: newPrompt.trim(),
        sortOrder: rules.length,
      },
    });
  }

  return (
    <AccordionSection title={t('aiRules.section')}>
      <div className="space-y-3">
        <p className="text-[12px] text-muted-foreground max-w-[72ch]">{t('aiRules.tenantHelp')}</p>

        {isLoading && rules.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</p>
        ) : rules.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">{t('aiRules.empty')}</p>
        ) : null}

        <div className="rounded-md border border-border overflow-hidden">
          {rules.map((rule, idx) => {
            const edit = localRules[rule.id!] ?? {
              id: rule.id,
              title: rule.title ?? '',
              prompt: rule.prompt ?? '',
              isActive: rule.isActive ?? true,
              sortOrder: rule.sortOrder ?? 0,
              dirty: false,
            };
            const isSaving =
              putMut.isPending &&
              (putMut.variables as { id?: number } | undefined)?.id === rule.id;

            return (
              <div
                key={rule.id}
                className={`flex flex-col gap-3 px-3 py-2.5 ${idx === 0 ? '' : 'border-t border-border-muted'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <FormField label={t('aiRules.titleLabel')} htmlFor={`admin-rule-title-${rule.id}`}>
                      <Input
                        id={`admin-rule-title-${rule.id}`}
                        value={edit.title}
                        onChange={(e) => updateRule(rule.id!, 'title', e.target.value)}
                      />
                    </FormField>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <label className="flex items-center gap-1.5 text-[13px] font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={edit.isActive}
                        onChange={(e) => updateRule(rule.id!, 'isActive', e.target.checked)}
                        className="h-4 w-4 cursor-pointer"
                      />
                      {t(edit.isActive ? 'common.active' : 'common.disabled')}
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-state-danger"
                      type="button"
                      disabled={deleteMut.isPending}
                      onClick={() => deleteMut.mutate({ id: rule.id! })}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <FormField label={t('aiRules.promptLabel')} htmlFor={`admin-rule-prompt-${rule.id}`}>
                  <textarea
                    id={`admin-rule-prompt-${rule.id}`}
                    value={edit.prompt}
                    onChange={(e) => updateRule(rule.id!, 'prompt', e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[14px] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </FormField>

                {edit.dirty && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={isSaving}
                      onClick={() => saveRule(rule.id!)}
                    >
                      {t('common.save')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add new rule */}
        <div className="flex flex-col gap-3 rounded-md border border-border border-dashed px-3 py-2.5">
          <FormField label={t('aiRules.titleLabel')} htmlFor="new-admin-rule-title">
            <Input
              id="new-admin-rule-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('aiRules.titlePlaceholder')}
            />
          </FormField>
          <FormField label={t('aiRules.promptLabel')} htmlFor="new-admin-rule-prompt">
            <textarea
              id="new-admin-rule-prompt"
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              rows={2}
              placeholder={t('aiRules.promptPlaceholder')}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[14px] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </FormField>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              disabled={!newTitle.trim() || !newPrompt.trim() || createMut.isPending}
              onClick={handleCreate}
              type="button"
            >
              <Plus className="h-4 w-4" />
              {t('aiRules.addRule')}
            </Button>
          </div>
        </div>
      </div>
    </AccordionSection>
  );
}

/** One shared empty array, so an unloaded query does not change identity per render. */
const EMPTY_ACTIONS: PredefinedActionResponse[] = [];

export function SettingsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isAdmin, isSuperAdmin } = useAuth();

  // Instance-wide settings (Access/Email/Demo) are super-admin only on the backend
  // (SettingsController is Policies.SuperAdmin) — skip the fetch entirely for a tenant admin,
  // who only reaches this page for the tenant-scoped sections below.
  const { data, isLoading, isError } = useGetApiAdminSettings({ query: { enabled: isSuperAdmin } });

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
  const [extensionStoreUrl, setExtensionStoreUrl] = useState('');
  const [extensionZipUrl, setExtensionZipUrl] = useState('');

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
    setExtensionStoreUrl(settings.extensionStoreUrl ?? '');
    setExtensionZipUrl(settings.extensionZipUrl ?? '');
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
        extensionStoreUrl,
        extensionZipUrl,
      },
    });
  }

  if (isSuperAdmin && isLoading && !data) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {t('settings.loading')}
      </div>
    );
  }

  if (isSuperAdmin && isError) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-destructive">
        {t('settings.loadError')}
      </div>
    );
  }

  const apiKeyConfigured: boolean = settings?.emailApiKeyConfigured ?? false;

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.01em]">{t('settings.title')}</h1>
      </div>

      {isSuperAdmin && (
        <>
          {/* ── Section 1: Access ── */}
      <AccordionSection title={t('settings.accessSection')} defaultOpen>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="signup-enabled" className="text-[13px] font-medium text-foreground">
                {t('settings.signupEnabled')}
              </Label>
              <p className="text-[12px] text-muted-foreground max-w-[72ch]">{t('settings.signupEnabledHint')}</p>
            </div>
            <input
              id="signup-enabled"
              type="checkbox"
              checked={scopedAdminSignupEnabled}
              onChange={(e) => setScopedAdminSignupEnabled(e.target.checked)}
              className="h-4 w-4 cursor-pointer"
            />
          </div>
        </div>
        <div className="flex justify-end pt-2 border-t border-border-muted">
          <Button variant="default" disabled={updateMut.isPending} onClick={save}>
            {t('settings.save')}
          </Button>
        </div>
      </AccordionSection>

      {/* ── Section 2: Email ── */}
      <AccordionSection title={t('settings.emailSection')}>
        <div className="space-y-4">
          {/* emailEnabled */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="email-enabled" className="text-[13px] font-medium text-foreground">
                {t('settings.emailEnabled')}
              </Label>
              <p className="text-[12px] text-muted-foreground max-w-[72ch]">{t('settings.emailEnabledHint')}</p>
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
          <FormField
            label={t('settings.emailFrom')}
            hint={t('settings.emailFromHint')}
            htmlFor="email-from"
          >
            <Input
              id="email-from"
              type="email"
              value={emailFromEmail}
              onChange={(e) => setEmailFromEmail(e.target.value)}
            />
          </FormField>

          {/* emailFromName */}
          <FormField
            label={t('settings.emailFromName')}
            hint={t('settings.emailFromNameHint')}
            htmlFor="email-from-name"
          >
            <Input
              id="email-from-name"
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
            />
          </FormField>

          {/* emailDailyCap */}
          <FormField
            label={t('settings.emailDailyCap')}
            hint={t('settings.emailDailyCapHint')}
            htmlFor="email-daily-cap"
          >
            <Input
              id="email-daily-cap"
              type="number"
              min={1}
              value={emailDailyCap}
              onChange={(e) => setEmailDailyCap(Number(e.target.value))}
              className="max-w-[12rem]"
            />
          </FormField>

          {/* API key — read-only status line */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-medium text-foreground">{t('settings.emailApiKey')}</Label>
            <p className="text-[12px] text-muted-foreground max-w-[72ch]">{t('settings.emailApiKeyHint')}</p>
            <p className="text-[13px] font-medium">
              {apiKeyConfigured ? (
                <span className="text-state-completed">
                  ✓ {t('settings.emailApiKeyConfigured')}
                </span>
              ) : (
                <span className="text-state-danger">
                  ✗ {t('settings.emailApiKeyMissing')}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex justify-end pt-4 border-t border-border-muted">
          <Button variant="default" disabled={updateMut.isPending} onClick={save}>
            {t('settings.save')}
          </Button>
        </div>
      </AccordionSection>

      {/* ── Section 3: Demo ── */}
      <AccordionSection title={t('settings.demoSection')}>
        <div className="space-y-4">
          {/* demoMaxActive */}
          <FormField
            label={t('settings.demoMaxActive')}
            hint={t('settings.demoMaxActiveHint')}
            htmlFor="demo-max-active"
          >
            <Input
              id="demo-max-active"
              type="number"
              min={1}
              value={demoMaxActive}
              onChange={(e) => setDemoMaxActive(Number(e.target.value))}
              className="max-w-[12rem]"
            />
          </FormField>

          {/* demoTtlHours */}
          <FormField
            label={t('settings.demoTtlHours')}
            hint={t('settings.demoTtlHoursHint')}
            htmlFor="demo-ttl-hours"
          >
            <Input
              id="demo-ttl-hours"
              type="number"
              min={1}
              value={demoTtlHours}
              onChange={(e) => setDemoTtlHours(Number(e.target.value))}
              className="max-w-[12rem]"
            />
          </FormField>

          {/* demoPerEmailPerDay */}
          <FormField
            label={t('settings.demoPerEmailPerDay')}
            hint={t('settings.demoPerEmailPerDayHint')}
            htmlFor="demo-per-email"
          >
            <Input
              id="demo-per-email"
              type="number"
              min={1}
              value={demoPerEmailPerDay}
              onChange={(e) => setDemoPerEmailPerDay(Number(e.target.value))}
              className="max-w-[12rem]"
            />
          </FormField>

          {/* demoCommentCap */}
          <FormField
            label={t('settings.demoCommentCap')}
            hint={t('settings.demoCommentCapHint')}
            htmlFor="demo-comment-cap"
          >
            <Input
              id="demo-comment-cap"
              type="number"
              min={1}
              value={demoCommentCap}
              onChange={(e) => setDemoCommentCap(Number(e.target.value))}
              className="max-w-[12rem]"
            />
          </FormField>
        </div>
        <div className="flex justify-end pt-4 border-t border-border-muted">
          <Button variant="default" disabled={updateMut.isPending} onClick={save}>
            {t('settings.save')}
          </Button>
        </div>
      </AccordionSection>

      {/* ── Section 4: Extension ── */}
      <AccordionSection title={t('settings.extensionSection')}>
        <div className="space-y-4">
          {/* extensionStoreUrl */}
          <FormField
            label={t('settings.extensionStoreUrl')}
            hint={t('settings.extensionStoreUrlHint')}
            htmlFor="extension-store-url"
          >
            <Input
              id="extension-store-url"
              value={extensionStoreUrl}
              onChange={(e) => setExtensionStoreUrl(e.target.value)}
            />
          </FormField>

          {/* extensionZipUrl */}
          <FormField
            label={t('settings.extensionZipUrl')}
            hint={t('settings.extensionZipUrlHint')}
            htmlFor="extension-zip-url"
          >
            <Input
              id="extension-zip-url"
              value={extensionZipUrl}
              onChange={(e) => setExtensionZipUrl(e.target.value)}
            />
          </FormField>
        </div>
        <div className="flex justify-end pt-4 border-t border-border-muted">
          <Button variant="default" disabled={updateMut.isPending} onClick={save}>
            {t('settings.save')}
          </Button>
        </div>
      </AccordionSection>
      </>
      )}

      {/* ── Section 5: Predefined actions (tenant-wide) ── */}
      <AccordionSection title={t('predefined.section')}>
        <div className="space-y-3">
          <p className="text-[12px] text-muted-foreground max-w-[72ch]">{t('predefined.tenantHelp')}</p>

          {predefinedLoading && (
            <p className="text-[14px] text-muted-foreground">{t('settings.loading')}</p>
          )}

          {!predefinedLoading && predefinedActions.length === 0 && (
            <p className="text-[14px] text-muted-foreground">{t('predefined.empty')}</p>
          )}

          <div className="rounded-md border border-border overflow-hidden">
            {predefinedActions.map((action, idx) => {
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
                  className={`flex flex-col gap-3 px-3 py-2.5 ${idx === 0 ? '' : 'border-t border-border-muted'}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Label className="text-[13px] font-medium text-foreground">{t('predefined.text')}</Label>
                      <Input
                        value={edit.text}
                        onChange={(e) => updateLocalAction(action.id!, 'text', e.target.value)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-6 h-7 w-7 p-0 shrink-0 text-state-danger"
                      onClick={() => deleteActionMut.mutate({ id: action.id! })}
                      disabled={deleteActionMut.isPending}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[13px] font-medium text-foreground">{t('predefined.prompt')}</Label>
                    <textarea
                      value={edit.prompt}
                      onChange={(e) => updateLocalAction(action.id!, 'prompt', e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[14px] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  {edit.dirty && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="default"
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
          </div>

          {/* Add new action */}
          <div className="flex flex-col gap-3 rounded-md border border-border border-dashed px-3 py-2.5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[13px] font-medium text-foreground">{t('predefined.text')}</Label>
              <Input
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                placeholder={t('predefined.text')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[13px] font-medium text-foreground">{t('predefined.prompt')}</Label>
              <textarea
                value={newActionPrompt}
                onChange={(e) => setNewActionPrompt(e.target.value)}
                rows={2}
                placeholder={t('predefined.prompt')}
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[14px] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                disabled={!newActionText.trim() || addActionMut.isPending}
                onClick={addAction}
                type="button"
              >
                <Plus className="h-4 w-4" />
                {t('predefined.add')}
              </Button>
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* ── Section 6: Suggestions review (admin only) ── */}
      {isAdmin && <SuggestionsCard />}

      {/* ── Section 7: AI Roles & Rules (workspace admins/deputies, not super admin) ── */}
      {!isSuperAdmin && <AiRulesCard />}
    </div>
  );
}
