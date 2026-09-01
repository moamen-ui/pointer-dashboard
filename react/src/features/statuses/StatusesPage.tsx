// Statuses admin page — edit presentation label / color / order per status,
// or reset a status back to its defaults. Mirrors the Angular sibling.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiAdminStatuses,
  usePatchApiAdminStatusesValue,
  useDeleteApiAdminStatusesValue,
  getGetApiAdminStatusesQueryKey,
  getGetApiStatusesQueryKey,
  type StatusAdminItem,
} from '@moamen-ui/pointer-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Save, RotateCcw, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table/DataTable';
import type { RowActionItem } from '@/components/shared/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';

interface RowState {
  label: string;
  color: string;
  order: number;
}

function initRow(s: StatusAdminItem): RowState {
  return {
    label: s.label ?? s.defaultLabel ?? '',
    color: s.color ?? s.defaultColor ?? '#6b7280',
    order: s.order ?? s.defaultOrder ?? 0,
  };
}

export function StatusesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useGetApiAdminStatuses();

  // Local edit state — seeded from query data, not mutating the cache.
  const [rows, setRows] = useState<Record<number, RowState>>({});

  useEffect(() => {
    if (data) {
      const next: Record<number, RowState> = {};
      data.forEach((s) => {
        if (s.value != null) next[s.value] = initRow(s);
      });
      setRows(next);
    }
  }, [data]);

  function invalidate() {
    void qc.invalidateQueries({ queryKey: getGetApiAdminStatusesQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetApiStatusesQueryKey() });
  }

  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // ---- PATCH (save) ----
  const patchMut = usePatchApiAdminStatusesValue({
    mutation: {
      onSuccess: () => {
        toast(t('statuses.saveSuccess'));
        invalidate();
      },
      onError,
    },
  });

  function save(statusValue: number) {
    const row = rows[statusValue];
    if (!row) return;
    patchMut.mutate({
      value: statusValue,
      data: { label: row.label, color: row.color, order: row.order },
    });
  }

  // ---- DELETE (reset) ----
  const [resetTarget, setResetTarget] = useState<StatusAdminItem | null>(null);

  const deleteMut = useDeleteApiAdminStatusesValue({
    mutation: {
      onSuccess: () => {
        setResetTarget(null);
        toast(t('statuses.resetSuccess'));
        invalidate();
      },
      onError: (e) => {
        setResetTarget(null);
        onError(e);
      },
    },
  });

  function confirmReset() {
    if (resetTarget?.value != null) {
      deleteMut.mutate({ value: resetTarget.value });
    }
  }

  // ---- Row field helpers ----
  function setField<K extends keyof RowState>(
    statusValue: number,
    field: K,
    value: RowState[K],
  ) {
    setRows((prev) => ({
      ...prev,
      [statusValue]: { ...prev[statusValue], [field]: value },
    }));
  }

  // ---- Render ----
  if (isLoading && !data) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {t('statuses.loading')}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-destructive">
        {t('statuses.loadError')}
      </div>
    );
  }

  const statuses = data ?? [];
  const isBusy = patchMut.isPending || deleteMut.isPending;

  // Every column but "name" is a live inline-edit control bound to local per-row
  // state -- the escape hatch this page needs instead of DataTable's plain
  // display-only cells.
  const columns: ColumnDef<StatusAdminItem>[] = [
    {
      accessorKey: 'name',
      enableSorting: false,
      header: t('statuses.colName'),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name ?? String(row.original.value)}</span>
      ),
    },
    {
      id: 'label',
      enableSorting: false,
      header: t('statuses.colLabel'),
      cell: ({ row }) => {
        const val = row.original.value!;
        const r = rows[val] ?? initRow(row.original);
        return (
          // Same slim box as the colour control below, so the row reads as one
          // set of controls.
          <Input
            className="w-[132px] px-2 text-[0.8rem] focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand focus-visible:ring-offset-0"
            aria-label={t('statuses.colLabel')}
            value={r.label}
            maxLength={64}
            onChange={(e) => setField(val, 'label', e.target.value)}
          />
        );
      },
    },
    {
      id: 'color',
      enableSorting: false,
      header: t('statuses.colColor'),
      cell: ({ row }) => {
        const val = row.original.value!;
        const r = rows[val] ?? initRow(row.original);
        return (
          // Swatch + hex are one control: a single bordered box that lights up
          // on focus, with the native picker inside it.
          <div className="inline-flex h-9 w-[124px] items-center gap-1.5 rounded-md border border-input bg-transparent ps-1.5 pe-2 shadow-sm focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
            <input
              type="color"
              aria-label={t('statuses.colColor')}
              value={r.color}
              onChange={(e) => setField(val, 'color', e.target.value)}
              className="h-6 w-6 shrink-0 cursor-pointer appearance-none rounded border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0"
            />
            <input
              value={r.color}
              maxLength={7}
              pattern="^#[0-9a-fA-F]{6}$"
              onChange={(e) => setField(val, 'color', e.target.value)}
              className="h-full w-full min-w-0 border-0 bg-transparent p-0 font-mono text-[0.8rem] outline-none"
            />
          </div>
        );
      },
    },
    {
      id: 'order',
      enableSorting: false,
      header: t('statuses.colOrder'),
      cell: ({ row }) => {
        const val = row.original.value!;
        const r = rows[val] ?? initRow(row.original);
        return (
          <Input
            type="number"
            className="w-16 px-2 text-[0.8rem] focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand focus-visible:ring-offset-0"
            aria-label={t('statuses.colOrder')}
            min={0}
            value={r.order}
            onChange={(e) => setField(val, 'order', Number(e.target.value))}
          />
        );
      },
    },
  ];

  const actionsFor = (status: StatusAdminItem): RowActionItem[] => {
    const val = status.value!;
    const row = rows[val] ?? initRow(status);
    const items: RowActionItem[] = [
      { label: t('statuses.save'), icon: Save, disabled: isBusy || !row.label.trim(), onClick: () => save(val) },
    ];
    if (status.isOverridden) {
      items.push({ label: t('statuses.reset'), icon: RotateCcw, severity: 'danger', disabled: isBusy, onClick: () => setResetTarget(status) });
    }
    return items;
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t('statuses.title')}</h2>

      <DataTable
        data={statuses}
        columns={columns}
        actions={actionsFor}
        actionsAriaLabel={t('statuses.colActions')}
        actionsHeader={t('statuses.colActions')}
        emptyIcon={Tag}
        emptyMessage={t('statuses.empty')}
        emptyHint={t('statuses.emptyHint')}
      />

      {/* Reset confirmation */}
      <ConfirmDialog
        open={!!resetTarget}
        message={t('statuses.confirmReset', {
          name: resetTarget?.label ?? resetTarget?.name ?? '',
        })}
        confirmLabel={t('statuses.reset')}
        confirmColor="warn"
        onConfirm={confirmReset}
        onCancel={() => setResetTarget(null)}
      />
    </div>
  );
}
