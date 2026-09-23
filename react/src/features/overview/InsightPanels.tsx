import { useState, type ComponentType } from 'react';
import type { TFunction } from 'i18next';
import type {
  ActivationStepStat,
  ActivationStepStatus,
  ActivationWeekStat,
  ActivationWorkspaceRow,
  CountStat,
  ProjectFunnelStat,
  WeekStat,
  WorkspaceActivationResponse,
  WorkspaceFunnelStat,
} from '@moamen-ui/pointer-react';
import { CheckCircle2, ChevronDown, Circle, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRequestedAt } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
 *  header row with an icon + title, then a flat list of `label · count` rows. `rowIcon`
 *  (comments #85/#86) optionally resolves a per-row glyph from the item key — known
 *  browsers/devices get their own icon, everything else a default. */
export function CountList({
  icon: Icon,
  title,
  items,
  emptyLabel,
  formatLabel,
  rowIcon,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  items: CountStat[] | null | undefined;
  emptyLabel: string;
  formatLabel: (key: string | null | undefined) => string;
  rowIcon?: (key: string | null | undefined) => ComponentType<{ className?: string }> | undefined;
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
          {list.map((item, idx) => {
            const RowIcon = rowIcon?.(item.key);
            return (
              <div
                key={`${item.key ?? idx}`}
                className={cn(
                  'min-h-11 px-3 py-2 flex items-center justify-between gap-4',
                  idx > 0 && 'border-t border-border-muted',
                )}
              >
                <span className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-foreground">
                  {RowIcon && (
                    <RowIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  {formatLabel(item.key)}
                </span>
                <span className="font-mono text-[13px] text-muted-foreground">{item.count ?? 0}</span>
              </div>
            );
          })}
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

// ── DB-15 activation funnel (super admin) + getting-started checklist (workspace admin) ──

/** Server `usage_events.type` → i18n label key (§3.1's frozen identifiers). A step key the
 *  dashboard doesn't recognize (future addition) falls back to the server-supplied `label`. */
const ACTIVATION_STEP_LABEL_KEYS: Record<string, string> = {
  demo_started: 'activation.steps.demoStarted',
  workspace_converted: 'activation.steps.workspaceConverted',
  widget_installed: 'activation.steps.widgetInstalled',
  first_comment: 'activation.steps.firstComment',
  first_apply: 'activation.steps.firstApply',
};

export function activationStepLabel(
  t: TFunction,
  key: string | null | undefined,
  fallback?: string | null,
): string {
  const i18nKey = key ? ACTIVATION_STEP_LABEL_KEYS[key] : undefined;
  if (i18nKey) return t(i18nKey);
  return fallback || key || '—';
}

/** Five-step funnel — one row per step, "all workspaces" and "demo path" bars scaled to the
 *  first step's total, plus the step-to-step conversion ratio the API already computed. */
export function FunnelStepBars({
  t,
  steps,
}: {
  t: TFunction;
  steps: ActivationStepStat[] | null | undefined;
}) {
  const list = steps ?? [];
  if (list.length === 0) {
    return <div className="px-3 py-2 text-[13px] text-muted-foreground">{t('activation.noData')}</div>;
  }
  const max = Math.max(1, ...list.map((s) => s.workspaces ?? 0));
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex flex-col">
        {list.map((step, idx) => {
          const workspaces = step.workspaces ?? 0;
          const demoPath = step.demoPathWorkspaces ?? 0;
          const pct = (workspaces / max) * 100;
          const demoPct = (demoPath / max) * 100;
          return (
            <div
              key={step.key ?? idx}
              className={cn(
                'px-3 py-2.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3',
                idx > 0 && 'border-t border-border-muted',
              )}
            >
              <div className="shrink-0 text-[13px] font-medium text-foreground sm:w-40">
                {activationStepLabel(t, step.key, step.label)}
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gutter border border-border-muted">
                  <div
                    className="h-full rounded-full bg-state-open transition-all duration-300"
                    style={{ width: `${pct}%` }}
                    title={`${t('activation.allWorkspaces')}: ${workspaces}`}
                  />
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gutter border border-border-muted">
                  <div
                    className="h-full rounded-full bg-state-ready transition-all duration-300"
                    style={{ width: `${demoPct}%` }}
                    title={`${t('activation.demoPath')}: ${demoPath}`}
                  />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:w-28 sm:justify-end">
                <span className="font-mono text-[13px] text-foreground">{workspaces}</span>
                <span className="w-12 shrink-0 text-end font-mono text-[12px] text-muted-foreground">
                  {step.rateFromPrevious == null ? '—' : formatPercent(step.rateFromPrevious)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border-muted px-3 py-2 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-state-open" />
          {t('activation.allWorkspaces')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-state-ready" />
          {t('activation.demoPath')}
        </span>
      </div>
    </div>
  );
}

/** Weekly series (`Weeks[]`, `weeks` query param 4/12/26) — same no-dependency bar primitive as
 *  `WeekBars`, five series per week with `Activated` (= first_apply) picked out by a ring rather
 *  than a new hue (DESIGN.md: don't reassign a diff hue to a non-state meaning). */
export function ActivationWeekBars({
  t,
  weeks,
}: {
  t: TFunction;
  weeks: ActivationWeekStat[] | null | undefined;
}) {
  const list = weeks ?? [];
  if (list.length === 0) {
    return <div className="px-3 py-2 text-[13px] text-muted-foreground">{t('activation.noData')}</div>;
  }
  const max = Math.max(
    1,
    ...list.flatMap((w) => [
      w.demosStarted ?? 0,
      w.converted ?? 0,
      w.widgetInstalled ?? 0,
      w.firstComment ?? 0,
      w.activated ?? 0,
    ]),
  );
  const series: Array<{
    key: keyof ActivationWeekStat;
    className: string;
    label: string;
    highlight?: boolean;
  }> = [
    { key: 'demosStarted', className: 'bg-state-archived', label: t('activation.steps.demoStarted') },
    { key: 'converted', className: 'bg-state-open', label: t('activation.steps.workspaceConverted') },
    { key: 'widgetInstalled', className: 'bg-state-ready', label: t('activation.steps.widgetInstalled') },
    { key: 'firstComment', className: 'bg-state-completed', label: t('activation.steps.firstComment') },
    {
      key: 'activated',
      className: 'bg-state-completed',
      label: t('activation.activated'),
      highlight: true,
    },
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
                    className={cn(
                      'w-2.5 rounded-t',
                      s.className,
                      s.highlight && 'ring-1 ring-inset ring-foreground/40',
                    )}
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
            <span className={cn('h-2 w-2 rounded-sm', s.className, s.highlight && 'ring-1 ring-inset ring-foreground/40')} />
            {s.highlight ? <strong className="font-medium text-foreground">{s.label}</strong> : s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Last 50 workspaces by latest step time (`Recent`), super admin only. */
export function RecentActivationTable({
  t,
  rows,
}: {
  t: TFunction;
  rows: ActivationWorkspaceRow[] | null | undefined;
}) {
  const list = rows ?? [];
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gutter">
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('activation.recentWorkspace')}
            </TableHead>
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('activation.recentStep')}
            </TableHead>
            <TableHead className="text-[12px] font-medium text-muted-foreground">
              {t('activation.recentWhen')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="px-3 py-3 text-[13px] text-muted-foreground">
                {t('activation.noData')}
              </TableCell>
            </TableRow>
          ) : (
            list.map((row, idx) => (
              <TableRow key={row.workspaceId ?? idx} className="border-t border-border-muted">
                <TableCell className="px-3 text-[14px] font-medium text-foreground">
                  {row.workspaceName || t('activation.deletedWorkspace')}
                </TableCell>
                <TableCell className="px-3 text-[13px] text-muted-foreground">
                  {activationStepLabel(t, row.stepReached)}
                </TableCell>
                <TableCell className="px-3 font-mono text-[13px] text-muted-foreground">
                  {formatRequestedAt(row.reachedAt) || '—'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

const CHECKLIST_STEP_KEYS = ['widget_installed', 'first_comment', 'first_apply'];

function activationGuidanceHintKey(key: string | null | undefined): string | undefined {
  switch (key) {
    case 'widget_installed':
      return 'activation.guidance.widgetInstalledHint';
    case 'first_comment':
      return 'activation.guidance.firstCommentHint';
    case 'first_apply':
      return 'activation.guidance.firstApplyHint';
    default:
      return undefined;
  }
}

/** Workspace admin "Getting started" checklist, built from `/activation`. Only the three
 *  always-present steps (§3.5) drive the collapse/guidance logic; `demo_started` /
 *  `workspace_converted` — present only for a demo-path workspace — render above them as
 *  plain done rows when the API includes them. Collapses to "All set" once the three are done;
 *  the next undone step gets the guidance text and, for `widget_installed` / `first_apply`, an
 *  action. */
export function GettingStartedChecklist({
  t,
  data,
  onInstallClick,
  applyGuideHref,
}: {
  t: TFunction;
  data: WorkspaceActivationResponse;
  onInstallClick: () => void;
  applyGuideHref: string;
}) {
  const steps = data.steps ?? [];
  const checklistSteps = steps.filter((s) => CHECKLIST_STEP_KEYS.includes(s.key ?? ''));
  const extraSteps = steps.filter((s) => !CHECKLIST_STEP_KEYS.includes(s.key ?? ''));
  const allDone = checklistSteps.length > 0 && checklistSteps.every((s) => s.done);
  const [collapsed, setCollapsed] = useState(allDone);

  function renderRow(step: ActivationStepStatus, idx: number, isFirst: boolean) {
    const isNext = !step.done && step.key === data.nextStepKey;
    const hintKey = activationGuidanceHintKey(step.key);
    return (
      <div
        key={step.key ?? idx}
        className={cn('px-3 py-2.5 flex flex-col gap-1.5', !isFirst && 'border-t border-border-muted')}
      >
        <div className="flex items-center gap-2">
          {step.done ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-state-completed" />
          ) : (
            <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span
            className={cn(
              'text-[14px] font-medium',
              step.done ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {activationStepLabel(t, step.key, step.label)}
          </span>
          {step.done && step.reachedAt && (
            <span className="ms-auto font-mono text-[12px] text-muted-foreground">
              {formatRequestedAt(step.reachedAt)}
            </span>
          )}
        </div>
        {isNext && hintKey && (
          <div className="ps-6 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-muted-foreground">{t(hintKey)}</p>
            {step.key === 'widget_installed' && (
              <Button size="sm" variant="secondary" onClick={onInstallClick} className="self-start sm:self-auto">
                {t('activation.guidance.widgetInstalledAction')}
              </Button>
            )}
            {step.key === 'first_apply' && (
              <Button size="sm" variant="secondary" asChild className="self-start sm:self-auto">
                <a href={applyGuideHref} target="_blank" rel="noreferrer">
                  {t('activation.guidance.firstApplyAction')}
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="h-11 px-3 py-2 flex items-center justify-between gap-2 bg-gutter border-b border-border-muted">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <span className="text-[14px] font-medium text-foreground">{t('activation.checklistTitle')}</span>
        </div>
        {allDone && (
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="inline-flex items-center gap-2"
            aria-expanded={!collapsed}
          >
            <Badge variant="success">{t('activation.checklistAllSet')}</Badge>
            <ChevronDown
              className={cn('h-4 w-4 text-muted-foreground transition-transform', !collapsed && 'rotate-180')}
            />
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="flex flex-col">
          {extraSteps.map((step, idx) => renderRow(step, idx, idx === 0))}
          {checklistSteps.map((step, idx) => renderRow(step, idx, extraSteps.length === 0 && idx === 0))}
        </div>
      )}
    </div>
  );
}
