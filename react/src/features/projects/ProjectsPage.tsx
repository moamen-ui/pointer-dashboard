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
  useGetApiAdminEnvironments,
  useGetApiAdminProjectsIdAppUrls,
  usePutApiAdminProjectsIdAppUrlsEnvironmentId,
  useDeleteApiAdminProjectsIdAppUrlsEnvironmentId,
  getGetApiAdminProjectsQueryKey,
  getGetApiAdminProjectsIdAppUrlsQueryKey,
  getApiProjectsKeyExport,
  ProjectActivationState,
  type ProjectResponse,
  type PredefinedActionInput,
  type ExportFileDto,
} from '@moamen-ui/pointer-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Ban, CheckCircle2, Download, Upload, Trash2, Eye, MessageSquarePlus, FolderOpen, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/shared/data-table/DataTable';
import type { RowActionItem } from '@/components/shared/types';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ui/toast';
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
const KEY_PATTERN = /^[a-z0-9-]+$/;
/** Mirrors the projects.key column (character varying(64)). */
const KEY_MAX_LENGTH = 64;

/** Keeps the typed key in the shape the API accepts: lowercased and without
 *  surrounding whitespace. The API validates the raw value (only lowercasing
 *  afterwards), so an uppercase key would 400 even though it would have been
 *  stored fine — normalising avoids that trap. */
function normalizeKey(value: string): string {
  return value.toLowerCase().trim();
}

/**
 * Turns a project name into a key the API will accept: lowercase, with anything
 * outside [a-z0-9._-] collapsed to a single hyphen, trimmed of leading/trailing
 * separators and capped at the column length.
 */
const ARABIC_MAP: Record<string, string> = {
  'ء': 'a', 'آ': 'a', 'أ': 'a', 'ؤ': 'w', 'إ': 'a', 'ئ': 'y', 'ا': 'a', 'ب': 'b',
  'ة': 'h', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
  'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
  'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ى': 'a', 'ي': 'y',
  // Persian/Urdu letters that show up in Arabic-script names
  'پ': 'p', 'چ': 'ch', 'ژ': 'zh', 'ک': 'k', 'گ': 'g', 'ی': 'y',
};

