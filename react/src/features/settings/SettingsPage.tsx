// Settings admin page — super-admin only.
// Three-section form: Access, Email, Demo. Loads current settings into local state;
// one "Save changes" button PUTs the whole UpdateSettingsRequest.
// Phase B: Predefined actions section at the bottom (tenant-wide, projectId == null).
// Phase C: Invite teammates section.
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
  useGetApiAdminInvites,
  usePostApiAdminInvites,
  useDeleteApiAdminInvitesId,
  getGetApiAdminInvitesQueryKey,
  type InviteResponse,
  useGetApiAdminRoles,
  type RoleResponse,
} from '@moamen-ui/pointer-react';
import { Plus, Trash2, Copy, Link } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySettings = any;

// ---- Invite teammates card (extracted for readability) ----
function InviteCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: rolesRaw = [], isLoading: rolesLoading } = useGetApiAdminRoles();
  const nonAdminRoles: RoleResponse[] = (rolesRaw as RoleResponse[]).filter(
    (r) => !r.grantsAdmin && r.isActive,
  );

  const { data: invitesRaw, isLoading: invitesLoading, isError: invitesError } =
    useGetApiAdminInvites();
  const invites: InviteResponse[] = (invitesRaw as InviteResponse[] | undefined) ?? [];

  const reloadInvites = () =>
    void qc.invalidateQueries({ queryKey: getGetApiAdminInvitesQueryKey() });

  // ---- Create form state ----
  const [roleId, setRoleId] = useState<string>('');
  const [email, setEmail] = useState('');
  const [expiresDays, setExpiresDays] = useState<string>('7');
  const [maxUses, setMaxUses] = useState<string>('');
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const createMut = usePostApiAdminInvites({
    mutation: {
      onSuccess: (res) => {
        const inv = res as unknown as InviteResponse;
        setCreatedUrl(inv.url ?? null);
        toast(t('invite.created'));
        reloadInvites();
        // Reset form
        setRoleId('');
        setEmail('');
        setExpiresDays('7');
        setMaxUses('');
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  function createInvite() {
    if (!roleId) return;
    createMut.mutate({
      data: {
        roleId: Number(roleId),
        email: email.trim() || undefined,
        expiresInDays: expiresDays ? Number(expiresDays) : undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
      },
    });
  }

  function copyUrl(url: string) {
    void navigator.clipboard.writeText(url).then(() => toast(t('invite.copied')));
  }

  const revokeMut = useDeleteApiAdminInvitesId({
    mutation: {
      onSuccess: () => {
        toast(t('invite.revoked'));
        reloadInvites();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  function formatDate(iso: string | undefined) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <h3 className="text-sm font-semibold">{t('invite.section')}</h3>
        <p className="text-xs text-muted-foreground">{t('invite.sectionHint')}</p>

        {/* Create form */}
        <div className="flex flex-col gap-3 rounded-md border border-dashed border-border p-4">
          {/* Role select */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t('invite.role')}</Label>
            {rolesLoading ? (
              <p className="text-xs text-muted-foreground">{t('settings.loading')}</p>
            ) : (
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('invite.role')} />
                </SelectTrigger>
                <SelectContent>
                  {nonAdminRoles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Optional email */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t('invite.email')}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
          </div>

          {/* Expires in days */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t('invite.expiresDays')}</Label>
            <Input
              type="number"
              min={1}
              value={expiresDays}
              onChange={(e) => setExpiresDays(e.target.value)}
              className="max-w-[12rem]"
            />
          </div>

          {/* Max uses */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t('invite.maxUses')}</Label>
            <Input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="∞"
              className="max-w-[12rem]"
            />
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!roleId || createMut.isPending}
              onClick={createInvite}
              type="button"
            >
              <Link className="h-4 w-4" />
              {t('invite.create')}
            </Button>
          </div>
        </div>

        {/* Newly created invite URL */}
        {createdUrl && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <p className="flex-1 truncate text-xs font-mono">{createdUrl}</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyUrl(createdUrl)}
              type="button"
            >
              <Copy className="h-4 w-4" />
              {t('invite.copy')}
            </Button>
          </div>
        )}

        {/* Invite list */}
        {invitesLoading && (
          <p className="text-sm text-muted-foreground">{t('settings.loading')}</p>
        )}
        {invitesError && (
          <p className="text-sm text-destructive">{t('settings.loadError')}</p>
        )}
        {!invitesLoading && !invitesError && invites.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('invite.empty')}</p>
        )}
        {invites.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('invite.role')}</TableHead>
                <TableHead>{t('invite.email')}</TableHead>
                <TableHead>{t('invite.expires')}</TableHead>
                <TableHead>{t('invite.uses')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.roleName ?? '—'}</TableCell>
                  <TableCell>{inv.email ?? t('invite.anyone')}</TableCell>
                  <TableCell>{formatDate(inv.expiresAt)}</TableCell>
                  <TableCell>
                    {inv.uses ?? 0}/{inv.maxUses ?? '∞'}
                  </TableCell>
                  <TableCell className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyUrl(inv.url ?? '')}
                      disabled={!inv.url}
                      type="button"
                    >
                      <Copy className="h-4 w-4" />
                      {t('invite.copy')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => revokeMut.mutate({ id: inv.id! })}
                      disabled={revokeMut.isPending}
                      type="button"
                    >
                      {t('invite.revoke')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
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
  const [localEdits, setLocalEdits] = useState<
    Record<number, { text: string; prompt: string; dirty: boolean }>
  >({});
  const [newActionText, setNewActionText] = useState('');
  const [newActionPrompt, setNewActionPrompt] = useState('');

  const reloadPredefined = () =>
    void qc.invalidateQueries({ queryKey: getGetApiAdminPredefinedActionsQueryKey() });

  const { data: rawPredefined = [], isLoading: predefinedLoading } =
    useGetApiAdminPredefinedActions();
  const predefinedActions = rawPredefined.filter((a) => a.projectId == null);

  // Seed local edit state when server data arrives (only for items not already edited)
  useEffect(() => {
    setLocalEdits((prev) => {
      const next = { ...prev };
      for (const a of predefinedActions) {
        if (a.id != null && !(a.id in next)) {
          next[a.id] = { text: a.text ?? '', prompt: a.prompt ?? '', dirty: false };
        }
      }
      return next;
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
        </CardContent>
      </Card>

      {/* ── Section 5: Invite teammates ── */}
      <InviteCard />
    </div>
  );
}
