// Projects admin page. React port of angular/.../projects/projects.component.ts.
// list (key, name, status) + add project + enable/disable (disable confirmed).
// Phase B additions: export/import comments, predefined actions in add/edit forms.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiAdminProjects,
  usePostApiAdminProjects,
  usePatchApiAdminProjectsId,
  usePostApiProjectsKeyImport,
  getGetApiAdminProjectsQueryKey,
  getApiProjectsKeyExport,
  type ProjectResponse,
  type PredefinedActionInput,
  type ExportFileDto,
} from '@moamen-ui/pointer-react';
import { Plus, Ban, CheckCircle2, Download, Upload, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { extractMessage } from '@/lib/error';
import { useAuth } from '@/lib/auth';

// Local row type for predefined actions in the form
interface PredefinedActionRow {
  _localId: number;
  id?: number;
  text: string;
  prompt: string;
}

let _nextLocalId = 1;
function nextLocalId() {
  return _nextLocalId++;
}

function emptyRow(): PredefinedActionRow {
  return { _localId: nextLocalId(), text: '', prompt: '' };
}

export function ProjectsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isSuperAdmin } = useAuth();

  const { data: projects = [] } = useGetApiAdminProjects();

  const reload = () =>
    qc.invalidateQueries({ queryKey: getGetApiAdminProjectsQueryKey() });
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // ---- Add project ----
  const [addOpen, setAddOpen] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [addActions, setAddActions] = useState<PredefinedActionRow[]>([]);

  const addMut = usePostApiAdminProjects({
    mutation: {
      onSuccess: () => {
        setAddOpen(false);
        setKey('');
        setName('');
        setAddActions([]);
        reload();
      },
      onError,
    },
  });

  function openAdd() {
    setKey('');
    setName('');
    setAddActions([]);
    setAddOpen(true);
  }

  function addProject() {
    if (!key.trim() || !name.trim()) return;
    const predefinedActions: PredefinedActionInput[] = addActions.map((row, idx) => ({
      text: row.text,
      prompt: row.prompt,
      sortOrder: idx,
      isActive: true,
    }));
    addMut.mutate({
      data: {
        key: key.trim(),
        name: name.trim(),
        predefinedActions: predefinedActions.length > 0 ? predefinedActions : null,
      },
    });
  }

  // ---- Edit project (name + predefined actions) ----
  const [editOpen, setEditOpen] = useState(false);
  const [editProject, setEditProject] = useState<ProjectResponse | null>(null);
  const [editName, setEditName] = useState('');
  const [editActions, setEditActions] = useState<PredefinedActionRow[]>([]);

  const patchMut = usePatchApiAdminProjectsId({
    mutation: {
      onSuccess: () => {
        setEditOpen(false);
        toast(t('projects.saved'));
        reload();
      },
      onError,
    },
  });

  function openEdit(project: ProjectResponse) {
    setEditProject(project);
    setEditName(project.name ?? '');
    setEditActions(
      (project.predefinedActions ?? []).map((a) => ({
        _localId: nextLocalId(),
        id: a.id,
        text: a.text ?? '',
        prompt: a.prompt ?? '',
      })),
    );
    setEditOpen(true);
  }

  function saveEdit() {
    if (!editProject || !editName.trim()) return;
    const predefinedActions: PredefinedActionInput[] = editActions.map((row, idx) => ({
      id: row.id ?? null,
      text: row.text,
      prompt: row.prompt,
      sortOrder: idx,
      isActive: true,
    }));
    patchMut.mutate({
      id: editProject.id!,
      data: {
        name: editName.trim(),
        predefinedActions: predefinedActions,
      },
    });
  }

  // ---- Enable / disable ----
  const toggleMut = usePatchApiAdminProjectsId({
    mutation: {
      onSuccess: () => reload(),
      onError,
    },
  });

  const [confirmProject, setConfirmProject] = useState<ProjectResponse | null>(null);

  function toggleActive(project: ProjectResponse) {
    if (!project.isActive) {
      toggleMut.mutate({ id: project.id!, data: { isActive: true } });
      return;
    }
    setConfirmProject(project);
  }
  function confirmDisable() {
    const p = confirmProject;
    setConfirmProject(null);
    if (p) toggleMut.mutate({ id: p.id!, data: { isActive: false } });
  }

  // ---- Export ----
  async function handleExport(project: ProjectResponse) {
    try {
      const exportData = await getApiProjectsKeyExport(project.key!);
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pointer-comments-${project.key}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast(t('exportImport.exported'));
    } catch (e) {
      toast(extractMessage(e), 'error');
    }
  }

  // ---- Import ----
  const [importOpen, setImportOpen] = useState(false);
  const [importProject, setImportProject] = useState<ProjectResponse | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMut = usePostApiProjectsKeyImport({
    mutation: {
      onSuccess: (result) => {
        const countMsg = t('exportImport.importCounts', {
          comments: result.importedComments ?? 0,
          replies: result.importedReplies ?? 0,
        });
        toast(`${t('exportImport.imported')} ${countMsg}`);
        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach((w) => toast(w, 'error'));
        }
        setImportOpen(false);
        setImportFile(null);
        reload();
      },
      onError,
    },
  });

  function openImport(project: ProjectResponse) {
    setImportProject(project);
    setImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setImportOpen(true);
  }

  async function handleImport() {
    if (!importFile || !importProject) return;
    const text = await importFile.text();
    const payload = JSON.parse(text) as ExportFileDto;
    importMut.mutate({ key: importProject.key!, data: payload });
  }

  // ---- Predefined actions helpers ----
  function addActionRow(
    rows: PredefinedActionRow[],
    setRows: (r: PredefinedActionRow[]) => void,
  ) {
    setRows([...rows, emptyRow()]);
  }

  function updateActionRow(
    rows: PredefinedActionRow[],
    setRows: (r: PredefinedActionRow[]) => void,
    localId: number,
    field: 'text' | 'prompt',
    value: string,
  ) {
    setRows(rows.map((r) => (r._localId === localId ? { ...r, [field]: value } : r)));
  }

  function removeActionRow(
    rows: PredefinedActionRow[],
    setRows: (r: PredefinedActionRow[]) => void,
    localId: number,
  ) {
    setRows(rows.filter((r) => r._localId !== localId));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('projects.title')}</h2>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          {t('projects.addProject')}
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('projects.key')}</TableHead>
              <TableHead>{t('projects.name')}</TableHead>
              <TableHead>{t('projects.status')}</TableHead>
              <TableHead>{t('projects.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{project.key}</code>
                </TableCell>
                <TableCell>{project.name}</TableCell>
                <TableCell>
                  <span className={cn('chip', project.isActive ? 'chip-active' : 'chip-disabled')}>
                    {t(project.isActive ? 'common.active' : 'common.disabled')}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(project)}
                    >
                      {t('projects.edit')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(project)}
                      disabled={toggleMut.isPending}
                    >
                      {project.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      {t(project.isActive ? 'common.disable' : 'common.enable')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(project)}
                    >
                      <Download className="h-4 w-4" />
                      {t('exportImport.export')}
                    </Button>
                    {isSuperAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openImport(project)}
                      >
                        <Upload className="h-4 w-4" />
                        {t('exportImport.import')}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  {t('projects.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add project dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('projects.addProject')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-key">{t('projects.key')}</Label>
              <Input
                id="project-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-name">{t('projects.name')}</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addProject()}
              />
            </div>

            {/* Predefined actions */}
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold">{t('predefined.section')}</h4>
              <p className="text-xs text-muted-foreground">{t('predefined.projectHelp')}</p>
              {addActions.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('predefined.empty')}</p>
              )}
              {addActions.map((row) => (
                <div key={row._localId} className="flex flex-col gap-1 rounded-md border border-border p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">{t('predefined.text')}</Label>
                      <Input
                        value={row.text}
                        onChange={(e) =>
                          updateActionRow(addActions, setAddActions, row._localId, 'text', e.target.value)
                        }
                        className="mt-1"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-5 h-7 w-7 shrink-0 text-destructive"
                      onClick={() => removeActionRow(addActions, setAddActions, row._localId)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Label className="text-xs">{t('predefined.prompt')}</Label>
                  <textarea
                    value={row.prompt}
                    onChange={(e) =>
                      updateActionRow(addActions, setAddActions, row._localId, 'prompt', e.target.value)
                    }
                    rows={2}
                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addActionRow(addActions, setAddActions)}
              >
                <Plus className="h-4 w-4" />
                {t('predefined.add')}
              </Button>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!key.trim() || !name.trim() || addMut.isPending}
              onClick={addProject}
            >
              <Plus className="h-4 w-4" />
              {t('projects.addProject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit project dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('projects.editTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-project-name">{t('projects.name')}</Label>
              <Input
                id="edit-project-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Predefined actions */}
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold">{t('predefined.section')}</h4>
              <p className="text-xs text-muted-foreground">{t('predefined.projectHelp')}</p>
              {editActions.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('predefined.empty')}</p>
              )}
              {editActions.map((row) => (
                <div key={row._localId} className="flex flex-col gap-1 rounded-md border border-border p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">{t('predefined.text')}</Label>
                      <Input
                        value={row.text}
                        onChange={(e) =>
                          updateActionRow(editActions, setEditActions, row._localId, 'text', e.target.value)
                        }
                        className="mt-1"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-5 h-7 w-7 shrink-0 text-destructive"
                      onClick={() => removeActionRow(editActions, setEditActions, row._localId)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Label className="text-xs">{t('predefined.prompt')}</Label>
                  <textarea
                    value={row.prompt}
                    onChange={(e) =>
                      updateActionRow(editActions, setEditActions, row._localId, 'prompt', e.target.value)
                    }
                    rows={2}
                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addActionRow(editActions, setEditActions)}
              >
                <Plus className="h-4 w-4" />
                {t('predefined.add')}
              </Button>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!editName.trim() || patchMut.isPending}
              onClick={saveEdit}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog — super-admin only */}
      {isSuperAdmin && (
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('exportImport.importTitle')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{t('exportImport.importHint')}</p>
            <div className="flex flex-col gap-2 pt-1">
              <Label htmlFor="import-file">{importProject?.name ?? ''}</Label>
              <input
                id="import-file"
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded file:border file:border-border file:bg-background file:px-3 file:py-1 file:text-sm file:font-medium"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={!importFile || importMut.isPending}
                onClick={handleImport}
              >
                <Upload className="h-4 w-4" />
                {t('exportImport.import')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Disable confirmation */}
      <ConfirmDialog
        open={!!confirmProject}
        message={t('common.confirmDisable', { name: confirmProject?.key })}
        confirmLabel={t('common.disable')}
        confirmColor="warn"
        onConfirm={confirmDisable}
        onCancel={() => setConfirmProject(null)}
      />
    </div>
  );
}
