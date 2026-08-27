// Projects page — available to all authenticated users.
// Admins see all projects; non-admins see their own.
// Per-row capabilities driven by server flags: canEdit, canDelete.
// New in this revision:
//   • Delete (useDeleteApiAdminProjectsId) — only when canDelete; disabled+tooltip when !canDelete
//   • commentsCount + createdByName shown as row info
//   • View predefined prompts read-only when !canEdit
//   • "Suggest prompt" dialog when !canEdit (usePostApiProjectsIdPredefinedActionSuggestions)
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiAdminProjects,
  usePostApiAdminProjects,
  usePatchApiAdminProjectsId,
  useDeleteApiAdminProjectsId,
  usePostApiProjectsKeyImport,
  usePostApiProjectsIdPredefinedActionSuggestions,
  getGetApiAdminProjectsQueryKey,
  getApiProjectsKeyExport,
  type ProjectResponse,
  type PredefinedActionInput,
  type ExportFileDto,
} from '@moamen-ui/pointer-react';
import { Plus, Ban, CheckCircle2, Download, Upload, Trash2, Eye, MessageSquarePlus, EllipsisVertical, FolderOpen } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/EmptyState';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

/** Mirrors CreateProjectValidator on the API: lowercase letters, digits, dot,
 *  underscore, hyphen — nothing else. */
const KEY_PATTERN = /^[a-z0-9._-]+$/;
/** Mirrors the projects.key column (character varying(64)). */
const KEY_MAX_LENGTH = 64;

/** Keeps the typed key in the shape the API accepts: lowercased and without
 *  surrounding whitespace. The API validates the raw value (only lowercasing
 *  afterwards), so an uppercase key would 400 even though it would have been
 *  stored fine — normalising avoids that trap. */
function normalizeKey(value: string): string {
  return value.toLowerCase().trim();
}

type KeyError = 'keyRequired' | 'keyPattern' | 'keyMaxLength' | 'keyTaken';

/** One error at a time, in this precedence. The taken-check compares
 *  case-insensitively on the normalised value, saving a 409 round-trip. */
function keyErrorFor(value: string, projects: ProjectResponse[]): KeyError | null {
  const v = normalizeKey(value);
  if (!v) return 'keyRequired';
  if (!KEY_PATTERN.test(v)) return 'keyPattern';
  if (v.length > KEY_MAX_LENGTH) return 'keyMaxLength';
  if (projects.some((p) => (p.key ?? '').toLowerCase() === v)) return 'keyTaken';
  return null;
}