/** Arabic-Indic and extended Arabic-Indic digits → ASCII. */
function asciiDigits(value: string): string {
  return value.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
              .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

/**
 * Turns a project name into a key the API will accept: `^[a-z0-9-]+$`, at most
 * KEY_MAX_LENGTH characters.
 *
 * - Arabic is transliterated (most of this product's users write Arabic names, and
 *   dropping the letters left them with an empty key).
 * - Only letters, digits and dashes survive: every other run — spaces, dots,
 *   underscores, punctuation — becomes a single dash, so "web.app_v2 beta" reads
 *   "web-app-v2-beta".
 * - Edges are trimmed of separators, and trimmed again after the length cut so a
 *   truncated key never ends on one.
 *
 * Exported for the spec.
 */
function slugifyKey(name: string): string {
const latin = asciiDigits(name.toLowerCase())
    // harakat + tatweel carry no sound; drop them before mapping letters
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[\u0621-\u06FF]/g, (ch) => ARABIC_MAP[ch] ?? ' ');

  return latin
    .replace(/[^a-z0-9]+/g, '-')   // the key allows only letters, digits and dashes
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, KEY_MAX_LENGTH)
    .replace(/-+$/g, '');          // the cut must not leave a dangling dash
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
  // True once the user edits the key by hand — auto-fill stops deferring to the name.
  const [keyEdited, setKeyEdited] = useState(false);
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
    setKeyEdited(false);
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
  const [editAppUrl, setEditAppUrl] = useState('');
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

  // ---- Other-environment App URLs (edit dialog only — a project must exist first) ----
  // Fetched only while the edit dialog is actually open in edit mode.
  const envSectionActive = editOpen && !editReadOnly;
  const { data: environments = [] } = useGetApiAdminEnvironments({
    query: { enabled: envSectionActive },
  });
  const { data: appUrls = [] } = useGetApiAdminProjectsIdAppUrls(editProject?.id ?? 0, {
    query: { enabled: envSectionActive },
  });

  // Only rows that ALREADY have a saved URL for this project — not every environment
  // the tenant has ever defined. "default" is covered by the ordinary "App URL" field
  // above (the backend keeps them in sync), so it's excluded to avoid showing the
  // same value twice.
  const configuredEnvironments = appUrls.filter((u) => u.environmentName !== 'default');

  // Environments not yet configured for this project — the "add new" row's options.
  const availableEnvironmentsToAdd = environments.filter(
    (e) =>
      e.name !== 'default' &&
      !configuredEnvironments.some((u) => u.appEnvironmentId != null && u.appEnvironmentId === e.id),
  );

  type EnvDraft = { url: string; isActive: boolean };

  // Draft state per EXISTING row (url + isActive together) — overlays the loaded
  // value with whatever the user is actively editing; each row saves immediately on
  // its own check button, independently of the dialog's single Save action.
  const [envOverrides, setEnvOverrides] = useState<Record<number, EnvDraft>>({});
  const envDrafts: Record<number, EnvDraft> = {};
  for (const u of configuredEnvironments) {
    if (u.appEnvironmentId != null) {
      envDrafts[u.appEnvironmentId] =
        envOverrides[u.appEnvironmentId] ?? { url: u.url ?? '', isActive: u.isActive ?? true };
    }
  }

  function updateEnvDraft(environmentId: number, patch: Partial<EnvDraft>) {
    const current =
      envOverrides[environmentId] ?? envDrafts[environmentId] ?? { url: '', isActive: true };
    setEnvOverrides((o) => ({ ...o, [environmentId]: { ...current, ...patch } }));
  }

  function clearEnvOverride(environmentId: number) {
    setEnvOverrides((o) => {
      const rest = { ...o };
      delete rest[environmentId];
      return rest;
    });
  }

  const reloadAppUrls = () => {
    if (editProject?.id != null) {
      qc.invalidateQueries({ queryKey: getGetApiAdminProjectsIdAppUrlsQueryKey(editProject.id) });
    }
  };

  const saveEnvMut = usePutApiAdminProjectsIdAppUrlsEnvironmentId({
    mutation: {
      onSuccess: () => {
        reloadAppUrls();
        toast(t('projects.saved'));
      },
      onError,
    },
  });

  const deleteEnvMut = useDeleteApiAdminProjectsIdAppUrlsEnvironmentId({
    mutation: {
      onSuccess: reloadAppUrls,
      onError,
    },
  });

  function saveEnvironmentUrl(environmentId: number) {
    const projectId = editProject?.id;
    const draft = envDrafts[environmentId];
    const url = (draft?.url ?? '').trim();
    if (projectId == null || !url) return;
    saveEnvMut.mutate(
      { id: projectId, environmentId, data: { url, isActive: draft?.isActive ?? true } },
      { onSuccess: () => clearEnvOverride(environmentId) },
    );
  }

  function clearEnvironmentUrl(environmentId: number) {
    const projectId = editProject?.id;
    if (projectId == null) return;
    deleteEnvMut.mutate(
      { id: projectId, environmentId },
      { onSuccess: () => clearEnvOverride(environmentId) },
    );
  }

  // ---- Inline "add environment" row ----
  const [showAddEnvRow, setShowAddEnvRow] = useState(false);
  const [newEnvId, setNewEnvId] = useState<number | null>(null);
  const [newEnvUrl, setNewEnvUrl] = useState('');
  const [newEnvActive, setNewEnvActive] = useState(true);

  function startAddEnvironment() {
    setNewEnvId(null);
    setNewEnvUrl('');
    setNewEnvActive(true);
    setShowAddEnvRow(true);
  }

  function cancelAddEnvironment() {
    setShowAddEnvRow(false);
  }

  function confirmAddEnvironment() {
    const projectId = editProject?.id;
    const url = newEnvUrl.trim();
    if (projectId == null || newEnvId == null || !url) return;
    saveEnvMut.mutate(
      { id: projectId, environmentId: newEnvId, data: { url, isActive: newEnvActive } },
      { onSuccess: () => setShowAddEnvRow(false) },
    );
  }

  function openEdit(project: ProjectResponse, readOnly = false) {
    setEditProject(project);
    setEditName(project.name ?? '');
    setEditAppUrl(project.appUrl ?? '');
    setEditReadOnly(readOnly);
    setEditPageContextCaptureEnabled(!!project.pageContextCaptureEnabled);
    // Discard any unsaved per-environment draft from a prior project.
    setEnvOverrides({});
    setShowAddEnvRow(false);
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
        appUrl: editAppUrl.trim(),
        predefinedActions: predefinedActions,
        pageContextCaptureEnabled: editPageContextCaptureEnabled,
        // Not editable from this dialog — passed through unchanged; only the
        // row-level bulk enable/disable action ever changes them.
        isActiveLocal: !!editProject.isActiveLocal,
        isActiveStaging: !!editProject.isActiveStaging,
        isActiveProduction: !!editProject.isActiveProduction,
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
    // Bulk toggle: activating a fully-inactive project turns on every
    // environment; anything partially/fully active is disabled everywhere.
    if (project.activationState === ProjectActivationState.NUMBER_0) {
      toggleMut.mutate({
        id: project.id!,
        data: { isActiveLocal: true, isActiveStaging: true, isActiveProduction: true },
      });
      return;
    }
    setConfirmProject(project);
  }
  function confirmDisable() {
    const p = confirmProject;
    setConfirmProject(null);
    if (p) {
      toggleMut.mutate({
        id: p.id!,
        data: { isActiveLocal: false, isActiveStaging: false, isActiveProduction: false },
      });
    }
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

  const columns: ColumnDef<ProjectResponse>[] = [
    { accessorKey: 'key', enableSorting: false, header: t('projects.key'),
      cell: ({ row }) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.original.key}</code> },
    { accessorKey: 'name', enableSorting: false, header: t('projects.name') },
    { accessorKey: 'createdByName', enableSorting: false, header: t('projects.createdBy'),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.createdByName ?? '—'}</span> },
    { accessorKey: 'commentsCount', enableSorting: false, header: t('projects.comments'),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.commentsCount ?? 0}</span> },
    {
      accessorKey: 'activationState',
      enableSorting: false,
      header: t('projects.status'),
      cell: ({ row }) => {
        const state = row.original.activationState ?? ProjectActivationState.NUMBER_0;
        const variant =
          state === ProjectActivationState.NUMBER_2
            ? 'success'
            : state === ProjectActivationState.NUMBER_1
              ? 'warning'
              : 'destructive';
        const label =
          state === ProjectActivationState.NUMBER_2
            ? 'common.active'
            : state === ProjectActivationState.NUMBER_1
              ? 'common.partial'
              : 'common.disabled';
        return <Badge variant={variant}>{t(label)}</Badge>;
      },
    },
  ];

  const actionsFor = (project: ProjectResponse): RowActionItem[] => {
    const items: RowActionItem[] = [];
    if (project.canEdit) {
      items.push({ label: t('projects.edit'), onClick: () => openEdit(project, false) });
    } else {
      items.push({ label: t('projects.viewPrompts'), icon: Eye, onClick: () => openEdit(project, true) });
      items.push({ label: t('projects.suggest'), icon: MessageSquarePlus, onClick: () => openSuggest(project) });
    }
    // Enable/disable is admin-gated in this port (not per-row canEdit) -- matches this
    // page's pre-existing convention, kept as-is rather than aligned to the angular
    // reference's canEdit gate.
    if (isAdmin) {
      const anyActive =
        (project.activationState ?? ProjectActivationState.NUMBER_0) !==
        ProjectActivationState.NUMBER_0;
      items.push({
        label: t(anyActive ? 'common.disable' : 'common.enable'),
        icon: anyActive ? Ban : CheckCircle2,
        severity: anyActive ? 'danger' : 'neutral',
        disabled: toggleMut.isPending,
        onClick: () => toggleActive(project),
      });
    }
    items.push({ label: t('exportImport.export'), icon: Download, onClick: () => handleExport(project) });
    if (isSuperAdmin) {
      items.push({ label: t('exportImport.import'), icon: Upload, onClick: () => openImport(project) });
    }
    items.push({
      label: t('projects.delete'),
      icon: Trash2,
      severity: 'danger',
      disabled: !project.canDelete || deleteMut.isPending,
      tooltip: project.canDelete ? undefined : t('projects.deleteBlockedComments'),
      onClick: () => setDeleteProject(project),
    });
    return items;
  };

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

      <DataTable
        data={projects}
        columns={columns}
        actions={actionsFor}
        actionsAriaLabel={t('projects.actions')}
        actionsHeader={t('projects.actions')}
        paginated
        emptyIcon={FolderOpen}
        emptyMessage={t('projects.empty')}
        emptyHint={t(isSuperAdmin ? 'projects.superAdminEmptyHint' : 'projects.emptyHint')}
        emptyAction={
          !isSuperAdmin ? (
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" />
              {t('projects.addProject')}
            </Button>
          ) : undefined
        }
      />

      {/* Add project dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('projects.addProject')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            {/* Name first: the key is derived from it (Pointer feedback #138). */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-name">{t('projects.name')}</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  // Derive the key from the name until the user edits the key
                  // themselves — after that, name edits must not overwrite it.
                  if (!keyEdited) setKey(slugifyKey(e.target.value));
                }}
                onKeyDown={(e) => e.key === 'Enter' && addProject()}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-key">{t('projects.key')}</Label>
              <Input
                id="project-key"
                value={key}
                onChange={(e) => {
                  // Typing in the key takes ownership of it: the name stops
                  // driving it. Lowercase + trim while typing. Lowercasing does
                  // not change length, so the caret stays where the user left
                  // it; syncing the DOM value covers the case where the
                  // normalised value equals the previous state (React would
                  // keep the raw input).
                  setKeyEdited(true);
                  const normalized = normalizeKey(e.target.value);
                  e.target.value = normalized;
                  setKey(normalized);
                }}
                maxLength={KEY_MAX_LENGTH}
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={keyError ? true : undefined}
              />
              {keyErrorMessage && (
                <p className="text-xs text-destructive">{keyErrorMessage}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t(keyEdited ? 'projects.keyHint' : 'projects.keyAutoHint')}
              </p>
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
        <DialogContent className="max-w-lg sm:max-w-2xl">
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-project-app-url">{t('projects.appUrl')}</Label>
                <Input
                  id="edit-project-app-url"
                  value={editAppUrl}
                  onChange={(e) => setEditAppUrl(e.target.value)}
                  placeholder="https://staging.example.com"
                />
                <p className="text-xs text-muted-foreground">{t('projects.appUrlHint')}</p>
              </div>
            )}

            {/* Other environments — only ones already configured for this project
                show as rows; one inline add-row at a time for the rest. */}
            {!editReadOnly && (
              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-semibold">{t('projects.otherEnvironments')}</h4>
                <p className="mb-1 text-xs text-muted-foreground">{t('projects.otherEnvironmentsHint')}</p>
                {(configuredEnvironments.length > 0 || showAddEnvRow) && (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="text-start text-muted-foreground">
                        <th className="w-32 pb-1 text-start font-medium">{t('environments.name')}</th>
                        <th className="pb-1 ps-2 text-start font-medium">{t('projects.appUrl')}</th>
                        <th className="w-20 pb-1 text-center font-medium">{t('common.active')}</th>
                        <th className="w-16 pb-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {configuredEnvironments.map((env) => {
                        const envId = env.appEnvironmentId!;
                        const draft = envDrafts[envId] ?? { url: '', isActive: true };
                        return (
                          <tr key={envId} className="align-middle">
                            <td className="py-1 pe-2 font-medium">{env.environmentName ?? ''}</td>
                            <td className="py-1 pe-2">
                              <Input
                                value={draft.url}
                                onChange={(e) => updateEnvDraft(envId, { url: e.target.value })}
                                placeholder="https://..."
                                className="h-8"
                              />
                            </td>
                            <td className="py-1 text-center">
                              <input
                                type="checkbox"
                                checked={draft.isActive}
                                onChange={(e) => updateEnvDraft(envId, { isActive: e.target.checked })}
                                aria-label={t('common.active')}
                                className="h-4 w-4 cursor-pointer"
                              />
                            </td>
                            <td className="py-1 whitespace-nowrap text-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                type="button"
                                aria-label={t('common.save')}
                                disabled={saveEnvMut.isPending}
                                onClick={() => saveEnvironmentUrl(envId)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                type="button"
                                aria-label={t('common.delete')}
                                disabled={deleteEnvMut.isPending}
                                onClick={() => clearEnvironmentUrl(envId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {showAddEnvRow && (
                        <tr className="align-middle">
                          <td className="py-1 pe-2">
                            <Select
                              value={newEnvId != null ? String(newEnvId) : undefined}
                              onValueChange={(v) => setNewEnvId(Number(v))}
                            >
                              <SelectTrigger className="h-8 w-full">
                                <SelectValue placeholder={t('environments.name')} />
                              </SelectTrigger>
                              <SelectContent>
                                {availableEnvironmentsToAdd.map((e) => (
                                  <SelectItem key={e.id} value={String(e.id)}>
                                    {e.name ?? ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-1 pe-2">
                            <Input
                              value={newEnvUrl}
                              onChange={(e) => setNewEnvUrl(e.target.value)}
                              placeholder="https://..."
                              className="h-8"
                            />
                          </td>
                          <td className="py-1 text-center">
                            <input
                              type="checkbox"
                              checked={newEnvActive}
                              onChange={(e) => setNewEnvActive(e.target.checked)}
                              aria-label={t('common.active')}
                              className="h-4 w-4 cursor-pointer"
                            />
                          </td>
                          <td className="py-1 whitespace-nowrap text-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              type="button"
                              aria-label={t('common.save')}
                              disabled={newEnvId == null || !newEnvUrl.trim() || saveEnvMut.isPending}
                              onClick={confirmAddEnvironment}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              type="button"
                              aria-label={t('common.cancel')}
                              onClick={cancelAddEnvironment}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
                {!showAddEnvRow && availableEnvironmentsToAdd.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 self-start"
                    onClick={startAddEnvironment}
                  >
                    <Plus className="h-4 w-4" />
                    {t('projects.addEnvironment')}
                  </Button>
                )}
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
