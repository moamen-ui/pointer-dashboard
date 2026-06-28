<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  useGetApiAdminStats,
  type ProjectStats,
} from '@moamen-ui/pointer-vue';
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
} from 'lucide-vue-next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const { t } = useI18n();

// Generated TanStack query hook (GET → useQuery). The package's customInstance
// already unwraps Result<T>, so data resolves to StatsResponse.
const { data: stats, isFetching, refetch } = useGetApiAdminStats();

const totals = computed(() => stats.value?.totals);
const projects = computed<ProjectStats[]>(() => stats.value?.projects ?? []);

type Tone = 'slate' | 'blue' | 'amber' | 'green';

const TONE: Record<Tone, { box: string; value: string }> = {
  slate: { box: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300', value: '' },
  blue: { box: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300', value: 'text-blue-600 dark:text-blue-300' },
  amber: { box: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', value: 'text-amber-600 dark:text-amber-300' },
  green: { box: 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300', value: 'text-green-600 dark:text-green-300' },
};

const cards = computed(() => [
  { key: 'overview.projects', value: totals.value?.projects, icon: Folder, tone: 'slate' as Tone },
  { key: 'overview.users', value: totals.value?.users, icon: UsersIcon, tone: 'slate' as Tone },
  { key: 'overview.comments', value: totals.value?.comments, icon: MessageSquare, tone: 'slate' as Tone },
  { key: 'overview.open', value: totals.value?.open, icon: Circle, tone: 'blue' as Tone },
  { key: 'overview.pending', value: totals.value?.pending, icon: Clock, tone: 'amber' as Tone },
  { key: 'overview.completed', value: totals.value?.completed, icon: CheckCircle2, tone: 'green' as Tone },
  { key: 'overview.archived', value: totals.value?.archived, icon: Archive, tone: 'slate' as Tone },
]);
</script>

<template>
  <div class="flex flex-col gap-8">
    <!-- Stat cards -->
    <div class="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
      <Card v-for="card in cards" :key="card.key">
        <CardContent class="flex items-center gap-3.5 p-4">
          <div
            :class="
              cn(
                'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
                TONE[card.tone].box,
              )
            "
          >
            <component :is="card.icon" class="h-6 w-6" />
          </div>
          <div class="flex flex-col">
            <div
              :class="cn('text-[1.7rem] font-bold leading-tight', TONE[card.tone].value)"
            >
              {{ card.value ?? 0 }}
            </div>
            <div class="mt-0.5 text-[0.72rem] uppercase tracking-wide text-muted-foreground">
              {{ t(card.key) }}
            </div>
            <div
              v-if="card.key === 'overview.comments' && (totals?.privateComments ?? 0) > 0"
              class="mt-1 inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground"
            >
              {{ t('overview.privateHidden', { count: totals?.privateComments ?? 0 }) }}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Projects breakdown -->
    <div>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">{{ t('overview.breakdown') }}</h2>
        <Button variant="outline" size="sm" :disabled="isFetching" @click="() => refetch()">
          <RefreshCw :class="cn('h-4 w-4', isFetching && 'animate-spin')" />
          {{ t('common.refresh') }}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('overview.key') }}</TableHead>
              <TableHead>{{ t('overview.name') }}</TableHead>
              <TableHead>{{ t('overview.comments') }}</TableHead>
              <TableHead>{{ t('overview.private') }}</TableHead>
              <TableHead>{{ t('overview.open') }}</TableHead>
              <TableHead>{{ t('overview.pending') }}</TableHead>
              <TableHead>{{ t('overview.completed') }}</TableHead>
              <TableHead>{{ t('overview.archived') }}</TableHead>
              <TableHead>{{ t('overview.status') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in projects" :key="row.projectId ?? row.key ?? ''">
              <TableCell>
                <code class="rounded bg-muted px-1.5 py-0.5 text-xs">{{ row.key }}</code>
              </TableCell>
              <TableCell>{{ row.name }}</TableCell>
              <TableCell>{{ row.comments }}</TableCell>
              <TableCell>
                <span
                  v-if="(row.privateComments ?? 0) > 0"
                  class="chip chip-private"
                  :title="t('overview.privateHiddenTooltip')"
                >
                  <Lock class="h-3 w-3" />
                  {{ row.privateComments }}
                </span>
                <span v-else class="text-muted-foreground">—</span>
              </TableCell>
              <TableCell class="font-medium text-blue-600 dark:text-blue-300">{{ row.open }}</TableCell>
              <TableCell class="font-medium text-amber-600 dark:text-amber-300">{{ row.pending }}</TableCell>
              <TableCell class="font-medium text-green-600 dark:text-green-300">{{ row.completed }}</TableCell>
              <TableCell class="font-medium text-slate-600 dark:text-slate-300">{{ row.archived }}</TableCell>
              <TableCell>
                <span :class="cn('chip', row.isActive ? 'chip-active' : 'chip-disabled')">
                  {{ t(row.isActive ? 'common.active' : 'common.disabled') }}
                </span>
              </TableCell>
            </TableRow>
            <TableEmpty v-if="projects.length === 0" :colspan="9" class="py-10">
              {{ t('overview.noPending') }}
            </TableEmpty>
          </TableBody>
        </Table>
      </Card>
    </div>
  </div>
</template>
