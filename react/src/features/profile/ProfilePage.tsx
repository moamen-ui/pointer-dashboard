// User profile page.
// • /profile           → self-profile (authenticated, any role)
// • /users/:id/profile → admin view of another user (admin only)
//
// Query gating:
//   isAdmin && id != null  → useGetApiAdminUsersIdProfile (enabled)
//   otherwise              → useGetApiMeProfile            (enabled)
import { Fragment, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useGetApiMeProfile,
  useGetApiAdminUsersIdProfile,
  useGetApiMeApiKey,
  usePostApiMeApiKeyRegenerate,
  useGetApiAuthMe,
  usePostApiMeLeaveWorkspace,
  useDeleteApiMe,
  usePostApiMeRequestErase,
  usePostApiMeChangeEmail,
  usePostApiMeChangePassword,
  usePostApiMeVerificationResend,
  type ProfileProject,
  type ProfileEnvironment,
} from '@moamen-ui/pointer-react';
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Key,
  Eye,
  EyeOff,
  LogOut,
  Trash2,
  Mail,
  MailPlus,
  KeyRound,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/shared/FormField';
import { passwordError } from '@/lib/validators';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useStatusCatalog } from '@/lib/status-catalog';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { extractMessage } from '@/lib/error';
import { CountCell, DiffstatLine, statusTone, toneHeaderClass, toneTextClass } from '@/components/shared/CountCell';
import { useMediaQuery, MOBILE_QUERY } from '@/lib/useMediaQuery';
import { MfaCard } from './MfaCard';

const ENV_LABEL: Record<number, string> = {
  1: 'Local',
  2: 'Staging',
  3: 'Production',
};

function envLabel(env: number | undefined): string {
  if (env == null) return '—';
  return ENV_LABEL[env] ?? String(env);
}

