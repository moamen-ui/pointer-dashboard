import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  getApiAdminStats,
  type StatsResponse,
  type ProjectStats,
} from '@moamen-ui/pointer-react';
import {
  Folder,
  Users as UsersIcon,
  MessageSquare,
  Circle,
  Clock,
  CheckCircle2,
  Archive,
  RefreshCw,
  Lock,
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

// The client generates GET endpoints as mutations; we wrap the plain async
// function in useQuery to get caching + loading/refetch ergonomics. The package's
// customInstance already unwraps Result<T>, so this resolves to StatsResponse.
function useAdminStats() {
  return useQuery<StatsResponse>({
    queryKey: ['admin', 'stats'],
    queryFn: ({ signal }) => getApiAdminStats(signal),
  });
}

interface StatDef {
  key: string; // i18n key
  value: number | undefined;
  icon: typeof Folder;
  tone: 'slate' | 'blue' | 'amber' | 'green';
}

const TONE: Record<StatDef['tone'], { box: string; value: string }> = {
  slate: { box: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300', value: '' },
  blue: { box: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300', value: 'text-blue-600 dark:text-blue-300' },
  amber: { box: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', value: 'text-amber-600 dark:text-amber-300' },
  green: { box: 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300', value: 'text-green-600 dark:text-green-300' },
};

export function OverviewPage() {
  const { t } = useTranslation();
  const { data: stats, isFetching, refetch } = useAdminStats();

  const totals = stats?.totals;
  const projects = stats?.projects ?? [];

  const cards: StatDef[] = [
    { key: 'overview.projects', value: totals?.projects, icon: Folder, tone: 'slate' },
    { key: 'overview.users', value: totals?.users, icon: UsersIcon, tone: 'slate' },
    { key: 'overview.comments', value: totals?.comments, icon: MessageSquare, tone: 'slate' },
    { key: 'overview.open', value: totals?.open, icon: Circle, tone: 'blue' },
    { key: 'overview.pending', value: totals?.pending, icon: Clock, tone: 'amber' },
    { key: 'overview.completed', value: totals?.completed, icon: CheckCircle2, tone: 'green' },
    { key: 'overview.archived', value: totals?.archived, icon: Archive, tone: 'slate' },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Stat cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
        {cards.map(({ key, value, icon: Icon, tone }) => (
          <Card key={key}>
            <CardContent className="flex items-center gap-3.5 p-4">
              <div
                className={cn(
                  'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
                  TONE[tone].box,
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <div className={cn('text-[1.7rem] font-bold leading-tight', TONE[tone].value)}>
                  {value ?? 0}
                </div>
                <div className="mt-0.5 text-[0.72rem] uppercase tracking-wide text-muted-foreground">
                  {t(key)}
                </div>
                {key === 'overview.comments' && (totals?.privateComments ?? 0) > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                    {t('overview.privateHidden', { count: totals?.privateComments ?? 0 })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Projects breakdown */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('overview.breakdown')}</h2>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            {t('common.refresh')}
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('overview.key')}</TableHead>
                <TableHead>{t('overview.name')}</TableHead>
                <TableHead>{t('overview.comments')}</TableHead>
                <TableHead>{t('overview.private')}</TableHead>
                <TableHead>{t('overview.open')}</TableHead>
                <TableHead>{t('overview.pending')}</TableHead>
                <TableHead>{t('overview.completed')}</TableHead>
                <TableHead>{t('overview.archived')}</TableHead>
                <TableHead>{t('overview.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((row: ProjectStats) => (
                <TableRow key={row.projectId ?? row.key}>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.key}</code>
                  </TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.comments}</TableCell>
                  <TableCell>
                    {(row.privateComments ?? 0) > 0 ? (
                      <span className="chip chip-private" title={t('overview.privateHiddenTooltip')}>
                        <Lock className="h-3 w-3" />
                        {row.privateComments}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-blue-600 dark:text-blue-300">{row.open}</TableCell>
                  <TableCell className="font-medium text-amber-600 dark:text-amber-300">{row.pending}</TableCell>
                  <TableCell className="font-medium text-green-600 dark:text-green-300">{row.completed}</TableCell>
                  <TableCell className="font-medium text-slate-600 dark:text-slate-300">{row.archived}</TableCell>
                  <TableCell>
                    <span className={cn('chip', row.isActive ? 'chip-active' : 'chip-disabled')}>
                      {t(row.isActive ? 'common.active' : 'common.disabled')}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {projects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    {t('overview.noPending')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
