<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { ColumnDef } from '@tanstack/vue-table';
import {
  useGetApiAdminProjects,
  useGetApiProjectsKeyComments,
  CommentStatus,
  EnvironmentTag,
  type CommentListItemDto,
  type ProjectResponse,
  type GetApiProjectsKeyCommentsParams,
} from '@moamen-ui/pointer-vue';
import { Search, Flag, Lock, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, dataTableFeatures } from '@/components/shared/data-table';
import CommentDetail from '@/features/comments/CommentDetail.vue';
import { commentStatusLabel, commentStatusVariant, commentEnvironmentLabel, shortSha } from '@/lib/commentLabels';
import { formatRelativeTime } from '@/lib/relativeTime';
import { getItem, setItem, COMMENTS_LAST_PROJECT_KEY } from '@/lib/storage';
import { cn } from '@/lib/utils';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const PAGE_SIZE = 25;

// ── Project picker ──────────────────────────────────────────────────────
const { data: projectsData, isLoading: projectsLoading } = useGetApiAdminProjects();
const projects = computed<ProjectResponse[]>(() => projectsData.value ?? []);

const selectedProjectKey = ref<string | undefined>(undefined);

// ── Filters (URL-driven so the view is shareable) ──────────────────────
const statusFilter = ref<number | undefined>(undefined);
const envFilter = ref<number | undefined>(undefined);
const flaggedFilter = ref(false);
const liveFilter = ref<boolean | undefined>(undefined); // undefined = All, true = Live, false = applied-not-live
const search = ref('');
const searchInput = ref('');
const pageNumber = ref(1);

const openCommentId = ref<number | null>(null);
const detailOpen = ref(false);

// One-time parse of the initial URL (project/comment get live inbound sync below too, for the
// notifications bell navigating here while already on this route).
{
  const q = route.query;
  selectedProjectKey.value =
    typeof q.project === 'string' && q.project ? q.project : (getItem(COMMENTS_LAST_PROJECT_KEY) ?? undefined);
  const initialCommentId = typeof q.comment === 'string' && q.comment ? Number(q.comment) : null;
  openCommentId.value = initialCommentId && !Number.isNaN(initialCommentId) ? initialCommentId : null;
  detailOpen.value = openCommentId.value != null;
  const initialStatus = typeof q.status === 'string' && q.status ? Number(q.status) : undefined;
  statusFilter.value = initialStatus && !Number.isNaN(initialStatus) ? initialStatus : undefined;
  const initialEnv = typeof q.env === 'string' && q.env !== '' ? Number(q.env) : undefined;
  envFilter.value = initialEnv != null && !Number.isNaN(initialEnv) ? initialEnv : undefined;
  flaggedFilter.value = q.flagged === '1';
  liveFilter.value = q.live === '1' ? true : q.live === '0' ? false : undefined;
  search.value = typeof q.q === 'string' ? q.q : '';
  searchInput.value = search.value;
}

// Default to the first accessible project once the list loads, if neither the URL nor
// localStorage supplied one.
watch(
  projects,
  (list) => {
    if (!selectedProjectKey.value && list.length > 0) {
      selectedProjectKey.value = list[0].key ?? undefined;
    }
  },
  { immediate: true },
);

watch(selectedProjectKey, (key) => {
  if (key) setItem(COMMENTS_LAST_PROJECT_KEY, key);
});

// Debounce the search box 300ms before it hits the API/URL.
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(searchInput, (value) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    search.value = value.trim();
  }, 300);
});

// Any filter (or project) change starts the list over at page 1.
watch([selectedProjectKey, statusFilter, envFilter, flaggedFilter, liveFilter, search], () => {
  pageNumber.value = 1;
});

// Inbound sync: the notifications bell (Shell.vue) navigates to
// /comments?project=<key>&comment=<id> — if we're already mounted on this route, vue-router
// updates route.query without remounting the page, so pick that up here.
watch(
  () => route.query.project,
  (q) => {
    if (typeof q === 'string' && q && q !== selectedProjectKey.value) {
      selectedProjectKey.value = q;
    }
  },
);
watch(
  () => route.query.comment,
  (q) => {
    const idNum = typeof q === 'string' && q ? Number(q) : null;
    const next = idNum != null && !Number.isNaN(idNum) ? idNum : null;
    if (next !== openCommentId.value) {
      openCommentId.value = next;
      detailOpen.value = next != null;
    }
  },
);

