// User profile page.
// • /profile           → self-profile (authenticated, any role)
// • /users/:id/profile → admin view of another user (admin only)
//
// Query gating:
//   isAdmin && id != null  → useGetApiAdminUsersIdProfile (enabled)
//   otherwise              → useGetApiMeProfile            (enabled)
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useGetApiMeProfile,
  useGetApiAdminUsersIdProfile,
  type ProfileProject,
  type ProfileEnvironment,
} from '@moamen-ui/pointer-react';
import {
  Folder,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

const ENV_LABEL: Record<number, string> = {
  1: 'Local',
  2: 'Staging',
  3: 'Production',
};

function envLabel(env: number | undefined): string {
  if (env == null) return '—';
  return ENV_LABEL[env] ?? String(env);
}

// ---- Status bar (mini pie-like horizontal bar) ----
function StatusBar({ project, catalog }: { project: ProfileProject; catalog: ReturnType<typeof useStatusCatalog> }) {
  const counts = catalog.items.map((s) => ({
    s,
    count: getProjectStatusCount(project, s.value),
  }));
  const total = counts.reduce((acc, c) => acc + c.count, 0);
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full" title="Status breakdown">
      {counts.map(({ s, count }) =>
        count > 0 ? (
          <div
            key={s.value}
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: s.color ?? '#6b7280',
            }}
            title={`${s.label}: ${count}`}
          />
        ) : null,
      )}
    </div>
  );
}

// ---- Expandable environment row ----
function EnvRows({ environments, catalog }: { environments: ProfileEnvironment[]; catalog: ReturnType<typeof useStatusCatalog> }) {
  return (
    <>
      {environments.map((env) => (
        <TableRow key={env.environment} className="bg-muted/30 text-xs">
          <TableCell className="pl-12 text-muted-foreground italic">
            {envLabel(env.environment)}
          </TableCell>
          <TableCell>{env.comments ?? 0}</TableCell>
          <TableCell>{env.replies ?? 0}</TableCell>
          {catalog.items.map((s) => (
            <TableCell key={s.value} style={{ color: getEnvStatusCount(env, s.value) > 0 ? (s.color ?? undefined) : undefined }}>
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

  // Parse numeric id from route params
  const numericId = id != null && id !== '' ? Number(id) : null;
  const showAdmin = isAdmin && numericId != null;

  // Gate queries with `enabled` per the task spec
  const meQuery = useGetApiMeProfile({ query: { enabled: !showAdmin } });
  const adminQuery = useGetApiAdminUsersIdProfile(numericId ?? 0, {
    query: { enabled: showAdmin },
  });

  const { data, isFetching, refetch } = showAdmin ? adminQuery : meQuery;

  const profileUser = data?.user;
  const totals = data?.totals;
  const projects = data?.projects ?? [];

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

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {profileUser?.displayName ?? t('profile.title')}
          </h1>
          {profileUser?.email && (
            <p className="mt-0.5 text-sm text-muted-foreground">
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

      {/* Headline stat cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
        {/* Projects involved */}
        <Card>
          <CardContent className="flex items-center gap-3.5 p-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
              <Folder className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <div className="text-[1.7rem] font-bold leading-tight">
                {totals?.projectsInvolved ?? 0}
              </div>
              <div className="mt-0.5 text-[0.72rem] uppercase tracking-wide text-muted-foreground">
                {t('profile.projects')}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total comments */}
        <Card>
          <CardContent className="flex items-center gap-3.5 p-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <div className="text-[1.7rem] font-bold leading-tight">
                {totals?.comments ?? 0}
              </div>
              <div className="mt-0.5 text-[0.72rem] uppercase tracking-wide text-muted-foreground">
                {t('profile.comments')}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total replies */}
        <Card>
          <CardContent className="flex items-center gap-3.5 p-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <div className="text-[1.7rem] font-bold leading-tight">
                {totals?.replies ?? 0}
              </div>
              <div className="mt-0.5 text-[0.72rem] uppercase tracking-wide text-muted-foreground">
                {t('profile.replies')}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-status summary cards using catalog colors */}
        {catalog.items.map((s) => (
          <Card key={s.value}>
            <CardContent className="flex items-center gap-3.5 p-4">
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: s.color ? `${s.color}22` : undefined,
                  color: s.color ?? undefined,
                }}
              >
                <MessageSquare className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <div
                  className="text-[1.7rem] font-bold leading-tight"
                  style={{ color: s.color ?? undefined }}
                >
                  {getTotalsStatusCount(totals, s.value)}
                </div>
                <div className="mt-0.5 text-[0.72rem] uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-project breakdown */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">{t('profile.breakdown')}</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('overview.name')}</TableHead>
                <TableHead>{t('overview.comments')}</TableHead>
                <TableHead>{t('profile.replies')}</TableHead>
                {catalog.items.map((s) => (
                  <TableHead key={s.value} style={{ color: s.color ?? undefined }}>
                    {s.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((proj: ProfileProject) => {
                const projId = proj.projectId ?? 0;
                const hasEnvs = (proj.environments?.length ?? 0) > 0;
                const isOpen = expanded.has(projId);

                return [
                  <TableRow key={projId}>
                    <TableCell>
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
                        <span className="font-medium">{proj.name ?? proj.key}</span>
                        {proj.key && proj.name && (
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {proj.key}
                          </code>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{proj.comments ?? 0}</TableCell>
                    <TableCell>{proj.replies ?? 0}</TableCell>
                    {catalog.items.map((s) => {
                      const count = getProjectStatusCount(proj, s.value);
                      return (
                        <TableCell
                          key={s.value}
                          className="font-medium"
                          style={{ color: count > 0 ? (s.color ?? undefined) : undefined }}
                        >
                          {count}
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
                <TableRow>
                  <TableCell
                    colSpan={3 + catalog.items.length}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {t('profile.noProjects')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Per-project mini status bars */}
      {projects.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {projects.map((proj: ProfileProject) => (
            <Card key={proj.projectId}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="text-sm font-medium">{proj.name ?? proj.key}</div>
                <StatusBar project={proj} catalog={catalog} />
                <div className="flex flex-wrap gap-2">
                  {catalog.items.map((s) => {
                    const count = getProjectStatusCount(proj, s.value);
                    return count > 0 ? (
                      <span
                        key={s.value}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
                        style={{
                          backgroundColor: s.color ? `${s.color}22` : undefined,
                          color: s.color ?? undefined,
                        }}
                      >
                        {s.label}: {count}
                      </span>
                    ) : null;
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
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

function getTotalsStatusCount(
  totals: { open?: number; readyToApply?: number; applied?: number; archived?: number } | undefined,
  value: number | undefined,
): number {
  if (!totals) return 0;
  switch (value) {
    case 1: return totals.open ?? 0;
    case 2: return totals.readyToApply ?? 0;
    case 3: return totals.applied ?? 0;
    case 4: return totals.archived ?? 0;
    default: return 0;
  }
}
