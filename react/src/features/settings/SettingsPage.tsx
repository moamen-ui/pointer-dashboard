// Settings admin page — reachable by any admin, but the first three sections
// (Access, Email, Demo — instance-wide settings, one "Save changes" button PUTs the whole
// UpdateSettingsRequest) are super-admin only, matching the backend's SettingsController policy.
// Predefined actions (tenant-wide, projectId == null) and the suggestions review section below
// are available to any admin.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
  usePostApiAdminPredefinedActionSuggestionsIdRequestChanges,
  type SuggestionResponse,
  useGetApiAdminAiRulesTenant,
  getGetApiAdminAiRulesTenantQueryKey,
  usePostApiAdminAiRules,
  usePutApiAdminAiRulesId,
  useDeleteApiAdminAiRulesId,
  type AiRuleResponse,
} from '@moamen-ui/pointer-react';
import { CheckCircle2, XCircle, EllipsisVertical, MessageSquareText } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { CommentFieldsCard } from './CommentFieldsCard';
import { WorkspaceNameCard } from './WorkspaceNameCard';
import { DangerZoneCard } from './DangerZoneCard';
import { OperatorAccessCard, ImpersonationSessionsCard } from './ImpersonationCards';
import { AccordionSection } from '@/components/ui/accordion-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/components/shared/FormField';
import { AiRulesTable, type AiRuleRowModel } from '@/components/shared/AiRulesTable';
import {
  PredefinedActionsTable,
  type PredefinedActionRowModel,
  type PredefinedActionField,
} from '@/components/shared/PredefinedActionsTable';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySettings = any;