export function ProjectsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isSuperAdmin, isAdmin } = useAuth();

  const { data: projects = [] } = useGetApiAdminProjects();

  const reload = () =>
    qc.invalidateQueries({ queryKey: getGetApiAdminProjectsQueryKey() });
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // ---- Add project ----
  const [addOpen, setAddOpen] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [addActions, setAddActions] = useState<PredefinedActionRow[]>([]);

  const keyError = keyErrorFor(key, projects);
  const keyErrorMessage =
    keyError === 'keyRequired'
      ? t('projects.keyRequired')
      : keyError === 'keyPattern'
        ? t('projects.keyPattern')
        : keyError === 'keyMaxLength'
          ? t('projects.keyMaxLength', { max: KEY_MAX_LENGTH })
          : keyError === 'keyTaken'
            ? t('projects.keyTaken')
            : null;

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
    if (keyError || !name.trim()) return;
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

  // ---- Edit / view project (name + predefined actions) ----
  const [editOpen, setEditOpen] = useState(false);
  const [editProject, setEditProject] = useState<ProjectResponse | null>(null);
  const [editName, setEditName] = useState('');
  const [editActions, setEditActions] = useState<PredefinedActionRow[]>([]);
  // readOnly = true when canEdit is false (view mode)
  const [editReadOnly, setEditReadOnly] = useState(false);
  const [editPageContextCaptureEnabled, setEditPageContextCaptureEnabled] = useState(false);

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

  function openEdit(project: ProjectResponse, readOnly = false) {
    setEditProject(project);
    setEditName(project.name ?? '');
    setEditReadOnly(readOnly);
    setEditPageContextCaptureEnabled(!!project.pageContextCaptureEnabled);
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
        pageContextCaptureEnabled: editPageContextCaptureEnabled,
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

  // ---- Delete project ----
  const [deleteProject, setDeleteProject] = useState<ProjectResponse | null>(null);

  const deleteMut = useDeleteApiAdminProjectsId({
    mutation: {
      onSuccess: () => {
        toast(t('projects.deleted'));
        reload();
      },
      onError,
    },
  });

  function confirmDelete() {
    const p = deleteProject;
    setDeleteProject(null);
    if (p) deleteMut.mutate({ id: p.id! });
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

  // ---- Suggest prompt dialog ----
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestProject, setSuggestProject] = useState<ProjectResponse | null>(null);
  const [suggestText, setSuggestText] = useState('');
  const [suggestPrompt, setSuggestPrompt] = useState('');

  const suggestMut = usePostApiProjectsIdPredefinedActionSuggestions({
    mutation: {
      onSuccess: () => {
        toast(t('suggestions.sent'));
        setSuggestOpen(false);
        setSuggestText('');
        setSuggestPrompt('');
      },
      onError: (e: unknown) => {
        // 403 means the user can actually edit directly
        const msg = extractMessage(e);
        if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
          toast(t('suggestions.canEditDirectly'), 'error');
        } else {
          toast(msg, 'error');
        }
      },
    },
  });

  function openSuggest(project: ProjectResponse) {
    setSuggestProject(project);
    setSuggestText('');
    setSuggestPrompt('');
    setSuggestOpen(true);
  }

  function submitSuggest() {
    if (!suggestProject || !suggestText.trim()) return;
    suggestMut.mutate({
      id: suggestProject.id!,
      data: { text: suggestText.trim(), prompt: suggestPrompt.trim() },
    });
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
        {!isSuperAdmin && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t('projects.addProject')}
          </Button>
        )}
      </div>

      {/* Super admins are platform-management only — they can't own a project (backend:
          ProjectService.CreateAsync forbids it). Point them at a real tenant account instead of
          showing an Add-Project affordance that would only 403. */}
      {isSuperAdmin && (
        <p className="text-sm text-muted-foreground">{t('projects.superAdminNote')}</p>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          message={t('projects.empty')}
          hint={t(isSuperAdmin ? 'projects.superAdminEmptyHint' : 'projects.emptyHint')}
        >
          {!isSuperAdmin && (
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" />
              {t('projects.addProject')}
            </Button>
          )}
        </EmptyState>
      ) : (
        <Card>
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('projects.key')}</TableHead>
              <TableHead>{t('projects.name')}</TableHead>
              <TableHead>{t('projects.createdBy')}</TableHead>
              <TableHead>{t('projects.comments')}</TableHead>
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
                <TableCell className="text-sm text-muted-foreground">
                  {project.createdByName ?? '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {project.commentsCount ?? 0}
                </TableCell>
                <TableCell>
                  <span className={cn('chip', project.isActive ? 'chip-active' : 'chip-disabled')}>
                    {t(project.isActive ? 'common.active' : 'common.disabled')}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <EllipsisVertical className="h-4 w-4" />
                        <span className="sr-only">{t('projects.actions')}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* Edit — only when canEdit */}
                      {project.canEdit && (
                        <DropdownMenuItem onSelect={() => openEdit(project, false)}>
                          {t('projects.edit')}
                        </DropdownMenuItem>
                      )}

                      {/* View predefined prompts — read-only when !canEdit */}
                      {!project.canEdit && (
                        <DropdownMenuItem onSelect={() => openEdit(project, true)}>
                          <Eye className="h-4 w-4" />
                          {t('projects.viewPrompts')}
                        </DropdownMenuItem>
                      )}

                      {/* Suggest prompt — only when !canEdit */}
                      {!project.canEdit && (
                        <DropdownMenuItem onSelect={() => openSuggest(project)}>
                          <MessageSquarePlus className="h-4 w-4" />
                          {t('projects.suggest')}
                        </DropdownMenuItem>
                      )}

                      {/* Enable / disable — admin only */}
                      {isAdmin && (
                        <DropdownMenuItem
                          onSelect={() => toggleActive(project)}
                          disabled={toggleMut.isPending}
                          className={cn(
                            project.isActive && 'text-destructive focus:text-destructive',
                          )}
                        >
                          {project.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          {t(project.isActive ? 'common.disable' : 'common.enable')}
                        </DropdownMenuItem>
                      )}

                      {/* Export */}
                      <DropdownMenuItem onSelect={() => handleExport(project)}>
                        <Download className="h-4 w-4" />
                        {t('exportImport.export')}
                      </DropdownMenuItem>

                      {/* Import — super-admin only */}
                      {isSuperAdmin && (
                        <DropdownMenuItem onSelect={() => openImport(project)}>
                          <Upload className="h-4 w-4" />
                          {t('exportImport.import')}
                        </DropdownMenuItem>
                      )}

                      {/* Delete — canDelete shows enabled; !canDelete shows disabled with tooltip */}
                      <DropdownMenuItem
                        onSelect={() => setDeleteProject(project)}
                        disabled={!project.canDelete || deleteMut.isPending}
                        title={!project.canDelete ? t('projects.deleteBlockedComments') : undefined}
                        className={cn(
                          'text-destructive focus:text-destructive',
                          // Radix still blocks selection when disabled; keep pointer
                          // events so the blocked-delete tooltip remains visible.
                          !project.canDelete && 'data-[disabled]:pointer-events-auto',
                        )}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t('projects.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      )}

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
                onChange={(e) => {
                  // Lowercase + trim while typing. Lowercasing does not change
                  // length, so the caret stays where the user left it; syncing
                  // the DOM value covers the case where the normalised value
                  // equals the previous state (React would keep the raw input).
                  const normalized = normalizeKey(e.target.value);
                  e.target.value = normalized;
                  setKey(normalized);
                }}
                maxLength={KEY_MAX_LENGTH}
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                aria-invalid={keyError ? true : undefined}
              />
              {keyErrorMessage && (
                <p className="text-xs text-destructive">{keyErrorMessage}</p>
              )}
              <p className="text-xs text-muted-foreground">{t('projects.keyHint')}</p>
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
              disabled={!!keyError || !name.trim() || addMut.isPending}
              onClick={addProject}
            >
              <Plus className="h-4 w-4" />
              {t('projects.addProject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit / View project dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editReadOnly ? t('projects.viewPrompts') : t('projects.editTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            {!editReadOnly && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-project-name">{t('projects.name')}</Label>
                <Input
                  id="edit-project-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {!editReadOnly && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="edit-project-capture" className="text-sm font-medium">
                    {t('projects.pageContextCapture')}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('projects.pageContextCaptureHint')}</p>
                </div>
                <input
                  id="edit-project-capture"
                  type="checkbox"
                  checked={editPageContextCaptureEnabled}
                  onChange={(e) => setEditPageContextCaptureEnabled(e.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
              </div>
            )}

            {/* Predefined actions */}
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold">{t('predefined.section')}</h4>
              {!editReadOnly && (
                <p className="text-xs text-muted-foreground">{t('predefined.projectHelp')}</p>
              )}
              {editActions.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('predefined.empty')}</p>
              )}
              {editActions.map((row) => (
                <div key={row._localId} className="flex flex-col gap-1 rounded-md border border-border p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">{t('predefined.text')}</Label>
                      {editReadOnly ? (
                        <p className="mt-1 text-sm">{row.text || '—'}</p>
                      ) : (
                        <Input
                          value={row.text}
                          onChange={(e) =>
                            updateActionRow(editActions, setEditActions, row._localId, 'text', e.target.value)
                          }
                          className="mt-1"
                        />
                      )}
                    </div>
                    {!editReadOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-5 h-7 w-7 shrink-0 text-destructive"
                        onClick={() => removeActionRow(editActions, setEditActions, row._localId)}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Label className="text-xs">{t('predefined.prompt')}</Label>
                  {editReadOnly ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{row.prompt || '—'}</p>
                  ) : (
                    <textarea
                      value={row.prompt}
                      onChange={(e) =>
                        updateActionRow(editActions, setEditActions, row._localId, 'prompt', e.target.value)
                      }
                      rows={2}
                      className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  )}
                </div>
              ))}
              {!editReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addActionRow(editActions, setEditActions)}
                >
                  <Plus className="h-4 w-4" />
                  {t('predefined.add')}
                </Button>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {editReadOnly ? t('common.cancel') : t('common.cancel')}
            </Button>
            {!editReadOnly && (
              <Button
                disabled={!editName.trim() || patchMut.isPending}
                onClick={saveEdit}
              >
                {t('common.save')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suggest prompt dialog */}
      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('projects.suggest')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <p className="text-xs text-muted-foreground">{suggestProject?.name}</p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="suggest-text">{t('predefined.text')}</Label>
              <Input
                id="suggest-text"
                value={suggestText}
                onChange={(e) => setSuggestText(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="suggest-prompt">{t('predefined.prompt')}</Label>
              <textarea
                id="suggest-prompt"
                value={suggestPrompt}
                onChange={(e) => setSuggestPrompt(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSuggestOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!suggestText.trim() || suggestMut.isPending}
              onClick={submitSuggest}
            >
              <MessageSquarePlus className="h-4 w-4" />
              {t('projects.suggest')}
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

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteProject}
        message={t('projects.deleteConfirm')}
        confirmLabel={t('projects.delete')}
        confirmColor="warn"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteProject(null)}
      />
    </div>
  );
}