// ---- Expandable environment row ----
function EnvRows({ environments, catalog }: { environments: ProfileEnvironment[]; catalog: ReturnType<typeof useStatusCatalog> }) {
  return (
    <>
      {environments.map((env) => (
        <TableRow key={env.environment} className="h-11 border-t border-border-muted bg-gutter/30">
          <TableCell className="w-10 px-3" />
          <TableCell className="ps-12 text-[14px] text-muted-foreground italic">
            {envLabel(env.environment)}
          </TableCell>
          <TableCell className="font-mono text-[14px]">{env.comments ?? 0}</TableCell>
          <TableCell className="font-mono text-[14px]">{env.replies ?? 0}</TableCell>
          {catalog.items.map((s) => (
            <TableCell
              key={s.value}
              className={cn(
                'font-mono text-[14px]',
                getEnvStatusCount(env, s.value) > 0
                  ? toneTextClass(statusTone(s.value))
                  : 'text-faint-foreground',
              )}
            >
              {getEnvStatusCount(env, s.value)}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, switchWorkspace, logout } = useAuth();
  const catalog = useStatusCatalog();
  const { toast } = useToast();
  const isMobile = useMediaQuery(MOBILE_QUERY);

  // Parse numeric id from route params
  const numericId = id != null && id !== '' ? Number(id) : null;
  const showAdmin = isAdmin && numericId != null;

  // Gate queries with `enabled` per the task spec
  const meQuery = useGetApiMeProfile({ query: { enabled: !showAdmin } });
  const adminQuery = useGetApiAdminUsersIdProfile(numericId ?? 0, {
    query: { enabled: showAdmin },
  });

  const { data, isFetching, refetch } = showAdmin ? adminQuery : meQuery;

  // DB-11c danger zone (self-view only, never on an admin's view of someone else, and never for a
  // super admin — they aren't a member of a workspace to leave or a tenant identity to self-erase).
  const showDangerZone = !showAdmin && !isSuperAdmin;
  // R5-61: the Two-factor card is the mirror-image case — self-view only, and ONLY for a super
  // admin (§3.4: MFA is scoped to the one env-seeded super-admin account). `me.mfaEnabled` drives
  // its Off/On state, so the query below is enabled for any self-view, not just the danger zone.
  const showMfa = !showAdmin && isSuperAdmin;
  const { data: me } = useGetApiAuthMe({ query: { enabled: !showAdmin, staleTime: 5 * 60_000 } });
  const [dangerError, setDangerError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [eraseLinkNotice, setEraseLinkNotice] = useState(false);

  const leaveMut = usePostApiMeLeaveWorkspace({
    mutation: {
      onSuccess: () => {
        setConfirmLeave(false);
        // Switch to another live membership if one exists (mirrors the Shell's workspace
        // switcher); otherwise there is nothing left to open, so sign out.
        const other = (me?.workspaces ?? []).find((w) => w.workspaceId !== me?.workspaceId);
        if (other?.workspaceId) {
          switchWorkspace(other.workspaceId)
            .then(() => navigate('/', { replace: true }))
            .catch(() => {
              logout();
              navigate('/login', { replace: true });
            });
        } else {
          toast(t('profile.leftWorkspace'), 'success');
          logout();
          navigate('/login', { replace: true });
        }
      },
      onError: (e: unknown) => {
        setConfirmLeave(false);
        setDangerError(extractMessage(e));
      },
    },
  });

  const deleteAccountMut = useDeleteApiMe({
    mutation: {
      onSuccess: () => {
        setConfirmDeleteOpen(false);
        logout();
        navigate('/login', {
          replace: true,
          state: { message: t('profile.accountDeleted') },
        });
      },
      onError: (e: unknown) => {
        setConfirmDeleteOpen(false);
        setDangerError(extractMessage(e));
      },
    },
  });

  const requestEraseMut = usePostApiMeRequestErase({
    mutation: {
      onSuccess: () => {
        setEraseLinkNotice(true);
        toast(t('profile.eraseLinkSent'), 'success');
      },
      onError: (e: unknown) => setDangerError(extractMessage(e)),
    },
  });

  // DB-11d change e-mail — same gate as the danger zone (self-view, not a super admin), plus
  // passwordless (quick-access) identities: the server refuses both anyway (§3.1), this just
  // saves the round-trip and the confusing error. `me` is already fetched under `showDangerZone`.
  const showChangeEmail = showDangerZone && !me?.isQuickAccess;
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [changeEmailPassword, setChangeEmailPassword] = useState('');
  const [changeEmailNewAddress, setChangeEmailNewAddress] = useState('');
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null);
  const [changeEmailSentTo, setChangeEmailSentTo] = useState<string | null>(null);

  const changeEmailMut = usePostApiMeChangeEmail({
    mutation: {
      // The generated client unwraps the success envelope down to `data.data`, which is
      // undefined for a bare `Result` (no inner payload) — same shape DeleteAccountPage
      // documents — so on success we show our own copy (mirrors the server's fixed
      // `User.EmailChangeLinkSent` message) rather than a value we no longer have access to.
      onSuccess: () => {
        setChangeEmailSentTo(changeEmailNewAddress.trim());
        setChangeEmailError(null);
        toast(t('profile.changeEmailSent'), 'success');
      },
      onError: (e: unknown) => setChangeEmailError(extractMessage(e)),
    },
  });

  function openChangeEmail() {
    setChangeEmailPassword('');
    setChangeEmailNewAddress('');
    setChangeEmailError(null);
    setChangeEmailSentTo(null);
    setChangeEmailOpen(true);
  }

  function submitChangeEmail() {
    if (!changeEmailPassword || !changeEmailNewAddress.trim()) return;
    changeEmailMut.mutate({
      data: { currentPassword: changeEmailPassword, newEmail: changeEmailNewAddress.trim() },
    });
  }

  // DB-14 — change password. Same gate/shape as change e-mail (self-view, not a super admin,
  // not a passwordless identity — there is no password to change). `AuthService.
  // ChangePasswordAsync` bumps the security stamp on success, invalidating every existing
  // session for this identity including this one (H1), so the only sane next step is sign out
  // and send the person back to /login, same as a completed password reset.
  const showChangePassword = showDangerZone && !me?.isQuickAccess;
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);

  const newPasswordErrorMsg = passwordError(newPassword, 10, t);
  const newPasswordMismatch = !!newPassword && !!confirmNewPassword && newPassword !== confirmNewPassword;
  const changePasswordInvalid =
    !currentPassword || !!newPasswordErrorMsg || !confirmNewPassword || newPasswordMismatch;

  const changePasswordMut = usePostApiMeChangePassword({
    mutation: {
      onSuccess: () => {
        setChangePasswordOpen(false);
        logout();
        navigate('/login', {
          replace: true,
          state: { message: t('changePassword.success') },
        });
      },
      onError: (e: unknown) => setChangePasswordError(extractMessage(e)),
    },
  });

  function openChangePassword() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setChangePasswordError(null);
    setChangePasswordOpen(true);
  }

  function submitChangePassword() {
    if (changePasswordInvalid) return;
    changePasswordMut.mutate({
      data: { currentPassword, newPassword },
    });
  }

  // DB-14 §11.1 soft hint — stakeholders (non-admin, unverified) are never shown the loud Shell
  // banner (`emailVerificationRequired` is false for them, §3.5), but still get a quiet, once-
  // per-session-dismissible nudge here on their own profile.
  const showSoftVerifyHint =
    showDangerZone && me?.emailVerified === false && !me?.emailVerificationRequired;
  const [softHintDismissed, setSoftHintDismissed] = useState(false);
  const softResendMut = usePostApiMeVerificationResend({
    mutation: {
      onSuccess: () => toast(t('verification.resendSent'), 'success'),
      onError: (e: unknown) => {
        const status = (e as { response?: { status?: number } })?.response?.status;
        toast(status === 429 ? t('common.tooManyRequests') : extractMessage(e), 'warning');
      },
    },
  });

  function confirmLeaveWorkspace() {
    setDangerError(null);
    leaveMut.mutate();
  }
  function openDeleteAccount() {
    setDangerError(null);
    setDeletePassword('');
    setConfirmDeleteOpen(true);
  }
  function submitDeleteAccount() {
    if (!deletePassword) return;
    deleteAccountMut.mutate({ data: { password: deletePassword } });
  }

  // API key state
  const keyQuery = useGetApiMeApiKey();
  const [revealKey, setRevealKey] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const regenerateMut = usePostApiMeApiKeyRegenerate({
    mutation: {
      onSuccess: () => {
        // Reveal the new key immediately: user just asked for it, old value is dead
        setRevealKey(true);
        keyQuery.refetch();
        toast(t('profile.apiKeyRegenerated'), 'success');
      },
      onError: () => {
        toast(t('profile.error'), 'error');
      },
    },
  });

  const profileUser = data?.user;
  const totals = data?.totals;
  const projects = data?.projects ?? [];

  // API key helpers
  const apiKey = keyQuery.data?.apiKey;
  const maskedKey = (() => {
    if (!apiKey) return '';
    // Use server's prefix when it exists, otherwise first 12 chars
    const prefix = keyQuery.data?.prefix || apiKey.slice(0, 12);
    return `${prefix}${'•'.repeat(24)}`;
  })();

  const lastUsedLabel = (() => {
    const value = keyQuery.data?.lastUsedAt;
    if (!value) return t('profile.apiKeyNeverUsed');
    return new Date(value).toLocaleString();
  })();

  async function copyKey(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('profile.copied'), 'success');
    } catch {
      toast(t('demo.copyFailed'), 'error');
    }
  }

  function handleRegenerateClick() {
    setConfirmRegenerate(true);
  }

  function handleRegenerateConfirm() {
    setConfirmRegenerate(false);
    regenerateMut.mutate();
  }

  // Expandable env state: set of expanded project ids
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Build diffstat items: projects · comments · replies · open · ready · completed · archived
  const diffstatItems = [
    { label: t('profile.projects'), count: totals?.projectsInvolved ?? 0 },
    { label: t('profile.comments'), count: totals?.comments ?? 0 },
    { label: t('profile.replies'), count: totals?.replies ?? 0 },
    ...[
      [1, totals?.open ?? 0],
      [2, totals?.readyToApply ?? 0],
      [3, totals?.applied ?? 0],
      [4, totals?.archived ?? 0],
    ].map(([value, count]) => {
      const status = catalog.items.find((x) => x.value === value);
      return {
        label: status ? catalog.displayLabel(status) : t(`overview.${['open', 'pending', 'completed', 'archived'][(value as number) - 1]}`),
        count: count as number,
        tone: statusTone(value as number),
      };
    }),
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* API key section — first, because it is the one thing on this page a person comes here to copy.
           Masked by default: it is a bearer credential, and this page is as likely to be open on a
           shared screen as any other. */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[15px] font-semibold leading-6">{t('profile.apiKey')}</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerateClick}
            disabled={keyQuery.isPending || !apiKey || regenerateMut.isPending}
          >
            {regenerateMut.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : null}
            {t('profile.regenerateApiKey')}
          </Button>
        </div>

        <p className="mt-1 text-[13px] text-muted-foreground">{t('profile.apiKeyHint')}</p>

        {keyQuery.isPending ? (
          <p className="mt-3 text-[13px] text-muted-foreground">{t('profile.loading')}</p>
        ) : apiKey ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-[16rem] rounded-md border border-border bg-gutter px-3 py-2 font-mono text-[13px] break-all">
                {revealKey ? apiKey : maskedKey}
              </code>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRevealKey(!revealKey)}
              >
                {revealKey ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    {t('install.wizard.hide')}
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    {t('install.wizard.reveal')}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyKey(apiKey)}
              >
                {t('profile.copyApiKey')}
              </Button>
            </div>

            <p className="mt-2 text-[12px] text-muted-foreground">
              {t('profile.apiKeyLastUsed')}:
              <span className="font-mono"> {lastUsedLabel}</span>
            </p>
          </>
        ) : (
          <p className="mt-3 text-[13px] text-muted-foreground">{t('profile.apiKeyUnavailable')}</p>
        )}
      </section>

      {/* R5-61: Two-factor authentication — self-view, super admin only. */}
      {showMfa && <MfaCard mfaEnabled={!!me?.mfaEnabled} />}

      {/* Header with title and refresh */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold">
            {profileUser?.displayName ?? t('profile.title')}
          </h1>
          {profileUser?.email && (
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
              <span>
                {profileUser.email}
                {profileUser.roleName ? ` · ${profileUser.roleName}` : ''}
              </span>
              {showChangeEmail && (
                <button
                  type="button"
                  onClick={openChangeEmail}
                  className="text-[13px] text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  {t('profile.changeEmail')}
                </button>
              )}
              {showChangePassword && (
                <button
                  type="button"
                  onClick={openChangePassword}
                  className="text-[13px] text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  {t('profile.changePassword')}
                </button>
              )}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* DB-14 §11.1: quiet, dismissible nudge for unverified stakeholders (the loud Shell
          banner only ever shows for identities the gate blocks — never these). */}
      {showSoftVerifyHint && !softHintDismissed && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-state-ready/30 bg-state-ready-tint px-3 py-2 text-[13px] text-state-ready">
          <span>{t('verification.softHintText')}</span>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              disabled={softResendMut.isPending}
              onClick={() => softResendMut.mutate()}
              className="font-medium underline hover:opacity-75"
            >
              {t('verification.resendLink')}
            </button>
            <button
              type="button"
              aria-label={t('verification.dismiss')}
              onClick={() => setSoftHintDismissed(true)}
              className="hover:opacity-75"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Diffstat line: projects · comments · replies · open · ready · completed · archived */}
      <DiffstatLine items={diffstatItems} />

      {/* Projects section */}
      <div className="space-y-3">
        <h2 className="text-[16px] font-semibold leading-6">{t('overview.projects')}</h2>
        {isMobile ? (
          // Below `md` this list is never a horizontally-scrolling table (DESIGN.md
          // target 1): one bordered card per project, name as the title, comments/
          // replies/status counts as a compact label/value list, environments (when
          // present) expand into nested mini-cards under the same toggle.
          <div className="flex flex-col gap-2">
            {projects.map((proj: ProfileProject) => {
              const projId = proj.projectId ?? 0;
              const hasEnvs = (proj.environments?.length ?? 0) > 0;
              const isOpen = expanded.has(projId);
              return (
                <div key={projId} className="rounded-md border border-border bg-card p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {hasEnvs ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(projId)}
                          className="flex h-11 w-11 shrink-0 -m-2 items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label={isOpen ? 'Collapse environments' : 'Expand environments'}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      <span className="min-w-0 break-words text-[14px] font-medium">{proj.name ?? proj.key}</span>
                    </div>
                    {proj.key && proj.name && (
                      <code className="shrink-0 rounded bg-gutter px-1.5 py-0.5 font-mono text-[13px]">
                        {proj.key}
                      </code>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                    <span className="text-muted-foreground">{t('overview.comments')}</span>
                    <span className="text-end font-mono">{proj.comments ?? 0}</span>
                    <span className="text-muted-foreground">{t('profile.replies')}</span>
                    <span className="text-end font-mono">{proj.replies ?? 0}</span>
                    {catalog.items.map((s) => (
                      <Fragment key={s.value}>
                        <span className="text-muted-foreground">{catalog.displayLabel(s)}</span>
                        <span className="text-end">
                          <CountCell count={getProjectStatusCount(proj, s.value)} tone={statusTone(s.value)} />
                        </span>
                      </Fragment>
                    ))}
                  </div>

                  {isOpen && hasEnvs && (
                    <div className="flex flex-col gap-2 border-t border-border-muted pt-2">
                      {(proj.environments ?? []).map((env) => (
                        <div key={env.environment} className="rounded-md bg-gutter/40 p-2 flex flex-col gap-1">
                          <span className="text-[13px] italic text-muted-foreground">{envLabel(env.environment)}</span>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                            <span className="text-muted-foreground">{t('overview.comments')}</span>
                            <span className="text-end font-mono">{env.comments ?? 0}</span>
                            <span className="text-muted-foreground">{t('profile.replies')}</span>
                            <span className="text-end font-mono">{env.replies ?? 0}</span>
                            {catalog.items.map((s) => (
                              <Fragment key={s.value}>
                                <span className="text-muted-foreground">{catalog.displayLabel(s)}</span>
                                <span
                                  className={cn(
                                    'text-end font-mono',
                                    getEnvStatusCount(env, s.value) > 0
                                      ? toneTextClass(statusTone(s.value))
                                      : 'text-faint-foreground',
                                  )}
                                >
                                  {getEnvStatusCount(env, s.value)}
                                </span>
                              </Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {projects.length === 0 && !isFetching && (
              <p className="rounded-md border border-dashed border-border-muted p-3 text-[14px] text-muted-foreground">
                {t('profile.noProjects')}
              </p>
            )}
          </div>
        ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader className="[&_tr]:bg-gutter [&_tr]:border-0">
              <TableRow className="h-10 bg-gutter">
                <TableHead className="text-[13px] font-medium text-muted-foreground" />
                <TableHead className="text-[13px] font-medium text-muted-foreground">{t('overview.name')}</TableHead>
                <TableHead className="text-[13px] font-medium text-muted-foreground">{t('overview.comments')}</TableHead>
                <TableHead className="text-[13px] font-medium text-muted-foreground">{t('profile.replies')}</TableHead>
                {catalog.items.map((s) => (
                  <TableHead key={s.value} className={cn('text-[13px] font-medium', toneHeaderClass(statusTone(s.value)))}>
                    {catalog.displayLabel(s)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr]:border-b-0">
              {projects.map((proj: ProfileProject, idx: number) => {
                const projId = proj.projectId ?? 0;
                const hasEnvs = (proj.environments?.length ?? 0) > 0;
                const isOpen = expanded.has(projId);

                return [
                  <TableRow key={projId} className="h-11 border-t border-border-muted">
                    <TableCell className="w-10 text-end font-mono text-[12px] text-faint-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="px-3">
                      <div className="flex items-center gap-2">
                        {hasEnvs ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand(projId)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={isOpen ? 'Collapse environments' : 'Expand environments'}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <span className="w-4" />
                        )}
                        <span className="text-[14px] font-medium">{proj.name ?? proj.key}</span>
                        {proj.key && proj.name && (
                          <code className="rounded bg-gutter px-1.5 py-0.5 font-mono text-[13px]">
                            {proj.key}
                          </code>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[14px]">{proj.comments ?? 0}</TableCell>
                    <TableCell className="font-mono text-[14px]">{proj.replies ?? 0}</TableCell>
                    {catalog.items.map((s) => {
                      const count = getProjectStatusCount(proj, s.value);
                      return (
                        <TableCell key={s.value} className="text-end">
                          <CountCell count={count} tone={statusTone(s.value)} />
                        </TableCell>
                      );
                    })}
                  </TableRow>,
                  ...(isOpen && hasEnvs
                    ? [
                        <EnvRows
                          key={`env-${projId}`}
                          environments={proj.environments ?? []}
                          catalog={catalog}
                        />,
                      ]
                    : []),
                ];
              })}
              {projects.length === 0 && !isFetching && (
                <TableRow className="h-11 border-t border-border-muted">
                  <TableCell
                    colSpan={4 + catalog.items.length}
                    className="px-3 text-center text-[14px] text-muted-foreground"
                  >
                    {t('profile.noProjects')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        )}
      </div>

      {/* Danger zone (DB-11c) — self-view only. Leave: ends this membership only, other
          workspaces and the account itself are untouched. Delete my account: GDPR erase,
          irreversible, everywhere. Both are blocked while the caller is the sole Workspace
          Admin anywhere; the server's own message names the workspace(s) to transfer first. */}
      {showDangerZone && (
        <section className="flex flex-col gap-3 rounded-lg border border-state-danger/30 p-4">
          <h2 className="text-[16px] font-semibold leading-6 text-state-danger">
            {t('profile.dangerZone')}
          </h2>

          {dangerError && (
            <p role="alert" className="text-[13px] text-state-danger">
              {dangerError}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[14px] font-medium">{t('profile.leaveWorkspace')}</p>
                <p className="text-[13px] text-muted-foreground">{t('profile.leaveWorkspaceHint')}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={leaveMut.isPending}
                onClick={() => {
                  setDangerError(null);
                  setConfirmLeave(true);
                }}
              >
                <LogOut className="h-4 w-4" />
                {t('profile.leaveWorkspace')}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border-muted pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[14px] font-medium">{t('profile.deleteAccount')}</p>
                <p className="text-[13px] text-muted-foreground">{t('profile.deleteAccountHint')}</p>
              </div>
              {!me?.isQuickAccess && (
                <Button variant="destructive" size="sm" onClick={openDeleteAccount}>
                  <Trash2 className="h-4 w-4" />
                  {t('profile.deleteAccount')}
                </Button>
              )}
            </div>

            {/* Passwordless (quick-access) identities have no password to confirm with — they
                confirm through a one-time e-mailed link instead (§3.4b). */}
            {me?.isQuickAccess && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-muted-foreground">{t('profile.requestEraseHint')}</p>
                {eraseLinkNotice ? (
                  <p className="text-[13px] text-state-completed">{t('profile.eraseLinkSent')}</p>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={requestEraseMut.isPending}
                    onClick={() => requestEraseMut.mutate()}
                  >
                    <Mail className="h-4 w-4" />
                    {t('profile.requestEraseButton')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmRegenerate}
        message={t('profile.regenerateApiKeyConfirm')}
        confirmLabel={t('profile.regenerateApiKey')}
        confirmColor="warn"
        onConfirm={handleRegenerateConfirm}
        onCancel={() => setConfirmRegenerate(false)}
      />

      {/* Leave workspace confirmation */}
      <ConfirmDialog
        open={confirmLeave}
        message={t('profile.confirmLeave')}
        confirmLabel={t('profile.leaveWorkspace')}
        confirmColor="warn"
        onConfirm={confirmLeaveWorkspace}
        onCancel={() => setConfirmLeave(false)}
      />

      {/* Delete my account — password-confirmed (GDPR erase, §3.4/§3.5) */}
      <Dialog open={confirmDeleteOpen} onOpenChange={(o) => !o && setConfirmDeleteOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('profile.deleteAccount')}</DialogTitle>
            <DialogDescription>{t('profile.confirmDeleteAccount')}</DialogDescription>
          </DialogHeader>
          <div className="pt-1">
            <FormField label={t('profile.deleteAccountPasswordLabel')} htmlFor="delete-account-password">
              <PasswordInput
                id="delete-account-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoFocus
              />
            </FormField>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={!deletePassword || deleteAccountMut.isPending}
              onClick={submitDeleteAccount}
            >
              {t('profile.deleteAccount')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change e-mail (DB-11d) — password-confirmed, verification link goes to the new address;
          nothing changes here until that link is confirmed (/confirm-email). */}
      <Dialog open={changeEmailOpen} onOpenChange={(o) => !o && setChangeEmailOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('profile.changeEmail')}</DialogTitle>
            {!changeEmailSentTo && (
              <DialogDescription>{t('profile.changeEmailHint')}</DialogDescription>
            )}
          </DialogHeader>
          {changeEmailSentTo ? (
            <div className="flex flex-col gap-3 pt-1">
              <p className="text-[14px] text-state-completed">
                {t('profile.changeEmailSentDetail', { email: changeEmailSentTo })}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 pt-1">
              {changeEmailError && (
                <p role="alert" className="text-[13px] text-state-danger">
                  {changeEmailError}
                </p>
              )}
              <FormField label={t('profile.changeEmailCurrentPassword')} htmlFor="change-email-password">
                <PasswordInput
                  id="change-email-password"
                  value={changeEmailPassword}
                  onChange={(e) => setChangeEmailPassword(e.target.value)}
                  autoFocus
                />
              </FormField>
              <FormField label={t('profile.changeEmailNewAddress')} htmlFor="change-email-new-address">
                <Input
                  id="change-email-new-address"
                  type="email"
                  value={changeEmailNewAddress}
                  onChange={(e) => setChangeEmailNewAddress(e.target.value)}
                />
              </FormField>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setChangeEmailOpen(false)}>
              {t(changeEmailSentTo ? 'common.close' : 'common.cancel')}
            </Button>
            {!changeEmailSentTo && (
              <Button
                disabled={!changeEmailPassword || !changeEmailNewAddress.trim() || changeEmailMut.isPending}
                onClick={submitChangeEmail}
              >
                <MailPlus className="h-4 w-4" />
                {t('profile.changeEmailSubmit')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change password (DB-14) — current-password-confirmed; a successful change bumps the
          security stamp server-side and signs out every session, this one included. */}
      <Dialog open={changePasswordOpen} onOpenChange={(o) => !o && setChangePasswordOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('changePassword.title')}</DialogTitle>
            <DialogDescription>{t('changePassword.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            {changePasswordError && (
              <p role="alert" className="text-[13px] text-state-danger">
                {changePasswordError}
              </p>
            )}
            <FormField label={t('changePassword.current')} htmlFor="change-password-current">
              <PasswordInput
                id="change-password-current"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoFocus
              />
            </FormField>
            <FormField
              label={t('changePassword.new')}
              htmlFor="change-password-new"
              error={newPassword ? newPasswordErrorMsg || undefined : undefined}
              hint={t('common.passwordPolicyHint')}
            >
              <PasswordInput
                id="change-password-new"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </FormField>
            <FormField label={t('changePassword.confirm')} htmlFor="change-password-confirm">
              <PasswordInput
                id="change-password-confirm"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </FormField>
            {newPasswordMismatch && (
              <p className="text-[12px] text-state-danger">{t('changePassword.mismatch')}</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setChangePasswordOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={changePasswordInvalid || changePasswordMut.isPending}
              onClick={submitChangePassword}
            >
              <KeyRound className="h-4 w-4" />
              {t('changePassword.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- helpers ----
function getProjectStatusCount(proj: ProfileProject, value: number | undefined): number {
  switch (value) {
    case 1: return proj.open ?? 0;
    case 2: return proj.readyToApply ?? 0;
    case 3: return proj.applied ?? 0;
    case 4: return proj.archived ?? 0;
    default: return 0;
  }
}

function getEnvStatusCount(env: ProfileEnvironment, value: number | undefined): number {
  switch (value) {
    case 1: return env.open ?? 0;
    case 2: return env.readyToApply ?? 0;
    case 3: return env.applied ?? 0;
    case 4: return env.archived ?? 0;
    default: return 0;
  }
}

