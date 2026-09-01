<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import type { ColumnDef } from '@tanstack/vue-table';
import {
  useGetApiAdminProjects,
  usePostApiAdminProjects,
  usePatchApiAdminProjectsId,
  getGetApiAdminProjectsQueryKey,
  getApiProjectsKeyExport,
  usePostApiProjectsKeyImport,
  useDeleteApiAdminProjectsId,
  usePostApiProjectsIdPredefinedActionSuggestions,
  type ProjectResponse,
  type ImportResultDto,
  type ExportFileDto,
  type PredefinedActionResponse,
} from '@moamen-ui/pointer-vue';
import { Plus, Ban, CheckCircle2, Download, Upload, Trash2, PlusCircle, Pencil, FolderOpen } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable, dataTableFeatures } from '@/components/shared/data-table';
import type { RowActionItem } from '@/components/shared/types';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { extractMessage } from '@/lib/error';
import { confirm } from '@/composables/useConfirm';
import { toast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';

const { t } = useI18n();

// Mirrors CreateProjectValidator on the API: the server checks the *raw* value
// against ^[a-z0-9._-]+$ (varchar(64)) before lowercasing it, so the form keeps
// the input in that shape while the user types.
const KEY_PATTERN = /^[a-z0-9-]+$/;
const KEY_MAX_LENGTH = 64;

const queryClient = useQueryClient();

const { isSuperAdmin } = useAuth();

const { data, isLoading } = useGetApiAdminProjects();
const projects = computed<ProjectResponse[]>(() => data.value ?? []);
const busy = ref(false);
const loading = computed(() => isLoading.value || busy.value);

const createProject = usePostApiAdminProjects();
const updateProject = usePatchApiAdminProjectsId();

function fail(e: unknown) {
  busy.value = false;
  toast(extractMessage(e));
}
function reload() {
  void queryClient.invalidateQueries({ queryKey: getGetApiAdminProjectsQueryKey() });
}

// ── Add project ───────────────────────────────────────────────────────
const addOpen = ref(false);
const addForm = reactive({ key: '', name: '' });
// #138 — once the user edits the key themselves, name edits stop overwriting it.
const keyEdited = ref(false);

/** Derives the key from the project name: lowercase, runs of characters the
 *  key doesn't allow become a single "-", no leading/trailing separators,
 *  capped at the column length. ("My New App" → "my-new-app") */
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

/** Lowercases + trims while typing; lowercasing keeps the length so the caret
 *  stays put (clamped after a trim shrank the value). */
function normalizeKey(event: Event) {
  const input = event.target as HTMLInputElement;
  const normalized = input.value.toLowerCase().trim();
  if (normalized === input.value) return;
  const caret = input.selectionStart ?? normalized.length;
  input.value = normalized;
  input.setSelectionRange(caret, caret);
  addForm.key = normalized;
}

/** Auto-fills the key from the name until the user edits the key themselves —
 *  and never fights a key they cleared back to empty on purpose. */
function syncKeyFromName(event: Event) {
  if (keyEdited.value) return;
  addForm.key = slugifyKey((event.target as HTMLInputElement).value);
}

function onKeyEdited(event: Event) {
  keyEdited.value = true;
  normalizeKey(event);
}

/** First failing rule wins: required → pattern → max length → taken. */
const keyError = computed(() => {
  const key = addForm.key.toLowerCase().trim();
  if (!key) return t('projects.keyRequired');
  if (!KEY_PATTERN.test(key)) return t('projects.keyPattern');
  if (key.length > KEY_MAX_LENGTH) return t('projects.keyMaxLength', { max: KEY_MAX_LENGTH });
  if (projects.value.some((p) => (p.key ?? '').toLowerCase() === key)) {
    return t('projects.keyTaken');
  }
  return null;
});

const addInvalid = computed(() => keyError.value !== null || !addForm.name.trim());
const addActions = ref<Array<{ text: string; prompt: string }>>([]);

function openAdd() {
  addForm.key = '';
  addForm.name = '';
  keyEdited.value = false;
  addActions.value = [];
  addOpen.value = true;
}

function addActionRow() {
  addActions.value.push({ text: '', prompt: '' });
}

function removeActionRow(index: number) {
  addActions.value.splice(index, 1);
}

async function addProject() {
  if (addInvalid.value) return;
  busy.value = true;
  try {
    await createProject.mutateAsync({
      data: {
        ...addForm,
        predefinedActions: addActions.value.map((a, i) => ({
          text: a.text,
          prompt: a.prompt,
          sortOrder: i,
          isActive: true,
        })),
      },
    });
    busy.value = false;
    addOpen.value = false;
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Active toggle ─────────────────────────────────────────────────────
async function toggleActive(project: ProjectResponse) {
  if (!project.isActive) {
    await patchActive(project, true);
    return;
  }
  const ok = await confirm({
    message: t('common.confirmDisable', { name: project.key }),
    confirmLabel: t('common.disable'),
    confirmVariant: 'destructive',
  });
  if (ok) await patchActive(project, false);
}

async function patchActive(project: ProjectResponse, isActive: boolean) {
  busy.value = true;
  try {
    await updateProject.mutateAsync({ id: project.id!, data: { isActive } });
    busy.value = false;
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Export ────────────────────────────────────────────────────────────
async function exportProject(project: ProjectResponse) {
  try {
    const exportData = await getApiProjectsKeyExport(project.key!);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pointer-comments-${project.key}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(t('exportImport.exported'));
  } catch (e) {
    fail(e);
  }
}

// ── Import ────────────────────────────────────────────────────────────
const importDialogOpen = ref(false);
const importTargetProject = ref<ProjectResponse | null>(null);
const importFile = ref<File | null>(null);
const importResult = ref<ImportResultDto | null>(null);

const importMutation = usePostApiProjectsKeyImport();

function openImport(project: ProjectResponse) {
  importTargetProject.value = project;
  importFile.value = null;
  importResult.value = null;
  importDialogOpen.value = true;
}

async function submitImport() {
  if (!importFile.value || !importTargetProject.value) return;
  busy.value = true;
  try {
    const text = await importFile.value.text();
    const data = JSON.parse(text) as ExportFileDto;
    const result = await importMutation.mutateAsync({ key: importTargetProject.value.key!, data });
    importResult.value = result;
    const msg = t('exportImport.importCounts', {
      comments: result.importedComments ?? 0,
      replies: result.importedReplies ?? 0,
    });
    toast(`${t('exportImport.imported')} ${msg}`);
    if (result.warnings?.length) {
      result.warnings.forEach((w) => toast(w));
    }
    importDialogOpen.value = false;
    reload();
  } catch (e) {
    fail(e);
  } finally {
    busy.value = false;
  }
}

// ── Edit project ──────────────────────────────────────────────────────
interface EditableAction {
  id?: number;
  text: string;
  prompt: string;
}

const editOpen = ref(false);
const editProject = ref<ProjectResponse | null>(null);
const editName = ref('');
const editActions = ref<EditableAction[]>([]);
const editPageContextCaptureEnabled = ref(false);
const editInvalid = computed(() => !editName.value.trim());

const patchProject = usePatchApiAdminProjectsId();

function openEdit(project: ProjectResponse) {
  editProject.value = project;
  editName.value = project.name ?? '';
  editPageContextCaptureEnabled.value = !!project.pageContextCaptureEnabled;
  editActions.value = (project.predefinedActions ?? []).map((a: PredefinedActionResponse) => ({
    id: a.id,
    text: a.text ?? '',
    prompt: a.prompt ?? '',
  }));
  editOpen.value = true;
}

function addEditActionRow() {
  editActions.value.push({ text: '', prompt: '' });
}

function removeEditActionRow(index: number) {
  editActions.value.splice(index, 1);
}

async function saveEdit() {
  if (editInvalid.value || !editProject.value) return;
  busy.value = true;
  try {
    await patchProject.mutateAsync({
      id: editProject.value.id!,
      data: {
        name: editName.value,
        pageContextCaptureEnabled: editPageContextCaptureEnabled.value,
        predefinedActions: editActions.value.map((a, i) => ({
          ...(a.id != null ? { id: a.id } : {}),
          text: a.text,
          prompt: a.prompt,
          sortOrder: i,
          isActive: true,
        })),
      },
    });
    busy.value = false;
    editOpen.value = false;
    toast(t('projects.saved'));
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Delete project ────────────────────────────────────────────────────
const deleteProject = useDeleteApiAdminProjectsId();

async function confirmDelete(project: ProjectResponse) {
  const ok = await confirm({
    message: t('projects.deleteConfirm'),
    confirmLabel: t('projects.delete'),
    confirmVariant: 'destructive',
  });
  if (!ok) return;
  busy.value = true;
  try {
    await deleteProject.mutateAsync({ id: project.id! });
    busy.value = false;
    toast(t('projects.deleted'));
    reload();
  } catch (e) {
    fail(e);
  }
}

// ── Suggest prompt ────────────────────────────────────────────────────
const suggestMutation = usePostApiProjectsIdPredefinedActionSuggestions();
const suggestOpen = ref(false);
const suggestTargetProject = ref<ProjectResponse | null>(null);
const suggestForm = reactive<{ text: string; prompt: string }>({ text: '', prompt: '' });

function openSuggest(project: ProjectResponse) {
  suggestTargetProject.value = project;
  suggestForm.text = '';
  suggestForm.prompt = '';
  suggestOpen.value = true;
}

async function submitSuggest() {
  if (!suggestTargetProject.value) return;
  busy.value = true;
  try {
    await suggestMutation.mutateAsync({
      id: suggestTargetProject.value.id!,
      data: { text: suggestForm.text, prompt: suggestForm.prompt },
    });
    busy.value = false;
    suggestOpen.value = false;
    toast(t('suggestions.sent'));
  } catch (e) {
    busy.value = false;
    // Check for 403 — user can actually edit directly
    const status = (e as any)?.response?.status;
    if (status === 403) {
      toast(t('suggestions.canEditDirectly'));
    } else {
      toast(extractMessage(e));
    }
  }
}

// ── View prompts (read-only) ──────────────────────────────────────────
const viewPromptsOpen = ref(false);
const viewPromptsProject = ref<ProjectResponse | null>(null);

function openViewPrompts(project: ProjectResponse) {
  viewPromptsProject.value = project;
  viewPromptsOpen.value = true;
}

// A computed so headers follow live language switches.
const columns = computed<ColumnDef<typeof dataTableFeatures, ProjectResponse>[]>(() => [
  { accessorKey: 'key', header: t('projects.key'), enableSorting: false },
  { accessorKey: 'name', header: t('projects.name'), enableSorting: false },
  { accessorKey: 'createdByName', header: t('projects.createdBy'), enableSorting: false },
  { accessorKey: 'commentsCount', header: t('projects.comments'), enableSorting: false },
  { accessorKey: 'isActive', header: t('projects.status'), enableSorting: false },
]);

// Per-row action menu. Enable/Disable stays unconditional (no isAdmin/canEdit
// gate) -- matches this page's pre-existing convention, kept as-is rather than
// aligned to the angular/react ports' gating.
function actionsFor(project: ProjectResponse): RowActionItem[] {
  const items: RowActionItem[] = [
    {
      label: t(project.isActive ? 'common.disable' : 'common.enable'),
      icon: project.isActive ? Ban : CheckCircle2,
      severity: project.isActive ? 'danger' : 'neutral',
      disabled: loading.value,
      onClick: () => void toggleActive(project),
    },
  ];
  if (project.canEdit) {
    items.push({ label: t('projects.edit'), icon: Pencil, disabled: loading.value, onClick: () => openEdit(project) });
  } else {
    items.push({ label: t('projects.viewPrompts'), icon: Pencil, disabled: loading.value, onClick: () => openViewPrompts(project) });
    items.push({ label: t('projects.suggest'), icon: PlusCircle, disabled: loading.value, onClick: () => openSuggest(project) });
  }
  items.push({ label: t('exportImport.export'), icon: Download, disabled: loading.value, onClick: () => void exportProject(project) });
  if (isSuperAdmin.value) {
    items.push({ label: t('exportImport.import'), icon: Upload, disabled: loading.value, onClick: () => openImport(project) });
  }
  // Delete stays last in every menu (Pointer feedback #137).
  items.push({
    label: t('projects.delete'),
    icon: Trash2,
    severity: 'danger',
    disabled: !project.canDelete || loading.value,
    tooltip: project.canDelete ? undefined : t('projects.deleteBlockedComments'),
    onClick: () => void confirmDelete(project),
  });
  return items;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-lg font-semibold">{{ t('projects.title') }}</h2>
      <Button v-if="!isSuperAdmin" @click="openAdd">
        <Plus class="h-4 w-4" /> {{ t('projects.addProject') }}
      </Button>
    </div>

    <!-- Super admins are platform-management only — they can't own a project (backend:
         ProjectService.CreateAsync forbids it). Point them at a real tenant account instead of
         showing an Add-Project affordance that would only 403. -->
    <p v-if="isSuperAdmin" class="text-sm text-muted-foreground">{{ t('projects.superAdminNote') }}</p>

    <div v-if="loading" class="h-0.5 w-full overflow-hidden rounded bg-muted">
      <div class="h-full w-1/3 animate-pulse bg-primary" />
    </div>

    <DataTable
      :data="projects"
      :columns="columns"
      :actions="actionsFor"
      :actions-aria-label="t('projects.actions')"
      paginated
      :loading="loading"
      :empty-icon="FolderOpen"
      :empty-message="t('projects.empty')"
      :empty-hint="t(isSuperAdmin ? 'projects.superAdminEmptyHint' : 'projects.emptyHint')"
    >
      <template #cell-key="{ row }">
        <code class="rounded bg-muted px-1.5 py-0.5 text-xs">{{ row.key }}</code>
      </template>
      <template #cell-name="{ row }">{{ row.name }}</template>
      <template #cell-createdByName="{ row }">
        <span class="text-sm text-muted-foreground">{{ row.createdByName ?? '—' }}</span>
      </template>
      <template #cell-commentsCount="{ row }">
        <span class="text-sm text-muted-foreground">{{ row.commentsCount ?? 0 }}</span>
      </template>
      <template #cell-isActive="{ row }">
        <Badge :variant="row.isActive ? 'success' : 'destructive'">
          {{ t(row.isActive ? 'common.active' : 'common.disabled') }}
        </Badge>
      </template>
      <Button v-if="!isSuperAdmin" @click="openAdd">
        <Plus class="h-4 w-4" /> {{ t('projects.addProject') }}
      </Button>
    </DataTable>
  </div>

  <!-- Add project dialog -->
  <Dialog v-model:open="addOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('projects.addProject') }}</DialogTitle>
      </DialogHeader>
      <form class="flex flex-col gap-3 pt-2" @submit.prevent="addProject">
        <div class="flex flex-col gap-2">
          <Label for="p-name">{{ t('projects.name') }}</Label>
          <Input id="p-name" v-model="addForm.name" @input="syncKeyFromName" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="p-key">{{ t('projects.key') }}</Label>
          <Input
            id="p-key"
            v-model="addForm.key"
            :maxlength="KEY_MAX_LENGTH"
            autocapitalize="none"
            spellcheck="false"
            @input="onKeyEdited"
          />
          <p v-if="keyError" class="text-xs font-medium text-destructive">{{ keyError }}</p>
          <p v-else class="text-xs text-muted-foreground">
            {{ t(keyEdited ? 'projects.keyHint' : 'projects.keyAutoHint') }}
          </p>
        </div>

        <!-- Predefined actions section -->
        <div class="flex flex-col gap-2">
          <p class="text-xs text-muted-foreground">{{ t('predefined.projectHelp') }}</p>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{{ t('predefined.section') }}</span>
            <Button type="button" variant="outline" size="sm" @click="addActionRow">
              <PlusCircle class="h-4 w-4" /> {{ t('predefined.add') }}
            </Button>
          </div>
          <p v-if="addActions.length === 0" class="text-xs text-muted-foreground italic">{{ t('predefined.empty') }}</p>
          <div v-for="(action, idx) in addActions" :key="idx" class="flex flex-col gap-1 rounded-md border p-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted-foreground">#{{ idx + 1 }}</span>
              <Button type="button" variant="ghost" size="icon" @click="removeActionRow(idx)">
                <Trash2 class="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <Label :for="'add-act-text-' + idx">{{ t('predefined.text') }}</Label>
            <Input :id="'add-act-text-' + idx" v-model="action.text" />
            <Label :for="'add-act-prompt-' + idx">{{ t('predefined.prompt') }}</Label>
            <textarea
              :id="'add-act-prompt-' + idx"
              v-model="action.prompt"
              rows="2"
              class="flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm resize-none"
            />
          </div>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="addOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="addInvalid || loading" @click="addProject">
          <Plus class="h-4 w-4" /> {{ t('projects.addProject') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Edit project dialog -->
  <Dialog v-model:open="editOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('projects.editTitle') }}</DialogTitle>
      </DialogHeader>
      <form class="flex flex-col gap-3 pt-2" @submit.prevent="saveEdit">
        <div class="flex flex-col gap-2">
          <Label for="edit-name">{{ t('projects.name') }}</Label>
          <Input id="edit-name" v-model="editName" />
        </div>

        <div class="flex items-center justify-between gap-4">
          <div class="flex flex-col gap-1">
            <Label for="edit-capture" class="text-sm font-medium">{{ t('projects.pageContextCapture') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('projects.pageContextCaptureHint') }}</p>
          </div>
          <input
            id="edit-capture"
            v-model="editPageContextCaptureEnabled"
            type="checkbox"
            class="h-4 w-4 cursor-pointer"
          />
        </div>

        <!-- Predefined actions section -->
        <div class="flex flex-col gap-2">
          <p class="text-xs text-muted-foreground">{{ t('predefined.projectHelp') }}</p>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{{ t('predefined.section') }}</span>
            <Button type="button" variant="outline" size="sm" @click="addEditActionRow">
              <PlusCircle class="h-4 w-4" /> {{ t('predefined.add') }}
            </Button>
          </div>
          <p v-if="editActions.length === 0" class="text-xs text-muted-foreground italic">{{ t('predefined.empty') }}</p>
          <div v-for="(action, idx) in editActions" :key="idx" class="flex flex-col gap-1 rounded-md border p-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted-foreground">#{{ idx + 1 }}</span>
              <Button type="button" variant="ghost" size="icon" @click="removeEditActionRow(idx)">
                <Trash2 class="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <Label :for="'edit-act-text-' + idx">{{ t('predefined.text') }}</Label>
            <Input :id="'edit-act-text-' + idx" v-model="action.text" />
            <Label :for="'edit-act-prompt-' + idx">{{ t('predefined.prompt') }}</Label>
            <textarea
              :id="'edit-act-prompt-' + idx"
              v-model="action.prompt"
              rows="2"
              class="flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm resize-none"
            />
          </div>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="editOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="editInvalid || loading" @click="saveEdit">
          {{ t('common.save') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Import dialog -->
  <Dialog v-model:open="importDialogOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('exportImport.importTitle') }}</DialogTitle>
      </DialogHeader>
      <p class="text-sm text-muted-foreground">{{ t('exportImport.importHint') }}</p>
      <form class="flex flex-col gap-3 pt-2" @submit.prevent="submitImport">
        <div class="flex flex-col gap-2">
          <Label for="import-file">{{ t('exportImport.import') }}</Label>
          <input
            id="import-file"
            type="file"
            accept=".json"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            @change="(e) => { importFile = (e.target as HTMLInputElement).files?.[0] ?? null; }"
          />
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="importDialogOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="!importFile || loading" @click="submitImport">
          {{ t('exportImport.import') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Suggest prompt dialog -->
  <Dialog v-model:open="suggestOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('projects.suggest') }}</DialogTitle>
      </DialogHeader>
      <form class="flex flex-col gap-3 pt-2" @submit.prevent="submitSuggest">
        <div class="flex flex-col gap-2">
          <Label for="suggest-text">{{ t('predefined.text') }}</Label>
          <Input id="suggest-text" v-model="suggestForm.text" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="suggest-prompt">{{ t('predefined.prompt') }}</Label>
          <textarea
            id="suggest-prompt"
            v-model="suggestForm.prompt"
            rows="3"
            class="flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm resize-none"
          />
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="suggestOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="!suggestForm.text || loading" @click="submitSuggest">
          {{ t('projects.suggest') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- View predefined prompts (read-only) dialog -->
  <Dialog v-model:open="viewPromptsOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('projects.viewPrompts') }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-3 pt-2">
        <p
          v-if="!viewPromptsProject?.predefinedActions?.length"
          class="text-sm text-muted-foreground italic"
        >
          {{ t('predefined.empty') }}
        </p>
        <div
          v-for="(action, idx) in (viewPromptsProject?.predefinedActions ?? [])"
          :key="action.id ?? idx"
          class="flex flex-col gap-1 rounded-md border p-2"
        >
          <div class="flex flex-col gap-1">
            <Label>{{ t('predefined.text') }}</Label>
            <p class="text-sm">{{ action.text }}</p>
          </div>
          <div class="flex flex-col gap-1">
            <Label>{{ t('predefined.prompt') }}</Label>
            <p class="text-sm text-muted-foreground whitespace-pre-wrap">{{ action.prompt }}</p>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="viewPromptsOpen = false">{{ t('common.cancel') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