// Outbound sync: reflect current state back into the URL (shareable links).
watch(
  [selectedProjectKey, openCommentId, statusFilter, envFilter, flaggedFilter, liveFilter, search],
  () => {
    const query: Record<string, string> = {};
    if (selectedProjectKey.value) query.project = selectedProjectKey.value;
    if (openCommentId.value != null) query.comment = String(openCommentId.value);
    if (statusFilter.value != null) query.status = String(statusFilter.value);
    if (envFilter.value != null) query.env = String(envFilter.value);
    if (flaggedFilter.value) query.flagged = '1';
    if (liveFilter.value === true) query.live = '1';
    else if (liveFilter.value === false) query.live = '0';
    if (search.value) query.q = search.value;
    void router.replace({ query });
  },
);

function clearFilters() {
  statusFilter.value = undefined;
  envFilter.value = undefined;
  flaggedFilter.value = false;
  liveFilter.value = undefined;
  search.value = '';
  searchInput.value = '';
}

const hasActiveFilters = computed(
  () =>
    statusFilter.value != null ||
    envFilter.value != null ||
    flaggedFilter.value ||
    liveFilter.value != null ||
    !!search.value,
);

// ── List query ──────────────────────────────────────────────────────────
const listParams = computed<GetApiProjectsKeyCommentsParams>(() => ({
  Status: statusFilter.value as GetApiProjectsKeyCommentsParams['Status'],
  Environment: envFilter.value as GetApiProjectsKeyCommentsParams['Environment'],
  Flagged: flaggedFilter.value || undefined,
  Live: liveFilter.value,
  Search: search.value || undefined,
  PageNumber: pageNumber.value,
  PageSize: PAGE_SIZE,
}));
const projectKeyOrEmpty = computed(() => selectedProjectKey.value ?? '');

const listQuery = useGetApiProjectsKeyComments(projectKeyOrEmpty, listParams, {
  query: { enabled: () => !!selectedProjectKey.value },
});

const items = computed<CommentListItemDto[]>(() => listQuery.data.value?.items ?? []);
const pagination = computed(() => listQuery.data.value?.pagination);
const hiddenPrivateCount = computed(() => listQuery.data.value?.hiddenPrivateCount ?? 0);
const loading = computed(() => listQuery.isLoading.value || (projectsLoading.value && !selectedProjectKey.value));

const canPrevPage = computed(() => (pagination.value?.pageNumber ?? 1) > 1);
const canNextPage = computed(() => (pagination.value?.pageNumber ?? 1) < (pagination.value?.totalPages ?? 1));

function goPrevPage() {
  if (canPrevPage.value) pageNumber.value = Math.max(1, pageNumber.value - 1);
}
function goNextPage() {
  if (canNextPage.value) pageNumber.value = pageNumber.value + 1;
}

// ── Table ─────────────────────────────────────────────────────────────
const columns = computed<ColumnDef<typeof dataTableFeatures, CommentListItemDto>[]>(() => [
  { id: 'body', header: t('comments.bodyColumn'), enableSorting: false, meta: { mobile: 'primary' } },
  { id: 'status', header: t('comments.statusColumn'), enableSorting: false },
  { id: 'environment', header: t('comments.environmentColumn'), enableSorting: false },
  { id: 'route', header: t('comments.routeColumn'), enableSorting: false },
  { id: 'author', header: t('comments.authorColumn'), enableSorting: false },
  { id: 'created', header: t('comments.createdColumn'), enableSorting: false },
  { id: 'deploy', header: t('comments.deployColumn'), enableSorting: false },
]);

function openDetail(row: CommentListItemDto) {
  if (row.id != null) openCommentId.value = row.id;
  detailOpen.value = true;
}

function onDetailOpenChange(open: boolean) {
  detailOpen.value = open;
  if (!open) openCommentId.value = null;
}

