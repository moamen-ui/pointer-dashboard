import type { ComponentType } from 'react';
import type { TFunction } from 'i18next';
import type { CountStat, ProjectFunnelStat, WeekStat, WorkspaceFunnelStat } from '@moamen-ui/pointer-react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/** "unset"/"unknown" language buckets read through i18n; any real language/device/browser tag is
 *  shown as-is (upper-cased for two-letter language codes, since those read as tags, not words). */
export function labelForKey(t: TFunction, key: string | null | undefined): string {
  const k = key ?? '';
  if (k === 'unset') return t('insights.unset');
  if (k === 'unknown' || k === '') return t('insights.unknown');
  return k.length <= 3 ? k.toUpperCase() : k;
}

export function formatHours(t: TFunction, value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)} ${t('insights.hours')}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

/** A share of a total, guarding the zero-denominator case rather than rendering NaN%. */
export function formatShare(part: number | null | undefined, total: number | null | undefined): string {
  if (!total || total <= 0) return '—';
  return formatPercent((part ?? 0) / total);
}

/** Bordered list card — same visual as the Overview page's "Active AI Tools" block: a gutter
 *  header row with an icon + title, then a flat list of `label · count` rows. */
export function CountList({
  icon: Icon,
  title,
  items,
  emptyLabel,
  formatLabel,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  items: CountStat[] | null | undefined;
  emptyLabel: string;
  formatLabel: (key: string | null | undefined) => string;
}) {
  const list = items ?? [];
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="h-11 px-3 py-2 flex items-center gap-2 bg-gutter border-b border-border-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-[14px] font-medium text-foreground">{title}</span>
      </div>
      {list.length === 0 ? (
        <div className="px-3 py-2 text-[13px] text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div className="flex flex-col">
          {list.map((item, idx) => (
            <div
              key={`${item.key ?? idx}`}
              className={cn(
                'min-h-11 px-3 py-2 flex items-center justify-between gap-4',
                idx > 0 && 'border-t border-border-muted',
              )}
            >
              <span className="text-[14px] font-medium text-foreground">
                {formatLabel(item.key)}
              </span>
              <span className="font-mono text-[13px] text-muted-foreground">{item.count ?? 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small bordered card of `label: value` rows — used for the two funnel medians and the
 *  verification (fix-quality) summary. */
export function MetricCard({
  icon: Icon,
  title,
  rows,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="h-11 px-3 py-2 flex items-center gap-2 bg-gutter border-b border-border-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-[14px] font-medium text-foreground">{title}</span>
      </div>
      <div className="flex flex-col">
        {rows.map((row, idx) => (
          <div
            key={row.label}
            className={cn(
              'min-h-11 px-3 py-2 flex items-center justify-between gap-4',
              idx > 0 && 'border-t border-border-muted',
            )}
          >
            <span className="text-[14px] text-foreground">{row.label}</span>
            <span className="font-mono text-[13px] text-muted-foreground">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Cross-tenant funnel table (super admin only). */
export function WorkspaceFunnelTable({
  t,
  rows,
}: {
  t: TFunction;
  rows: WorkspaceFunnelStat[] | null | undefined;
}) {
  const list = rows ?? [];
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gutter">
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('insights.workspace')}
            </TableHead>
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('insights.open')}
            </TableHead>
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('insights.ready')}
            </TableHead>
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('insights.applied')}
            </TableHead>
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('insights.verified')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="px-3 py-3 text-[13px] text-muted-foreground">
                {t('insights.noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((row, idx) => (
              <TableRow key={row.tenantId ?? idx} className="border-t border-border-muted">
                <TableCell className="px-3 text-[14px] font-medium text-foreground">
                  {row.tenantName || '—'}
                </TableCell>
                <TableCell className="px-3 font-mono text-[13px]">{row.open ?? 0}</TableCell>
                <TableCell className="px-3 font-mono text-[13px]">{row.ready ?? 0}</TableCell>
                <TableCell className="px-3 font-mono text-[13px]">{row.applied ?? 0}</TableCell>
                <TableCell className="px-3 font-mono text-[13px]">{row.verified ?? 0}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** Per-project funnel table (workspace admin only) — same shape plus the median-to-apply column. */
export function ProjectFunnelTable({
  t,
  rows,
}: {
  t: TFunction;
  rows: ProjectFunnelStat[] | null | undefined;
}) {
  const list = rows ?? [];
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gutter">
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('insights.project')}
            </TableHead>
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('insights.open')}
            </TableHead>
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('insights.ready')}
            </TableHead>
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('insights.applied')}
            </TableHead>
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('insights.verified')}
            </TableHead>
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('insights.medianCreatedToApplied')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="px-3 py-3 text-[13px] text-muted-foreground">
                {t('insights.noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((row, idx) => (
              <TableRow key={row.projectKey ?? idx} className="border-t border-border-muted">
                <TableCell className="px-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-foreground">
                      {row.projectName || row.projectKey}
                    </span>
                    {row.projectKey && (
                      <code className="shrink-0 whitespace-nowrap rounded bg-gutter px-1.5 py-0.5 font-mono text-[12px]">
                        {row.projectKey}
                      </code>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-3 font-mono text-[13px]">{row.open ?? 0}</TableCell>
                <TableCell className="px-3 font-mono text-[13px]">{row.ready ?? 0}</TableCell>
                <TableCell className="px-3 font-mono text-[13px]">{row.applied ?? 0}</TableCell>
                <TableCell className="px-3 font-mono text-[13px]">{row.verified ?? 0}</TableCell>
                <TableCell className="px-3 font-mono text-[13px] text-muted-foreground">
                  {formatHours(t, row.medianHoursCreatedToApplied)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** 8-week activity chart with no chart dependency: three thin columns per week (created / applied /
 *  verified), heights relative to the max value across the whole series, week label underneath,
 *  and a `title` tooltip on each bar for the exact count. */
export function WeekBars({ t, weeks }: { t: TFunction; weeks: WeekStat[] | null | undefined }) {
  const list = weeks ?? [];
  if (list.length === 0) {
    return <div className="px-3 py-2 text-[13px] text-muted-foreground">{t('insights.noData')}</div>;
  }
  const max = Math.max(1, ...list.flatMap((w) => [w.created ?? 0, w.applied ?? 0, w.verified ?? 0]));
  const series: Array<{ key: keyof WeekStat; className: string; label: string }> = [
    { key: 'created', className: 'bg-state-open', label: t('insights.created') },
    { key: 'applied', className: 'bg-state-ready', label: t('insights.applied') },
    { key: 'verified', className: 'bg-state-completed', label: t('insights.verified') },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-3 overflow-x-auto px-3 py-4">
        {list.map((week, idx) => (
          <div key={week.weekStart ?? idx} className="flex flex-col items-center gap-1.5">
            <div className="flex h-24 items-end gap-0.5">
              {series.map((s) => {
                const value = (week[s.key] as number | undefined) ?? 0;
                const height = Math.max(2, Math.round((value / max) * 96));
                return (
                  <div
                    key={s.key}
                    title={`${s.label}: ${value}`}
                    className={cn('w-2.5 rounded-t', s.className)}
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              {formatWeekLabel(week.weekStart)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 px-3 pb-3 text-[12px] text-muted-foreground">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-sm', s.className)} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatWeekLabel(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}
