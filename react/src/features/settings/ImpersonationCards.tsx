// DB-13 §11.5: two variants of the same read model (GET /api/admin/impersonation) — a workspace
// admin sees only their own workspace's sessions (server-scoped, D13.6: no operator identity ever),
// a super admin sees every workspace's and can End the live one. Both are small summary cards, not
// the full audit trail (that is Security Log / DB-12) — first page only, no filters.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useGetApiAdminImpersonation,
  usePostApiAdminImpersonationEnd,
  getGetApiAdminImpersonationQueryKey,
  type ImpersonationSessionDto,
} from '@moamen-ui/pointer-react';
import { Eye, Square } from 'lucide-react';
import { AccordionSection } from '@/components/ui/accordion-section';
import { DataTable } from '@/components/shared/data-table/DataTable';
import { Badge } from '@/components/ui/badge';
import type { RowActionItem } from '@/components/shared/types';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';

const CARD_PAGE_SIZE = 20;

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function isLive(session: ImpersonationSessionDto): boolean {
  if (session.endedAt) return false;
  if (!session.expiresAt) return true;
  return new Date(session.expiresAt).getTime() > Date.now();
}

/** Workspace admin — "Operator access": read-only, own workspace only, no End action (only a
 *  super admin's own token may end a session; D13.6 also means there is no operator identity to
 *  show here even if there were one). */
export function OperatorAccessCard() {
  const { t } = useTranslation();
  const { data, isLoading } = useGetApiAdminImpersonation({ page: 1, pageSize: CARD_PAGE_SIZE });
  const sessions: ImpersonationSessionDto[] = data?.items ?? [];

  const columns: ColumnDef<ImpersonationSessionDto>[] = [
    {
      accessorKey: 'startedAt',
      enableSorting: false,
      header: t('impersonation.colStarted'),
      cell: ({ row }) => (
        <span className="font-mono text-[13px] text-muted-foreground">
          {formatDateTime(row.original.startedAt)}
        </span>
      ),
    },
    {
      accessorKey: 'expiresAt',
      enableSorting: false,
      header: t('impersonation.colEndedExpires'),
      cell: ({ row }) => (
        <span className="font-mono text-[13px] text-muted-foreground">
          {row.original.endedAt ? formatDateTime(row.original.endedAt) : formatDateTime(row.original.expiresAt)}
        </span>
      ),
    },
    {
      accessorKey: 'reason',
      enableSorting: false,
      header: t('impersonation.colReason'),
      cell: ({ row }) => (
        <span className="text-[13px]" title={row.original.reason ?? ''}>
          {row.original.reason || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'requestCount',
      enableSorting: false,
      header: t('impersonation.colRequests'),
      cell: ({ row }) => (
        <span className="font-mono text-[13px]">{row.original.requestCount ?? 0}</span>
      ),
    },
    {
      accessorKey: 'status',
      enableSorting: false,
      header: t('impersonation.colStatus'),
      cell: ({ row }) =>
        isLive(row.original) ? (
          <Badge variant="warning">{t('impersonation.statusLive')}</Badge>
        ) : (
          <Badge variant="neutral">{row.original.endReason || t('impersonation.statusEnded')}</Badge>
        ),
    },
  ];

  return (
    <AccordionSection title={t('impersonation.operatorAccessTitle')}>
      <p className="text-[12px] text-muted-foreground max-w-[72ch]">
        {t('impersonation.operatorAccessHint')}
      </p>
      {isLoading ? (
        <p className="text-[13px] text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</p>
      ) : (
        <DataTable
          data={sessions}
          columns={columns}
          gutter
          emptyIcon={Eye}
          emptyMessage={t('impersonation.empty')}
        />
      )}
    </AccordionSection>
  );
}

/** Super admin — "Impersonation sessions": every workspace, with a workspace column and an End
 *  action on the live one (only ever one live session per operator — DB-13 §3.6/GLM DB-13 #4). */
export function ImpersonationSessionsCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [endingId, setEndingId] = useState<number | null>(null);

  const { data, isLoading } = useGetApiAdminImpersonation({ page: 1, pageSize: CARD_PAGE_SIZE });
  const sessions: ImpersonationSessionDto[] = data?.items ?? [];

  const reload = () =>
    void qc.invalidateQueries({ queryKey: getGetApiAdminImpersonationQueryKey() });

  const endMut = usePostApiAdminImpersonationEnd({
    mutation: {
      onSuccess: () => {
        setEndingId(null);
        toast(t('impersonation.sessionEnded'), 'success');
        reload();
      },
      onError: (e: unknown) => {
        setEndingId(null);
        toast(extractMessage(e), 'error');
      },
    },
  });

  function endSession(session: ImpersonationSessionDto) {
    if (session.id == null) return;
    setEndingId(session.id);
    endMut.mutate({ data: { sessionId: session.id } });
  }

  const columns: ColumnDef<ImpersonationSessionDto>[] = [
    {
      accessorKey: 'workspaceName',
      enableSorting: false,
      header: t('impersonation.colWorkspace'),
      cell: ({ row }) => (
        <span className="text-[14px] font-medium">{row.original.workspaceName || '—'}</span>
      ),
    },
    {
      accessorKey: 'startedAt',
      enableSorting: false,
      header: t('impersonation.colStarted'),
      cell: ({ row }) => (
        <span className="font-mono text-[13px] text-muted-foreground">
          {formatDateTime(row.original.startedAt)}
        </span>
      ),
    },
    {
      accessorKey: 'expiresAt',
      enableSorting: false,
      header: t('impersonation.colEndedExpires'),
      cell: ({ row }) => (
        <span className="font-mono text-[13px] text-muted-foreground">
          {row.original.endedAt ? formatDateTime(row.original.endedAt) : formatDateTime(row.original.expiresAt)}
        </span>
      ),
    },
    {
      accessorKey: 'reason',
      enableSorting: false,
      header: t('impersonation.colReason'),
      cell: ({ row }) => (
        <span className="text-[13px]" title={row.original.reason ?? ''}>
          {row.original.reason || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'requestCount',
      enableSorting: false,
      header: t('impersonation.colRequests'),
      cell: ({ row }) => (
        <span className="font-mono text-[13px]">{row.original.requestCount ?? 0}</span>
      ),
    },
    {
      accessorKey: 'status',
      enableSorting: false,
      header: t('impersonation.colStatus'),
      cell: ({ row }) =>
        isLive(row.original) ? (
          <Badge variant="warning">{t('impersonation.statusLive')}</Badge>
        ) : (
          <Badge variant="neutral">{row.original.endReason || t('impersonation.statusEnded')}</Badge>
        ),
    },
  ];

  const actionsFor = (session: ImpersonationSessionDto): RowActionItem[] => {
    if (!isLive(session)) return [];
    return [
      {
        label: t('impersonation.endSession'),
        icon: Square,
        severity: 'danger',
        disabled: endingId === session.id && endMut.isPending,
        onClick: () => endSession(session),
      },
    ];
  };

  return (
    <AccordionSection title={t('impersonation.sessionsTitle')}>
      <p className="text-[12px] text-muted-foreground max-w-[72ch]">
        {t('impersonation.sessionsHint')}
      </p>
      {isLoading ? (
        <p className="text-[13px] text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</p>
      ) : (
        <DataTable
          data={sessions}
          columns={columns}
          actions={actionsFor}
          actionsAriaLabel={t('impersonation.actions')}
          gutter
          emptyIcon={Eye}
          emptyMessage={t('impersonation.empty')}
        />
      )}
    </AccordionSection>
  );
}
