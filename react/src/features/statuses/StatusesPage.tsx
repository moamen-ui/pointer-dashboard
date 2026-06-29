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
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
        {t('common.refresh')}…
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

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t('statuses.title')}</h2>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('statuses.colName')}</TableHead>
              <TableHead>{t('statuses.colLabel')}</TableHead>
              <TableHead>{t('statuses.colColor')}</TableHead>
              <TableHead>{t('statuses.colOrder')}</TableHead>
              <TableHead>{t('statuses.colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statuses.map((status) => {
              const val = status.value!;
              const row = rows[val] ?? initRow(status);
              const isBusy = patchMut.isPending || deleteMut.isPending;
              return (
                <TableRow key={val}>
                  <TableCell className="font-medium">
                    {status.name ?? String(val)}
                  </TableCell>
                  <TableCell>
                    <Input
                      className="w-36"
                      value={row.label}
                      maxLength={64}
                      onChange={(e) => setField(val, 'label', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={row.color}
                        onChange={(e) => setField(val, 'color', e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
                      />
                      <Input
                        className="w-28 font-mono text-xs"
                        value={row.color}
                        pattern="^#[0-9a-fA-F]{6}$"
                        onChange={(e) => setField(val, 'color', e.target.value)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-20"
                      min={0}
                      value={row.order}
                      onChange={(e) =>
                        setField(val, 'order', Number(e.target.value))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        disabled={isBusy || !row.label.trim()}
                        onClick={() => save(val)}
                      >
                        {t('statuses.save')}
                      </Button>
                      {status.isOverridden && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => setResetTarget(status)}
                        >
                          {t('statuses.reset')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

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
