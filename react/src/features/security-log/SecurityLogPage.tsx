// Security log — read-only audit trail (DB-12). Workspace admins see their own workspace
// via GET /api/admin/audit; super admins are redirected to the /all view (the workspace
// endpoint 403s them, §3.8a) which adds a Workspace filter plus userAgent/ipHash columns.
// Filters live in the URL (mirrors features/comments/CommentsPage.tsx) so a filtered link
// is shareable; paging is server-side (`manualPagination`).
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useGetApiAdminAudit,
  useGetApiAdminAuditAll,
  useGetApiAdminTenants,
  type AuditEventDto,
  type TenantResponse,
} from '@moamen-ui/pointer-react';
import { useAuth } from '@/lib/auth';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { extractMessage } from '@/lib/error';
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
import { SecurityLogEventDetail } from './SecurityLogEventDetail';
import {
  ACTION_PREFIX_RE,
  actionLabel,
  actorKindBadgeVariant,
  actorKindLabel,
  targetTypeLabel,
  truncateMiddle,
} from './security-log-format';

const PAGE_SIZE = 50; // doc default; the API caps PageSize at 200 — never requested here.

export function SecurityLogPage() {
  const { t } = useTranslation();
  const { isSuperAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  }

  const sinceParam = searchParams.get('since') ?? '';
  const untilParam = searchParams.get('until') ?? '';
  const actionParam = searchParams.get('action') ?? '';
  const actorParam = searchParams.get('actor') ?? '';
  const targetTypeParam = searchParams.get('targetType') ?? '';
  const workspaceIdParam = searchParams.get('workspaceId') ?? '';

  // Free-text inputs debounce into the URL, same as CommentsPage's search box, so every
  // keystroke doesn't refetch.
  const [actionInput, setActionInput] = useState(actionParam);
  const [actorInput, setActorInput] = useState(actorParam);
  useEffect(() => setActionInput(actionParam), [actionParam]);
  useEffect(() => setActorInput(actorParam), [actorParam]);
  const debouncedAction = useDebouncedValue(actionInput);
  const debouncedActor = useDebouncedValue(actorInput);
  useEffect(() => {
    if (debouncedAction !== actionParam) updateParams({ action: debouncedAction || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAction]);
  useEffect(() => {
    if (debouncedActor !== actorParam) updateParams({ actor: debouncedActor || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedActor]);

  // `AuditQuery.Action` is validated server-side against ^[a-z_.]{1,64}$ (doc §11) —
  // checked here too so an invalid prefix is never sent (and never silently 400s).
  const actionInvalid = actionInput.length > 0 && !ACTION_PREFIX_RE.test(actionInput);
  const effectiveAction = ACTION_PREFIX_RE.test(debouncedAction) ? debouncedAction : '';

  const [pageNumber, setPageNumber] = useState(1);
  useEffect(() => {
    setPageNumber(1);
  }, [sinceParam, untilParam, effectiveAction, debouncedActor, targetTypeParam, workspaceIdParam]);

  // Date inputs are calendar days; Since is the start of that day, Until the end of it,
  // so a single-day range (Since === Until) still matches events anywhere in that day.
  const params = useMemo(
    () => ({
      ...(sinceParam ? { Since: new Date(`${sinceParam}T00:00:00`).toISOString() } : {}),
      ...(untilParam ? { Until: new Date(`${untilParam}T23:59:59.999`).toISOString() } : {}),
      ...(effectiveAction ? { Action: effectiveAction } : {}),
      ...(debouncedActor.trim() ? { Actor: debouncedActor.trim() } : {}),
      ...(targetTypeParam ? { TargetType: targetTypeParam } : {}),
      ...(isSuperAdmin && workspaceIdParam ? { WorkspaceId: workspaceIdParam } : {}),
      Page: pageNumber,
      PageSize: PAGE_SIZE,
    }),
    [sinceParam, untilParam, effectiveAction, debouncedActor, targetTypeParam, workspaceIdParam, isSuperAdmin, pageNumber],
  );

  // Super admins are 403'd by the workspace endpoint (§3.8a) — they always read /all.
  const workspaceQuery = useGetApiAdminAudit(params, { query: { enabled: !isSuperAdmin } });
  const allQuery = useGetApiAdminAuditAll(params, { query: { enabled: isSuperAdmin } });
  const { data, isLoading, isError, error, refetch } = isSuperAdmin ? allQuery : workspaceQuery;

  // Super-admin-only: resolve workspaceId -> label for the Workspace filter and column
  // (AuditEventDto only carries the id; TenantsPage's list is the same data super admins
  // already read elsewhere).
  const { data: tenantsData } = useGetApiAdminTenants({ query: { enabled: isSuperAdmin } });
  const tenants: TenantResponse[] = tenantsData ?? [];
  const workspaceLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const tenant of tenants) {
      if (tenant.workspaceId) map.set(tenant.workspaceId, tenant.workspaceName || tenant.email || tenant.workspaceId);
    }
    return map;
  }, [tenants]);

  const items: AuditEventDto[] = data?.items ?? [];
  const pagination = data?.pagination;

  const [selectedEvent, setSelectedEvent] = useState<AuditEventDto | null>(null);

  const hasActiveFilters = !!(sinceParam || untilParam || actionParam || actorParam || targetTypeParam || workspaceIdParam);
  function clearFilters() {
    updateParams({ since: null, until: null, action: null, actor: null, targetType: null, workspaceId: null });
    setActionInput('');
    setActorInput('');
  }

  const columns: ColumnDef<AuditEventDto>[] = [
    {
      id: 'action',
      header: t('securityLog.action'),
      enableSorting: false,
      meta: { mobile: 'primary' },
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-medium">{actionLabel(t, row.original.action)}</span>
          <code className="text-[12px] text-faint-foreground">{row.original.action ?? '—'}</code>
        </div>
      ),
    },
    {
      id: 'occurredAt',
      header: t('securityLog.time'),
      enableSorting: false,
      cell: ({ row }) => {
        const value = row.original.occurredAt;
        const date = value ? new Date(value) : null;
        return (
          <span className="text-[13px] text-muted-foreground" title={value ?? undefined}>
            {date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '—'}
          </span>
        );
      },
    },
    {
      id: 'actor',
      header: t('securityLog.actor'),
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span className="text-[14px]">{row.original.actorName ?? t('securityLog.systemActor')}</span>
          <Badge variant={actorKindBadgeVariant()} hideGlyph>
            {actorKindLabel(t, row.original.actorKind)}
          </Badge>
        </div>
      ),
    },
    {
      id: 'target',
      header: t('securityLog.target'),
      enableSorting: false,
      cell: ({ row }) => {
        const { targetType, targetId } = row.original;
        if (!targetType) return <span className="text-faint-foreground">—</span>;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px]">{targetTypeLabel(t, targetType)}</span>
            {targetId && (
              <code
                className="text-[12px] text-faint-foreground font-mono truncate max-w-[160px]"
                title={targetId}
              >
                {truncateMiddle(targetId, 12)}
              </code>
            )}
          </div>
        );
      },
    },
    ...(isSuperAdmin
      ? [
          {
            id: 'workspace',
            header: t('securityLog.workspace'),
            enableSorting: false,
            cell: ({ row }: { row: { original: AuditEventDto } }) => {
              const id = row.original.workspaceId;
              if (!id) return <span className="text-faint-foreground">{t('securityLog.systemWide')}</span>;
              return (
                <span className="text-[13px]" title={id}>
                  {workspaceLabels.get(id) ?? truncateMiddle(id, 12)}
                </span>
              );
            },
          } satisfies ColumnDef<AuditEventDto>,
        ]
      : []),
    {
      id: 'requestId',
      header: t('securityLog.requestId'),
      enableSorting: false,
      meta: { mobile: 'hide' },
      cell: ({ row }) => {
        const id = row.original.requestId;
        if (!id) return <span className="text-faint-foreground">—</span>;
        return (
          <code className="font-mono text-[12px] text-muted-foreground" title={id}>
            {truncateMiddle(id, 10)}
          </code>
        );
      },
    },
    ...(isSuperAdmin
      ? [
          {
            id: 'ipHash',
            header: t('securityLog.ipHash'),
            enableSorting: false,
            meta: { mobile: 'hide' },
            cell: ({ row }: { row: { original: AuditEventDto } }) => (
              <code className="font-mono text-[12px] text-muted-foreground" title={row.original.ipHash ?? undefined}>
                {row.original.ipHash ? truncateMiddle(row.original.ipHash, 10) : '—'}
              </code>
            ),
          } satisfies ColumnDef<AuditEventDto>,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
          {t('securityLog.title')}
        </h1>
      </div>

      {/* Filter toolbar — wraps into a vertical stack below sm (DESIGN.md target), same
          shape as CommentsPage's toolbar. */}
      <div className="flex flex-wrap items-end gap-2.5 max-sm:flex-col max-sm:items-stretch">
        <div className="flex flex-col gap-1">
          <label htmlFor="sl-since" className="text-[12px] text-muted-foreground">
            {t('securityLog.since')}
          </label>
          <Input
            id="sl-since"
            type="date"
            className="h-8 w-[150px] max-sm:w-full"
            value={sinceParam}
            max={untilParam || undefined}
            onChange={(e) => updateParams({ since: e.target.value || null })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sl-until" className="text-[12px] text-muted-foreground">
            {t('securityLog.until')}
          </label>
          <Input
            id="sl-until"
            type="date"
            className="h-8 w-[150px] max-sm:w-full"
            value={untilParam}
            min={sinceParam || undefined}
            onChange={(e) => updateParams({ until: e.target.value || null })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sl-action" className="text-[12px] text-muted-foreground">
            {t('securityLog.actionFilter')}
          </label>
          <Input
            id="sl-action"
            className="h-8 w-[170px] max-sm:w-full"
            placeholder={t('securityLog.actionFilterPlaceholder')}
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            aria-invalid={actionInvalid}
          />
          {actionInvalid && (
            <p className="text-[12px] text-state-danger">{t('securityLog.actionFilterInvalid')}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sl-actor" className="text-[12px] text-muted-foreground">
            {t('securityLog.actorFilter')}
          </label>
          <Input
            id="sl-actor"
            className="h-8 w-[170px] max-sm:w-full"
            placeholder={t('securityLog.actorFilterPlaceholder')}
            value={actorInput}
            onChange={(e) => setActorInput(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sl-target" className="text-[12px] text-muted-foreground">
            {t('securityLog.targetFilter')}
          </label>
          <Input
            id="sl-target"
            className="h-8 w-[170px] max-sm:w-full"
            placeholder={t('securityLog.targetFilterPlaceholder')}
            value={targetTypeParam}
            onChange={(e) => updateParams({ targetType: e.target.value || null })}
          />
        </div>
        {isSuperAdmin && (
          <div className="flex flex-col gap-1">
            <label htmlFor="sl-workspace" className="text-[12px] text-muted-foreground">
              {t('securityLog.workspaceFilter')}
            </label>
            <Select
              value={workspaceIdParam || 'all'}
              onValueChange={(v) => updateParams({ workspaceId: v === 'all' ? null : v })}
            >
              <SelectTrigger id="sl-workspace" className="h-8 w-[200px] max-sm:w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('securityLog.allWorkspaces')}</SelectItem>
                {tenants
                  .filter((tenant) => !!tenant.workspaceId)
                  .map((tenant) => (
                    <SelectItem key={tenant.workspaceId} value={tenant.workspaceId!}>
                      {tenant.workspaceName || tenant.email || tenant.workspaceId}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <DataTable
        data={items}
        columns={columns}
        onRowClick={(row) => setSelectedEvent(row)}
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
        error={isError ? extractMessage(error) : null}
        onRetry={() => void refetch()}
        emptyMessage={hasActiveFilters ? t('securityLog.noResults') : t('securityLog.empty')}
        emptyHint={hasActiveFilters ? undefined : t('securityLog.emptyHint')}
        emptyAction={
          hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              {t('comments.clearFilters')}
            </Button>
          ) : undefined
        }
      />

      {isLoading && !data && (
        <p className="text-[13px] text-muted-foreground">{t('securityLog.loading')}</p>
      )}

      {selectedEvent && (
        <SecurityLogEventDetail
          event={selectedEvent}
          showOperatorColumns={isSuperAdmin}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
