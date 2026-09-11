// Environments admin page — React port of angular/.../environments/environments.component.ts.
// A super-admin-seeded global catalog ("default", "prod", "staging", "testing") every
// tenant sees, plus each tenant's own custom environments layered on top. First page
// built on the shared DataTable/Badge/RowActionsMenu library.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/FormField';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/shared/data-table/DataTable';
import type { RowActionItem } from '@/components/shared/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';
import {
  getGetApiAdminEnvironmentsQueryKey,
  useDeleteApiAdminEnvironmentsId,
  useGetApiAdminEnvironments,
  usePatchApiAdminEnvironmentsId,
  usePostApiAdminEnvironments,
  type AppEnvironmentResponse,
} from '@moamen-ui/pointer-react';

export function EnvironmentsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: environments = [] } = useGetApiAdminEnvironments();

  const reload = () =>
    qc.invalidateQueries({ queryKey: getGetApiAdminEnvironmentsQueryKey() });
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  const columns = useMemo<ColumnDef<AppEnvironmentResponse>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('environments.name'),
        enableSorting: true,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'scope',
        header: t('environments.scope'),
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={row.original.isGlobal ? 'neutral' : 'default'}>
            {t(row.original.isGlobal ? 'environments.global' : 'environments.own')}
          </Badge>
        ),
      },
    ],
    [t],
  );

  // Permission gating stays page-side: global (catalog) environments get no menu.
  const actionsFor = (env: AppEnvironmentResponse): RowActionItem[] => {
    if (!env.canManage) return [];
    return [
      {
        label: t('common.rename'),
        icon: Pencil,
        onClick: () => openRename(env),
      },
      {
        label: t('common.delete'),
        icon: Trash2,
        severity: 'danger',
        onClick: () => setDeletingEnvironment(env),
      },
    ];
  };

  // ---- Add environment ----
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const addMut = usePostApiAdminEnvironments({
    mutation: {
      onSuccess: () => {
        setAddOpen(false);
        setNewName('');
        reload();
      },
      onError,
    },
  });

  function openAdd() {
    setNewName('');
    setAddOpen(true);
  }
  function addEnvironment() {
    const name = newName.trim();
    if (!name) return;
    addMut.mutate({ data: { name } });
  }

  // ---- Rename ----
  const [renameOpen, setRenameOpen] = useState(false);
  const [editingEnvironment, setEditingEnvironment] =
    useState<AppEnvironmentResponse | null>(null);
  const [editName, setEditName] = useState('');

  const patchMut = usePatchApiAdminEnvironmentsId({
    mutation: {
      onSuccess: () => reload(),
      onError,
    },
  });

  function openRename(env: AppEnvironmentResponse) {
    setEditingEnvironment(env);
    setEditName(env.name ?? '');
    setRenameOpen(true);
  }
  function saveRename() {
    const env = editingEnvironment;
    const name = editName.trim();
    if (!env || !env.id || !name || name === env.name) {
      setRenameOpen(false);
      return;
    }
    patchMut.mutate(
      { id: env.id, data: { name } },
      { onSuccess: () => { setRenameOpen(false); reload(); } },
    );
  }

  // ---- Delete (confirmed) ----
  const [deletingEnvironment, setDeletingEnvironment] =
    useState<AppEnvironmentResponse | null>(null);

  const deleteMut = useDeleteApiAdminEnvironmentsId({
    mutation: {
      onSuccess: () => {
        setDeletingEnvironment(null);
        toast(t('environments.deleted'));
        reload();
      },
      onError,
    },
  });

  function confirmDelete() {
    const env = deletingEnvironment;
    if (!env?.id) return;
    deleteMut.mutate({ id: env.id });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.01em]">{t('environments.title')}</h1>
          <p className="m-0 mt-1 text-[14px] text-muted-foreground">
            {t('environments.subtitle')}
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          {t('environments.addEnvironment')}
        </Button>
      </div>

      <DataTable
        data={environments}
        columns={columns}
        actions={actionsFor}
        actionsAriaLabel={t('common.actions')}
        gutter
        emptyIcon={Globe}
        emptyMessage={t('environments.empty')}
        emptyHint={t('environments.emptyHint')}
        emptyAction={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t('environments.addEnvironment')}
          </Button>
        }
      />

      {/* Add environment dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('environments.addEnvironment')}</DialogTitle>
          </DialogHeader>
          <div className="pt-1">
            <FormField label={t('environments.name')} htmlFor="environment-name">
              <Input
                id="environment-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEnvironment()}
                placeholder="e.g. qa"
                autoFocus
              />
            </FormField>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!newName.trim() || addMut.isPending} onClick={addEnvironment}>
              <Plus className="h-4 w-4" />
              {t('environments.addEnvironment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename environment dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('common.rename')}</DialogTitle>
          </DialogHeader>
          <div className="pt-1">
            <FormField label={t('environments.name')} htmlFor="environment-rename">
              <Input
                id="environment-rename"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                autoFocus
              />
            </FormField>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!editName.trim() || patchMut.isPending} onClick={saveRename}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingEnvironment}
        message={t('environments.confirmDelete', {
          name: deletingEnvironment?.name,
        })}
        confirmLabel={t('common.delete')}
        confirmColor="warn"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingEnvironment(null)}
      />
    </div>
  );
}