function onDetailDeleted() {
  detailOpen.value = false;
  openCommentId.value = null;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-[20px] font-semibold leading-7 tracking-[-0.01em]">{{ t('comments.title') }}</h1>
      <Select v-model="selectedProjectKey">
        <SelectTrigger class="w-[220px]">
          <SelectValue :placeholder="t('comments.selectProjectPlaceholder')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="project in projects" :key="project.id" :value="project.key ?? ''">
            {{ project.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <template v-if="projectsLoading && !selectedProjectKey">
      <div class="h-8 w-64 rounded bg-gutter animate-pulse" />
    </template>

    <template v-else>
      <!-- Filter bar — below sm: a clean vertical stack, every control full width. Hidden until a
           project is selected (nothing to filter yet); the table itself always renders below,
           with "select a project" expressed as its own `empty` EmptyState copy (#190). -->
      <div v-if="selectedProjectKey" class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <Select
          :model-value="statusFilter != null ? String(statusFilter) : 'all'"
          @update:model-value="(v: any) => (statusFilter = v === 'all' ? undefined : Number(v))"
        >
          <SelectTrigger class="h-8 w-full max-sm:h-10 sm:w-[9.5rem]">
            <SelectValue :placeholder="t('comments.statusLabel')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('comments.statusAll') }}</SelectItem>
            <SelectItem :value="String(CommentStatus.NUMBER_1)">{{ t('comments.statusOpen') }}</SelectItem>
            <SelectItem :value="String(CommentStatus.NUMBER_2)">{{ t('comments.statusReadyToApply') }}</SelectItem>
            <SelectItem :value="String(CommentStatus.NUMBER_3)">{{ t('comments.statusApplied') }}</SelectItem>
            <SelectItem :value="String(CommentStatus.NUMBER_4)">{{ t('comments.statusArchived') }}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          :model-value="envFilter != null ? String(envFilter) : 'all'"
          @update:model-value="(v: any) => (envFilter = v === 'all' ? undefined : Number(v))"
        >
          <SelectTrigger class="h-8 w-full max-sm:h-10 sm:w-[9.5rem]">
            <SelectValue :placeholder="t('comments.environmentLabel')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('comments.environmentAll') }}</SelectItem>
            <SelectItem :value="String(EnvironmentTag.NUMBER_1)">{{ t('comments.environmentLocal') }}</SelectItem>
            <SelectItem :value="String(EnvironmentTag.NUMBER_2)">{{ t('comments.environmentStaging') }}</SelectItem>
            <SelectItem :value="String(EnvironmentTag.NUMBER_3)">{{ t('comments.environmentProduction') }}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          class="max-sm:h-10 max-sm:w-full"
          :variant="flaggedFilter ? 'default' : 'outline'"
          @click="flaggedFilter = !flaggedFilter"
        >
          <Flag class="h-4 w-4" /> {{ t('comments.flagged') }}
        </Button>

        <!-- Live tri-state segmented control -->
        <div class="inline-flex gap-0.5 rounded-md border border-border bg-gutter p-0.5 max-sm:flex max-sm:w-full">
          <button
            type="button"
            :class="
              cn(
                'h-7 px-3 rounded-[4px] text-[13px] font-medium transition-colors max-sm:h-10 max-sm:flex-1',
                liveFilter === undefined
                  ? 'bg-background text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground',
              )
            "
            @click="liveFilter = undefined"
          >
            {{ t('comments.liveAll') }}
          </button>
          <button
            type="button"
            :class="
              cn(
                'h-7 px-3 rounded-[4px] text-[13px] font-medium transition-colors max-sm:h-10 max-sm:flex-1',
                liveFilter === false
                  ? 'bg-background text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground',
              )
            "
            @click="liveFilter = false"
          >
            {{ t('comments.liveNotLive') }}
          </button>
          <button
            type="button"
            :class="
              cn(
                'h-7 px-3 rounded-[4px] text-[13px] font-medium transition-colors max-sm:h-10 max-sm:flex-1',
                liveFilter === true
                  ? 'bg-background text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground',
              )
            "
            @click="liveFilter = true"
          >
            {{ t('comments.liveLive') }}
          </button>
        </div>

        <div class="relative w-full sm:max-w-[240px]">
          <Search class="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="searchInput" class="h-8 max-sm:h-10 ps-9" :placeholder="t('comments.searchPlaceholder')" />
        </div>
      </div>

      <p v-if="selectedProjectKey && hiddenPrivateCount > 0" class="flex items-center gap-1 text-[12px] text-muted-foreground">
        <Lock class="h-3 w-3" /> {{ t('comments.hiddenPrivateCount', { n: hiddenPrivateCount }) }}
      </p>

      <!-- #190: the table (header + empty state) always renders, even with no project selected —
           "select a project" is expressed as the table's own `empty` EmptyState copy instead of
           replacing the whole table. -->
      <DataTable
        :data="items"
        :columns="columns"
        :row-click="openDetail"
        :paginated="false"
        gutter
        :loading="loading"
        :empty-message="!selectedProjectKey ? t('comments.emptyNoProject') : t('comments.empty')"
        :empty-hint="
          !selectedProjectKey
            ? t('comments.noProjectSelectedHint')
            : hasActiveFilters
              ? t('comments.emptyHintFiltered')
              : t('comments.emptyHint')
        "
      >
        <template #cell-body="{ row }">
          <div class="flex max-w-[360px] flex-col gap-1">
            <div v-if="row.isPrivate || row.hasPayloadFlag || row.isBugReport" class="flex flex-wrap items-center gap-1.5">
              <Lock v-if="row.isPrivate" class="h-3 w-3 shrink-0 text-muted-foreground" :aria-label="t('comments.privateTooltip')" />
              <Badge v-if="row.hasPayloadFlag" variant="danger" class="shrink-0">{{ t('comments.flaggedBadge') }}</Badge>
              <Badge v-if="row.isBugReport" variant="neutral" class="shrink-0">{{ t('comments.bugBadge') }}</Badge>
            </div>
            <p class="line-clamp-2 text-[14px]">{{ row.body }}</p>
          </div>
        </template>
        <template #cell-status="{ row }">
          <Badge :variant="commentStatusVariant(row.status)">{{ commentStatusLabel(t, row.status) }}</Badge>
        </template>
        <template #cell-environment="{ row }">
          <Badge variant="neutral">{{ commentEnvironmentLabel(t, row.environment) }}</Badge>
        </template>
        <template #cell-route="{ row }">
          <code class="block max-w-[180px] truncate font-mono text-[13px]" :title="row.element?.route ?? undefined">
            {{ row.element?.route ?? '—' }}
          </code>
        </template>
        <template #cell-author="{ row }">
          <span class="whitespace-nowrap">{{ row.authorName ?? '—' }}</span>
        </template>
        <template #cell-created="{ row }">
          <span class="whitespace-nowrap text-muted-foreground">{{ formatRelativeTime(row.createdAt, t) }}</span>
        </template>
        <template #cell-deploy="{ row }">
          <Badge v-if="row.deployedAt" variant="completed" :title="shortSha(row.deployedSha)">
            {{ t('comments.deployLive') }}
          </Badge>
          <Badge v-else-if="row.appliedAt" variant="neutral">{{ t('comments.deployApplied') }}</Badge>
          <span v-else class="text-muted-foreground">—</span>
        </template>
      </DataTable>

      <!-- DataTable's own `#empty-action` slot only renders inside a trailing actions column,
           which this table doesn't have (row actions live in the detail dialog) — so the "clear
           filters" affordance for a filtered-to-zero result sits here instead. -->
      <div v-if="selectedProjectKey && hasActiveFilters && !loading && items.length === 0" class="flex justify-start">
        <Button size="sm" variant="outline" @click="clearFilters">{{ t('comments.clearFilters') }}</Button>
      </div>

      <!-- Server-driven pagination footer (the shared DataTable's own pager is client-side only,
           and this list is paged server-side at 25/page). Same grammar as its built-in footer. -->
      <div
        v-if="selectedProjectKey && pagination && (pagination.totalPages ?? 1) > 1"
        class="flex min-h-11 flex-wrap items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-[13px] text-muted-foreground max-md:justify-center md:justify-between"
      >
        <span class="max-md:hidden">{{ t('table.rowsOf', { shown: items.length, total: pagination.totalItems ?? 0 }) }}</span>
        <div class="flex items-center gap-2">
          <Button variant="secondary" size="sm" class="max-md:h-10 max-md:min-w-10" :aria-label="t('table.previousPage')" :disabled="!canPrevPage" @click="goPrevPage">
            <ChevronLeft class="h-4 w-4 rtl:-scale-x-100" />
          </Button>
          <span>{{ t('table.pageOf', { page: pagination.pageNumber ?? 1, pages: pagination.totalPages ?? 1 }) }}</span>
          <Button variant="secondary" size="sm" class="max-md:h-10 max-md:min-w-10" :aria-label="t('table.nextPage')" :disabled="!canNextPage" @click="goNextPage">
            <ChevronRight class="h-4 w-4 rtl:-scale-x-100" />
          </Button>
        </div>
      </div>
    </template>
  </div>

  <CommentDetail
    :open="detailOpen"
    :id="openCommentId"
    :project-key="selectedProjectKey ?? ''"
    @update:open="onDetailOpenChange"
    @deleted="onDetailDeleted"
  />
</template>
