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
  ChevronDown,
  ChevronRight,
  RefreshCw,
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
import { CountCell, DiffstatLine, statusTone, toneHeaderClass, toneTextClass } from '@/components/shared/CountCell';

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
      </div>
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

