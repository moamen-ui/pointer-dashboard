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
import { EllipsisVertical } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
                      className="w-[132px]"
                      value={row.label}
                      maxLength={64}
                      onChange={(e) => setField(val, 'label', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    {/* Swatch + hex are one control: a single bordered box that
                        lights up on focus, with the native picker inside it. */}
                    <div className="inline-flex h-9 w-[124px] items-center gap-1.5 rounded-md border border-input bg-transparent ps-1.5 pe-2 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                      <input
                        type="color"
                        aria-label={t('statuses.colColor')}
                        value={row.color}
                        onChange={(e) => setField(val, 'color', e.target.value)}
                        className="h-6 w-6 shrink-0 cursor-pointer appearance-none rounded border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0"
                      />
                      <input
                        value={row.color}
                        maxLength={7}
                        pattern="^#[0-9a-fA-F]{6}$"
                        onChange={(e) => setField(val, 'color', e.target.value)}
                        className="h-full w-full min-w-0 border-0 bg-transparent p-0 font-mono text-xs outline-none"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-16"
                      min={0}
                      value={row.order}
                      onChange={(e) =>
                        setField(val, 'order', Number(e.target.value))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <EllipsisVertical className="h-4 w-4" />
                          <span className="sr-only">{t('statuses.colActions')}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={isBusy || !row.label.trim()}
                          onSelect={() => save(val)}
                        >
                          {t('statuses.save')}
                        </DropdownMenuItem>
                        {status.isOverridden && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={isBusy}
                            onSelect={() => setResetTarget(status)}
                          >
                            {t('statuses.reset')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
