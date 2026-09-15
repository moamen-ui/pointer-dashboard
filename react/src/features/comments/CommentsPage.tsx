// Comments screen — a filterable, paged table of one project's feedback with a detail
// dialog. Query params drive filter/selection state so links are shareable (wired from
// NotificationsBell) and mirror on browser back/forward. Route: /comments.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useGetApiAdminProjects,
  useGetApiProjectsKeyComments,
  getGetApiProjectsKeyCommentsQueryKey,
  type CommentListItemDto,
  type CommentStatus,
  type EnvironmentTag,
} from '@moamen-ui/pointer-react';
import { AlertTriangle, Bug, Lock, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/shared/data-table/DataTable';
import { CommentDetail } from './CommentDetail';
import { badgeVariantForStatus, environmentLabelKey } from './comment-format';
import { useStatusCatalog } from '@/lib/status-catalog';
import { formatRelativeTime } from '@/lib/format';
import { getItem, setItem } from '@/lib/storage';
import { cn } from '@/lib/utils';

const LAST_PROJECT_KEY = 'pointer_comments_project';
const PAGE_SIZE = 25;

function commitShort(sha: string | null | undefined): string | undefined {
  return sha ? sha.slice(0, 7) : undefined;
}

export function CommentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const catalog = useStatusCatalog();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: projects = [] } = useGetApiAdminProjects();

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  }

  // ---- project selection: URL param, else last-used, else the first project ----
  const projectParam = searchParams.get('project') ?? '';
  const projectKey = useMemo(() => {
    if (projectParam && projects.some((p) => p.key === projectParam)) return projectParam;
    const last = getItem(LAST_PROJECT_KEY);
    if (last && projects.some((p) => p.key === last)) return last;
    return projects[0]?.key ?? '';
  }, [projectParam, projects]);

  useEffect(() => {
    if (!projectKey) return;
    setItem(LAST_PROJECT_KEY, projectKey);
    if (projectParam !== projectKey) updateParams({ project: projectKey });
    // Only re-run when the resolved key actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

  function selectProject(key: string) {
    setItem(LAST_PROJECT_KEY, key);
    updateParams({ project: key, comment: null });
  }

  // ---- filters (all in the URL) ----
  const statusParam = searchParams.get('status') ?? '';
  const envParam = searchParams.get('env') ?? '';
  const flaggedParam = searchParams.get('flagged') === '1';
  const liveParam = searchParams.get('live'); // '1' | '0' | null
  const qParam = searchParams.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(qParam);
  useEffect(() => setSearchInput(qParam), [qParam]);
  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchInput !== qParam) updateParams({ q: searchInput || null });
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const [pageNumber, setPageNumber] = useState(1);
  useEffect(() => {
    setPageNumber(1);
  }, [projectKey, statusParam, envParam, flaggedParam, liveParam, qParam]);

  const params = useMemo(
    () => ({
      ...(statusParam ? { Status: Number(statusParam) as CommentStatus } : {}),
      ...(envParam ? { Environment: Number(envParam) as EnvironmentTag } : {}),
      ...(flaggedParam ? { Flagged: true } : {}),
      ...(liveParam === '1' ? { Live: true } : liveParam === '0' ? { Live: false } : {}),
      ...(qParam ? { Search: qParam } : {}),
      PageNumber: pageNumber,
      PageSize: PAGE_SIZE,
    }),
    [statusParam, envParam, flaggedParam, liveParam, qParam, pageNumber],
  );

  const { data } = useGetApiProjectsKeyComments(projectKey, params, {
    query: { enabled: !!projectKey },
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const hiddenPrivateCount = data?.hiddenPrivateCount ?? 0;

  function reloadList() {
    if (projectKey) {
      void qc.invalidateQueries({ queryKey: getGetApiProjectsKeyCommentsQueryKey(projectKey) });
    }
  }

  // ---- detail dialog ----
  const commentIdParam = searchParams.get('comment');
  const commentId = commentIdParam ? Number(commentIdParam) : null;
  function openComment(id: number) {
    updateParams({ comment: String(id) });
  }
  function closeComment() {
    updateParams({ comment: null });
  }

  const hasActiveFilters = !!(statusParam || envParam || flaggedParam || liveParam || qParam);
  function clearFilters() {
    updateParams({ status: null, env: null, flagged: null, live: null, q: null });
    setSearchInput('');
  }

  const columns: ColumnDef<CommentListItemDto>[] = [
    {
      id: 'body',
      header: t('comments.bodyColumn'),
      enableSorting: false,
      meta: { mobile: 'primary' },
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex max-w-[420px] flex-col gap-1">
            {(c.isPrivate || c.hasPayloadFlag || c.isBugReport) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {c.isPrivate && (
                  <Lock
                    className="h-3 w-3 shrink-0 text-muted-foreground"
                    aria-label={t('comments.privateTooltip')}
                  />
                )}
                {c.hasPayloadFlag && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    {t('comments.flaggedBadge')}
                  </Badge>
                )}
                {c.isBugReport && (
                  <Badge variant="neutral" hideGlyph>
                    <Bug className="h-3 w-3" aria-hidden="true" />
                    {t('comments.bugBadge')}
                  </Badge>
                )}
              </div>
            )}
            <span className="line-clamp-2 text-[14px]">{c.body || '—'}</span>
          </div>
        );
      },
    },
    {
      id: 'status',
      header: t('comments.status'),
      enableSorting: false,
      cell: ({ row }) => {
        const item = catalog.items.find((s) => s.value === row.original.status);
        return (
          <Badge variant={badgeVariantForStatus(row.original.status)}>
            {item ? catalog.displayLabel(item) : '—'}
          </Badge>
        );
      },
    },
    {
      id: 'environment',
      header: t('comments.environment'),
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant="neutral" hideGlyph>
          {t(environmentLabelKey(row.original.environment))}
        </Badge>
      ),
    },
    {
      id: 'route',
      header: t('comments.routeColumn'),
      enableSorting: false,
      cell: ({ row }) => (
        <code
          className="block max-w-[200px] truncate font-mono text-[13px] text-muted-foreground"
          title={row.original.element?.route ?? undefined}
        >
          {row.original.element?.route || '—'}
        </code>
      ),
    },
    {
      id: 'author',
      header: t('comments.authorColumn'),
      enableSorting: false,
      cell: ({ row }) => <span className="text-[14px]">{row.original.authorName || '—'}</span>,
    },
    {
      id: 'created',
      header: t('comments.createdColumn'),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground" title={row.original.createdAt ?? undefined}>
          {formatRelativeTime(t, row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'deploy',
      header: t('comments.deployColumn'),
      enableSorting: false,
      cell: ({ row }) => {
        const c = row.original;
        if (!c.appliedAt) return <span className="text-[13px] text-faint-foreground">—</span>;
        if (c.deployedAt) {
          const sha = commitShort(c.deployedSha);
          return (
            <Badge variant="success" title={sha ? t('comments.commitShort', { sha }) : undefined}>
              {t('comments.deployLiveBadge')}
            </Badge>
          );
        }
        return (
          <Badge variant="neutral" hideGlyph>
            {t('comments.deployApplied')}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.01em]">{t('comments.title')}</h1>
      </div>

      {/* #190: the comments table (header + empty state) always renders — even with zero
          projects — so "no projects yet" is the table's own empty-state copy rather than a
          standalone block that replaces the whole screen. The filter toolbar only makes sense
          once there's at least one project to filter within. */}
      {projects.length > 0 && (
        <>
          {/* Filter toolbar: below `sm` every control stacks full-width (DESIGN.md
              target: "filter toolbars wrap into a clean vertical stack below sm:
              selects full-width, segmented controls full-width with equal
              segments, search full-width"). */}
          <div className="flex flex-wrap items-center gap-2.5 max-sm:flex-col max-sm:items-stretch">
            <Select value={projectKey || undefined} onValueChange={selectProject}>
              <SelectTrigger className="h-8 w-[200px] shrink-0 max-sm:w-full">
                <SelectValue placeholder={t('comments.projectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.key ?? ''}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusParam || 'all'}
              onValueChange={(v) => updateParams({ status: v === 'all' ? null : v })}
            >
              <SelectTrigger className="h-8 w-[150px] shrink-0 max-sm:w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('comments.statusAll')}</SelectItem>
                {catalog.items.map((s) => (
                  <SelectItem key={s.value} value={String(s.value)}>
                    {catalog.displayLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={envParam || 'all'}
              onValueChange={(v) => updateParams({ env: v === 'all' ? null : v })}
            >
              <SelectTrigger className="h-8 w-[150px] shrink-0 max-sm:w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('comments.environmentAll')}</SelectItem>
                <SelectItem value="1">{t('comments.env.local')}</SelectItem>
                <SelectItem value="2">{t('comments.env.staging')}</SelectItem>
                <SelectItem value="3">{t('comments.env.production')}</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant={flaggedParam ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateParams({ flagged: flaggedParam ? null : '1' })}
              aria-pressed={flaggedParam}
              className="max-sm:w-full"
            >
              <AlertTriangle className="h-4 w-4" />
              {t('comments.flagged')}
            </Button>

            <div className="inline-flex shrink-0 gap-0.5 rounded-md border border-border bg-gutter p-0.5 max-sm:flex max-sm:w-full">
              {(
                [
                  { value: null, label: t('comments.deployAll') },
                  { value: '0', label: t('comments.deployNotLive') },
                  { value: '1', label: t('comments.deployLive') },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => updateParams({ live: opt.value })}
                  className={cn(
                    'h-7 max-md:h-11 whitespace-nowrap rounded-[4px] px-3 text-[13px] font-medium transition-colors max-sm:flex-1',
                    (liveParam ?? null) === opt.value
                      ? 'border border-border bg-background text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="relative w-full max-w-xs max-sm:max-w-full">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('comments.searchPlaceholder')}
                className="h-8 ps-9"
              />
            </div>
          </div>

          {hiddenPrivateCount > 0 && (
            <p className="flex items-center gap-1 text-[12px] text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden="true" />
              {t('comments.hiddenPrivate', { count: hiddenPrivateCount })}
            </p>
          )}
        </>
      )}

      <DataTable
        data={items}
        columns={columns}
        onRowClick={(row) => row.id != null && openComment(row.id)}
        gutter
        manualPagination={
          pagination
            ? {
                pageNumber: pagination.pageNumber ?? pageNumber,
                totalPages: pagination.totalPages ?? 1,
                totalItems: pagination.totalItems,
                onPageChange: setPageNumber,
              }
            : undefined
        }
        emptyMessage={
          projects.length === 0
            ? t('comments.noProjectsTitle')
            : hasActiveFilters
              ? t('comments.noResults')
              : t('comments.empty')
        }
        emptyHint={
          projects.length === 0
            ? t('comments.noProjectsHint')
            : hasActiveFilters
              ? undefined
              : t('comments.emptyHint')
        }
        emptyAction={
          projects.length > 0 && hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              {t('comments.clearFilters')}
            </Button>
          ) : undefined
        }
      />

      {commentId != null && (
        <CommentDetail commentId={commentId} onClose={closeComment} onChanged={reloadList} />
      )}
    </div>
  );
}