// ---- Suggestions review card (admin-only) ----
function SuggestionsCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const deepLinked = searchParams.get('section') === 'suggestions';

  const { data: suggestionsRaw = [], isLoading, isError } =
    useGetApiAdminPredefinedActionSuggestions();
  const suggestions: SuggestionResponse[] = suggestionsRaw as SuggestionResponse[];

  // status 1 = Pending, 2 = Approved, 3 = Rejected, 4 = ChangesRequested (from SuggestionStatus enum)
  const open = suggestions.filter((s) => s.status === 1 || s.status === 4);
  const pendingCount = suggestions.filter((s) => s.status === 1).length;

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

  // "Ask for edit" dialog state — the admin writes feedback, the API flips the
  // suggestion to ChangesRequested (4) and notifies the suggester.
  const [askTarget, setAskTarget] = useState<SuggestionResponse | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackTouched, setFeedbackTouched] = useState(false);

  const requestChangesMut = usePostApiAdminPredefinedActionSuggestionsIdRequestChanges({
    mutation: {
      onSuccess: () => {
        toast(t('suggestions.feedbackSent'));
        closeAskDialog();
        reloadSuggestions();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  function openAskDialog(s: SuggestionResponse) {
    setAskTarget(s);
    setFeedback('');
    setFeedbackTouched(false);
  }

  function closeAskDialog() {
    setAskTarget(null);
    setFeedback('');
    setFeedbackTouched(false);
  }

  function submitFeedback() {
    setFeedbackTouched(true);
    const trimmed = feedback.trim();
    if (!askTarget || !trimmed) return;
    requestChangesMut.mutate({ id: askTarget.id!, data: { feedback: trimmed } });
  }

  // Deep link from the notifications bell (`/settings?section=suggestions`) — open the
  // section by default and bring it into view.
  useEffect(() => {
    if (deepLinked) {
      document.getElementById('suggestions')?.scrollIntoView({ block: 'start' });
    }
  }, [deepLinked]);

  const sectionTitle = t('suggestions.section');

  return (
    <div id="suggestions">
      <AccordionSection
        defaultOpen={deepLinked}
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
        {!isLoading && !isError && open.length === 0 && (
          <p className="text-[14px] text-muted-foreground">{t('suggestions.empty')}</p>
        )}

        {open.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('suggestions.project')}</TableHead>
                <TableHead>{t('suggestions.by')}</TableHead>
                <TableHead>{t('predefined.text')}</TableHead>
                <TableHead>{t('predefined.prompt')}</TableHead>
                <TableHead>{t('suggestions.status')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {open.map((s) => (
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
                  <TableCell className="text-[14px]">
                    {s.status === 4 ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant="warning">{t('suggestions.statusChangesRequested')}</Badge>
                        {s.adminFeedback && (
                          <span
                            className="max-w-[200px] truncate text-[12px] text-muted-foreground"
                            title={s.adminFeedback}
                          >
                            {s.adminFeedback}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge variant="open">{t('suggestions.statusPending')}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.status === 1 && (
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
                          <DropdownMenuItem
                            className="text-muted-foreground"
                            onSelect={() => openAskDialog(s)}
                          >
                            <MessageSquareText className="h-4 w-4" />
                            {t('suggestions.askForEdit')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AccordionSection>

      <Dialog open={!!askTarget} onOpenChange={(o) => !o && closeAskDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('suggestions.askForEdit')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <p className="text-[12px] text-muted-foreground">{t('suggestions.askForEditHint')}</p>
            <div className="text-[13px]">
              <span className="font-medium">{askTarget?.text ?? '—'}</span>
              {askTarget?.projectName && (
                <span className="text-muted-foreground"> · {askTarget.projectName}</span>
              )}
            </div>
            <FormField
              label={t('suggestions.feedback')}
              htmlFor="ask-feedback"
              error={feedbackTouched && !feedback.trim() ? t('suggestions.feedbackRequired') : undefined}
            >
              <textarea
                id="ask-feedback"
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </FormField>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeAskDialog}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!feedback.trim() || requestChangesMut.isPending}
              onClick={submitFeedback}
            >
              {t('suggestions.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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

  const savingRuleId = (putMut.variables as { id?: number } | undefined)?.id;
  const ruleRows: AiRuleRowModel[] = rules.map((rule) => {
    const edit = localRules[rule.id!];
    return {
      id: rule.id!,
      title: edit?.title ?? rule.title ?? '',
      prompt: edit?.prompt ?? rule.prompt ?? '',
      isActive: edit?.isActive ?? rule.isActive ?? true,
      dirty: edit?.dirty ?? false,
      saving: putMut.isPending && savingRuleId === rule.id,
    };
  });

  return (
    <AccordionSection title={t('aiRules.section')}>
      <div className="space-y-3">
        <p className="text-[12px] text-muted-foreground max-w-[72ch]">{t('aiRules.tenantHelp')}</p>

        {isLoading && rules.length === 0 && (
          <p className="text-[12px] text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</p>
        )}

        <AiRulesTable
          rows={ruleRows}
          onFieldChange={(id, field, value) => updateRule(id, field, value)}
          onSave={(id) => saveRule(id)}
          onReset={(id) =>
            // Comment #91: Cancel acts as a reset — back to the saved (server) values.
            setLocalRules((prev) => {
              const server = rules.find((r) => r.id === id);
              if (!server) return prev;
              return {
                ...prev,
                [id]: {
                  ...(prev[id] ?? { id }),
                  title: server.title ?? '',
                  prompt: server.prompt ?? '',
                  isActive: server.isActive ?? true,
                  dirty: false,
                },
              };
            })
          }
          onDelete={(id) => deleteMut.mutate({ id })}
          onCreate={(draft) =>
            createMut.mutateAsync({
              data: { title: draft.title, prompt: draft.prompt, sortOrder: rules.length },
            })
          }
          addLabel={t('aiRules.addRule')}
          creating={createMut.isPending}
          deleting={deleteMut.isPending}
          emptyMessage={t('aiRules.empty')}
        />

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
  const [appBaseUrl, setAppBaseUrl] = useState('');
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
    setAppBaseUrl(settings.appBaseUrl ?? '');
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
  type EditableAction = {
    text: string;
    prompt: string;
    isActive: boolean;
    dirty: boolean;
  };

  const [localEdits, setLocalEdits] = useState<Record<number, EditableAction>>({});

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
          next[a.id] = {
            text: a.text ?? '',
            prompt: a.prompt ?? '',
            isActive: a.isActive ?? true,
            dirty: false,
          };
          added = true;
        }
      }
      // Returning `prev` unchanged lets React bail out instead of re-rendering, so a
      // no-op seed cannot feed itself another pass.
      return added ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPredefined]);

  function updateLocalAction(id: number, field: PredefinedActionField, value: string | boolean) {
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

  function saveAction(actionId: number) {
    const edit = localEdits[actionId];
    if (!edit) return;
    patchActionMut.mutate({
      id: actionId,
      data: {
        text: edit.text.trim(),
        prompt: edit.prompt.trim(),
        isActive: edit.isActive,
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
        reloadPredefined();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  const actionRows: PredefinedActionRowModel[] = predefinedActions.map((action) => {
    const edit = localEdits[action.id!];
    return {
      id: action.id!,
      text: edit?.text ?? action.text ?? '',
      prompt: edit?.prompt ?? action.prompt ?? '',
      isActive: edit?.isActive ?? action.isActive ?? true,
      dirty: edit?.dirty ?? false,
      saving:
        patchActionMut.isPending &&
        (patchActionMut.variables as { id?: number } | undefined)?.id === action.id,
    };
  });

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
        appBaseUrl,
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

          {/* App base URL (for invitation links) */}
          <FormField
            label={t('settings.appBaseUrl')}
            hint={t('settings.appBaseUrlHint')}
            htmlFor="app-base-url"
          >
            <Input
              id="app-base-url"
              value={appBaseUrl}
              onChange={(e) => setAppBaseUrl(e.target.value)}
              placeholder="e.g. https://dashboard.pointer.moamen.work"
            />
          </FormField>
          {settings && 'effectiveAppBaseUrl' in settings && settings.effectiveAppBaseUrl && (
            <div className="text-[12px] text-muted-foreground">
              {t('settings.effectiveAppBaseUrl')}: <code className="bg-gutter px-1 rounded">{String(settings.effectiveAppBaseUrl)}</code>
            </div>
          )}
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

          {predefinedLoading && predefinedActions.length === 0 && (
            <p className="text-[12px] text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</p>
          )}

          <PredefinedActionsTable
            rows={actionRows}
            onFieldChange={(id, field, value) => updateLocalAction(id, field, value)}
            onSave={(id) => saveAction(id)}
            onDelete={(id) => deleteActionMut.mutate({ id })}
            onCreate={(draft) =>
              addActionMut.mutateAsync({
                data: {
                  text: draft.text,
                  prompt: draft.prompt,
                  isActive: true,
                  sortOrder: predefinedActions.length,
                },
              })
            }
            addLabel={t('predefined.add')}
            creating={addActionMut.isPending}
            deleting={deleteActionMut.isPending}
            emptyMessage={t('predefined.empty')}
          />
        </div>
      </AccordionSection>

      {/* ── Section 6: Suggestions review (admin only) ── */}
      {isAdmin && <SuggestionsCard />}

      {/* ── Section 6a: Workspace name (workspace admins, not super admin — DB-03b) ── */}
      {isAdmin && !isSuperAdmin && <WorkspaceNameCard />}

      {/* ── Section 6a-2: Danger zone (Workspace Admin only, not Deputy/stakeholder — DB-18).
          DangerZoneCard itself renders null unless the server says `canManageLifecycle` (already
          false for a Deputy or a live demo), so the `isAdmin && !isSuperAdmin` gate here is just
          the cheap client-side pre-filter every other workspace-admin-only card uses. ── */}
      {isAdmin && !isSuperAdmin && <DangerZoneCard />}

      {/* ── Section 6b: Comment fields (workspace admins, not super admin — the API refuses them) ── */}
      {isAdmin && !isSuperAdmin && <CommentFieldsCard />}

      {/* ── Section 7: AI Roles & Rules (workspace admins/deputies, not super admin) ── */}
      {!isSuperAdmin && <AiRulesCard />}

      {/* ── Section 8: Operator access (DB-13, workspace admins — their own workspace's
          impersonation sessions, read-only, no operator identity per D13.6) ── */}
      {isAdmin && !isSuperAdmin && <OperatorAccessCard />}

      {/* ── Section 8b: Impersonation sessions (DB-13, super admin — every workspace, End on
          the live one) ── */}
      {isSuperAdmin && <ImpersonationSessionsCard />}
    </div>
  );
}
