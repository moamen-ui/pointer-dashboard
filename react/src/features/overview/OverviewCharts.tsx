import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectStats, StatsTotals, WeekStat } from '@moamen-ui/pointer-react';
import { BarChart3, FolderGit2, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WeekBars } from '@/features/overview/InsightPanels';
import { useStatusCatalog } from '@/lib/status-catalog';
import { cn } from '@/lib/utils';

export type OverviewChartsProps = {
  totals?: StatsTotals;
  projects?: ProjectStats[];
  activity?: WeekStat[] | null;
};

export function OverviewCharts({ totals, projects, activity }: OverviewChartsProps) {
  const { t } = useTranslation();
  const catalog = useStatusCatalog();

  const totalComments = totals?.comments ?? 0;
  const openCount = totals?.open ?? 0;
  const readyCount = totals?.pending ?? 0;
  const completedCount = totals?.completed ?? 0;
  const archivedCount = totals?.archived ?? 0;

  const openPct = totalComments > 0 ? (openCount / totalComments) * 100 : 0;
  const readyPct = totalComments > 0 ? (readyCount / totalComments) * 100 : 0;
  const completedPct = totalComments > 0 ? (completedCount / totalComments) * 100 : 0;
  const archivedPct = totalComments > 0 ? (archivedCount / totalComments) * 100 : 0;

  const statusLabel = (value: number, fallbackKey: string): string => {
    const s = catalog.items.find((x) => x.value === value);
    return s ? catalog.displayLabel(s) : t(fallbackKey);
  };

  const openLabel = statusLabel(1, 'overview.open');
  const readyLabel = statusLabel(2, 'overview.pending');
  const completedLabel = statusLabel(3, 'overview.completed');
  const archivedLabel = statusLabel(4, 'overview.archived');

  const topProjects = useMemo(() => {
    return (projects ?? [])
      .filter((p) => (p.comments ?? 0) > 0)
      .sort((a, b) => (b.comments ?? 0) - (a.comments ?? 0))
      .slice(0, 5);
  }, [projects]);

  const hasActivity = Boolean(activity && activity.length > 0);

  return (
    <div className="space-y-4">
      <div className={cn('grid gap-4', hasActivity ? 'lg:grid-cols-2' : 'md:grid-cols-2')}>
        {/* Card 1: Comment Status Distribution */}
        <div className="flex flex-col rounded-md border border-border overflow-hidden bg-background">
          <div className="h-11 px-3 py-2 flex items-center justify-between gap-2 bg-gutter border-b border-border-muted">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-[14px] font-medium text-foreground">
                {t('overview.statusDistribution')}
              </span>
            </div>
            <Badge variant="neutral" className="h-5 font-mono text-[12px]">
              {totalComments} {t('overview.comments')}
            </Badge>
          </div>

          <div className="p-4 flex flex-col sm:flex-row items-center gap-5 flex-1">
            {/* Pie chart: each status's share of total feedback, drawn with a conic-gradient
                so the four state colors stay in sync with the legend and the rest of the app —
                no charting library needed for four static segments. */}
            <div
              role="img"
              aria-label={`${openLabel} ${openCount} (${openPct.toFixed(1)}%), ${readyLabel} ${readyCount} (${readyPct.toFixed(1)}%), ${completedLabel} ${completedCount} (${completedPct.toFixed(1)}%), ${archivedLabel} ${archivedCount} (${archivedPct.toFixed(1)}%)`}
              className="h-32 w-32 shrink-0 rounded-full border border-border-muted"
              style={{
                background:
                  totalComments > 0
                    ? `conic-gradient(var(--state-open) 0 ${openPct}%, var(--state-ready) ${openPct}% ${openPct + readyPct}%, var(--state-completed) ${openPct + readyPct}% ${openPct + readyPct + completedPct}%, var(--state-archived) ${openPct + readyPct + completedPct}% 100%)`
                    : 'var(--gutter)',
              }}
            />

            {/* Legend: color dot + label + count + percentage per status */}
            <div className="grid grid-cols-2 gap-2.5 w-full flex-1">
              {(
                [
                  { key: 'open', label: openLabel, count: openCount, pct: openPct, dot: 'bg-state-open' },
                  { key: 'ready', label: readyLabel, count: readyCount, pct: readyPct, dot: 'bg-state-ready' },
                  {
                    key: 'completed',
                    label: completedLabel,
                    count: completedCount,
                    pct: completedPct,
                    dot: 'bg-state-completed',
                  },
                  {
                    key: 'archived',
                    label: archivedLabel,
                    count: archivedCount,
                    pct: archivedPct,
                    dot: 'bg-state-archived',
                  },
                ] as const
              ).map((s) => (
                <div key={s.key} className="rounded-md border border-border-muted p-2.5 bg-background">
                  <div className="flex items-center justify-between gap-1 text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <span className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="font-mono text-[11px] shrink-0">{s.pct.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 font-mono text-[18px] font-semibold text-foreground">{s.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Weekly Activity Trend (when present) or Top Projects Card (when no activity) */}
        {hasActivity ? (
          <div className="flex flex-col rounded-md border border-border overflow-hidden bg-background">
            <div className="h-11 px-3 py-2 flex items-center gap-2 bg-gutter border-b border-border-muted">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-[14px] font-medium text-foreground">
                {t('insights.activity')}
              </span>
            </div>
            <div className="p-2 flex-1 flex flex-col justify-center">
              <WeekBars t={t} weeks={activity} />
            </div>
          </div>
        ) : (
          <TopProjectsCard
            t={t}
            projects={topProjects}
            openLabel={openLabel}
            readyLabel={readyLabel}
            completedLabel={completedLabel}
            archivedLabel={archivedLabel}
          />
        )}
      </div>

      {/* Row 2: Top Projects Card (when activity card is shown above) */}
      {hasActivity && (
        <TopProjectsCard
          t={t}
          projects={topProjects}
          openLabel={openLabel}
          readyLabel={readyLabel}
          completedLabel={completedLabel}
          archivedLabel={archivedLabel}
        />
      )}
    </div>
  );
}

type TopProjectsCardProps = {
  t: (key: string, options?: Record<string, unknown>) => string;
  projects: ProjectStats[];
  openLabel: string;
  readyLabel: string;
  completedLabel: string;
  archivedLabel: string;
};

function TopProjectsCard({
  t,
  projects,
  openLabel,
  readyLabel,
  completedLabel,
  archivedLabel,
}: TopProjectsCardProps) {
  return (
    <div className="flex flex-col rounded-md border border-border overflow-hidden bg-background">
      <div className="h-11 px-3 py-2 flex items-center justify-between gap-2 bg-gutter border-b border-border-muted">
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-[14px] font-medium text-foreground">
            {t('overview.topProjects')}
          </span>
        </div>
        <span className="text-[12px] text-muted-foreground">
          {projects.length} {t('overview.projects')}
        </span>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-center">
        {projects.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-muted-foreground">
            {t('overview.noProjectActivity')}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border-muted">
            {projects.map((p, idx) => {
              const pComments = p.comments ?? 0;
              const pOpen = p.open ?? 0;
              const pReady = p.pending ?? 0;
              const pCompleted = p.completed ?? 0;
              const pArchived = p.archived ?? 0;

              const pOpenPct = pComments > 0 ? (pOpen / pComments) * 100 : 0;
              const pReadyPct = pComments > 0 ? (pReady / pComments) * 100 : 0;
              const pCompletedPct = pComments > 0 ? (pCompleted / pComments) * 100 : 0;
              const pArchivedPct = pComments > 0 ? (pArchived / pComments) * 100 : 0;

              return (
                <div
                  key={p.projectId ?? p.key ?? idx}
                  className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {p.name || p.key}
                      </span>
                      {p.key && (
                        <code className="shrink-0 whitespace-nowrap rounded bg-gutter px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {p.key}
                        </code>
                      )}
                    </div>
                    <span className="font-mono text-[13px] font-medium text-foreground shrink-0">
                      {pComments}
                    </span>
                  </div>

                  {/* Horizontal stacked distribution bar */}
                  <div
                    className="h-2 w-full flex overflow-hidden rounded-full bg-gutter border border-border-muted"
                    title={`${p.name || p.key}: ${pComments} comments`}
                  >
                    {pOpen > 0 && (
                      <div
                        className="bg-state-open h-full"
                        style={{ width: `${pOpenPct}%` }}
                        title={`${openLabel}: ${pOpen}`}
                      />
                    )}
                    {pReady > 0 && (
                      <div
                        className="bg-state-ready h-full"
                        style={{ width: `${pReadyPct}%` }}
                        title={`${readyLabel}: ${pReady}`}
                      />
                    )}
                    {pCompleted > 0 && (
                      <div
                        className="bg-state-completed h-full"
                        style={{ width: `${pCompletedPct}%` }}
                        title={`${completedLabel}: ${pCompleted}`}
                      />
                    )}
                    {pArchived > 0 && (
                      <div
                        className="bg-state-archived h-full"
                        style={{ width: `${pArchivedPct}%` }}
                        title={`${archivedLabel}: ${pArchived}`}
                      />
                    )}
                  </div>

                  {/* Sub-counts with color indicators */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-state-open shrink-0" />
                      <span>{pOpen}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-state-ready shrink-0" />
                      <span>{pReady}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-state-completed shrink-0" />
                      <span>{pCompleted}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-state-archived shrink-0" />
                      <span>{pArchived}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
