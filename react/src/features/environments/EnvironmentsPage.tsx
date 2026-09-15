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
import { requiredError } from '@/lib/validators';
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

  const { data: environmentsRaw = [] } = useGetApiAdminEnvironments();
  const [disablingEnvironment, setDisablingEnvironment] = useState<AppEnvironmentResponse | null>(null);

  // Sort: enabled first, then retired, then disabled
  const environments = useMemo(() => {
    const sorted = [...environmentsRaw];
    return sorted.sort((a, b) => {
      const aRetired = a.isRetired ? 1 : 0;
      const bRetired = b.isRetired ? 1 : 0;
      const aDisabled = a.isEnabled === false ? 1 : 0;
      const bDisabled = b.isEnabled === false ? 1 : 0;
      if (aRetired !== bRetired) return aRetired - bRetired;
      if (aDisabled !== bDisabled) return aDisabled - bDisabled;
      return 0;
    });
  }, [environmentsRaw]);

  const reload = () =>
    qc.invalidateQueries({ queryKey: getGetApiAdminEnvironmentsQueryKey() });
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  const patchEnabledMut = usePatchApiAdminEnvironmentsId({
    mutation: {
      onSuccess: () => {
        setDisablingEnvironment(null);
        reload();
      },
      onError,
    },
  });

  const columns = useMemo<ColumnDef<AppEnvironmentResponse>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('environments.name'),
        enableSorting: true,
        cell: ({ row }) => (
          <span className={`font-medium ${row.original.isRetired ? 'text-muted-foreground' : ''}`}>
            {row.original.name}
            {row.original.isRetired && <span className="ms-2 text-xs text-muted-foreground">({t('environments.retired')})</span>}
          </span>
        ),
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
      {
        id: 'enabled',
        header: t('common.active'),
        enableSorting: false,
        cell: ({ row }) => {
          if (!row.original.canManage) return <span className="text-xs text-muted-foreground">{t(row.original.isEnabled !== false ? 'common.active' : 'common.disabled')}</span>;
          return (
            <input
              type="checkbox"
              checked={row.original.isEnabled !== false}
              onChange={(e) => {
                if (e.target.checked) {
                  patchEnabledMut.mutate({ id: row.original.id!, data: { isEnabled: true } });
                } else {
                  if (row.original.projectUrlCount && row.original.projectUrlCount > 0) {
                    setDisablingEnvironment(row.original);
                  } else {
                    patchEnabledMut.mutate({ id: row.original.id!, data: { isEnabled: false } });
                  }
                }
              }}
              disabled={patchEnabledMut.isPending}
              className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
              aria-label={t('common.active')}
            />
          );
        },
      },
    ],
    [t, patchEnabledMut],
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
  const [newNameTouched, setNewNameTouched] = useState(false);
  const newNameError = requiredError(newName, t);

  const addMut = usePostApiAdminEnvironments({
    mutation: {
      onSuccess: () => {
        setAddOpen(false);
        setNewName('');
        setNewNameTouched(false);
        reload();
      },
      onError,
    },
  });

  function openAdd() {
    setNewName('');
    setNewNameTouched(false);
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
  const [editNameTouched, setEditNameTouched] = useState(false);
  const editNameError = requiredError(editName, t);

  const patchMut = usePatchApiAdminEnvironmentsId({
    mutation: {
      onSuccess: () => reload(),
      onError,
    },
  });

  function openRename(env: AppEnvironmentResponse) {
    setEditingEnvironment(env);
    setEditName(env.name ?? '');
    setEditNameTouched(false);
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

  function confirmDisable() {
    const env = disablingEnvironment;
    setDisablingEnvironment(null);
    if (env?.id) {
      patchEnabledMut.mutate({ id: env.id, data: { isEnabled: false } });
    }
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
            <FormField
              label={t('environments.name')}
              htmlFor="environment-name"
              error={newNameTouched ? newNameError || undefined : undefined}
            >
              <Input
                id="environment-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => setNewNameTouched(true)}
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
            <FormField
              label={t('environments.name')}
              htmlFor="environment-rename"
              error={editNameTouched ? editNameError || undefined : undefined}
            >
              <Input
                id="environment-rename"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => setEditNameTouched(true)}
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

      {/* Disable confirmation (when has projects) */}
      <ConfirmDialog
        open={!!disablingEnvironment}
        message={t('environments.confirmDisable', {
          name: disablingEnvironment?.name,
          count: disablingEnvironment?.projectUrlCount ?? 0,
        })}
        confirmLabel={t('common.disable')}
        confirmColor="warn"
        onConfirm={confirmDisable}
        onCancel={() => setDisablingEnvironment(null)}
      />
    </div>
  );
}
