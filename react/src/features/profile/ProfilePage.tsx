// User profile page.
// • /profile           → self-profile (authenticated, any role)
// • /users/:id/profile → admin view of another user (admin only)
//
// Query gating:
//   isAdmin && id != null  → useGetApiAdminUsersIdProfile (enabled)
//   otherwise              → useGetApiMeProfile            (enabled)
import { Fragment, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useGetApiMeProfile,
  useGetApiAdminUsersIdProfile,
  useGetApiMeApiKey,
  usePostApiMeApiKeyRegenerate,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { CountCell, DiffstatLine, statusTone, toneHeaderClass, toneTextClass } from '@/components/shared/CountCell';
import { useMediaQuery, MOBILE_QUERY } from '@/lib/useMediaQuery';

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
  const { isAdmin } = useAuth();
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

      {/* Header with title and refresh */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold">
            {profileUser?.displayName ?? t('profile.title')}
          </h1>
          {profileUser?.email && (
            <p className="mt-0.5 text-[14px] text-muted-foreground">
              {profileUser.email}
              {profileUser.roleName ? ` · ${profileUser.roleName}` : ''}
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

      <ConfirmDialog
        open={confirmRegenerate}
        message={t('profile.regenerateApiKeyConfirm')}
        confirmLabel={t('profile.regenerateApiKey')}
        confirmColor="warn"
        onConfirm={handleRegenerateConfirm}
        onCancel={() => setConfirmRegenerate(false)}
      />
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

