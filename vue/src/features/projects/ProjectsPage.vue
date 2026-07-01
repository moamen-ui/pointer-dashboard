<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiAdminProjects,
  usePostApiAdminProjects,
  usePatchApiAdminProjectsId,
  getGetApiAdminProjectsQueryKey,
  getApiProjectsKeyExport,
  AXIOS_INSTANCE,
  type ProjectResponse,
  type ImportResultDto,
} from '@moamen-ui/pointer-vue';
import { Plus, Ban, CheckCircle2, Download, Upload, Trash2, PlusCircle } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { extractMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import { confirm } from '@/composables/useConfirm';
import { toast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';

const { t } = useI18n();

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
const addInvalid = computed(() => !addForm.key.trim() || !addForm.name.trim());
const addActions = ref<Array<{ text: string; prompt: string }>>([]);

function openAdd() {
  addForm.key = '';
  addForm.name = '';
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
    const data = await getApiProjectsKeyExport(project.key!);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
    const body = JSON.parse(text);
    const res = await AXIOS_INSTANCE.post(
      `/api/projects/${importTargetProject.value.key}/import`,
      body,
      { headers: { 'Content-Type': 'application/json' } },
    );
    // res.data is { isSuccess: boolean, data: ImportResultDto }
    const result: ImportResultDto = res.data?.data ?? res.data;
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
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-lg font-semibold">{{ t('projects.title') }}</h2>
      <Button @click="openAdd">
        <Plus class="h-4 w-4" /> {{ t('projects.addProject') }}
      </Button>
    </div>

    <div v-if="loading" class="h-0.5 w-full overflow-hidden rounded bg-muted">
      <div class="h-full w-1/3 animate-pulse bg-primary" />
    </div>

    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ t('projects.key') }}</TableHead>
            <TableHead>{{ t('projects.name') }}</TableHead>
            <TableHead>{{ t('projects.status') }}</TableHead>
            <TableHead>{{ t('projects.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="project in projects" :key="project.id">
            <TableCell>
              <code class="rounded bg-muted px-1.5 py-0.5 text-xs">{{ project.key }}</code>
            </TableCell>
            <TableCell>{{ project.name }}</TableCell>
            <TableCell>
              <span :class="cn('chip', project.isActive ? 'chip-active' : 'chip-disabled')">
                {{ t(project.isActive ? 'common.active' : 'common.disabled') }}
              </span>
            </TableCell>
            <TableCell class="flex flex-wrap items-center gap-2">
              <Button
                :variant="project.isActive ? 'destructive' : 'default'"
                size="sm"
                :disabled="loading"
                @click="toggleActive(project)"
              >
                <component :is="project.isActive ? Ban : CheckCircle2" class="h-4 w-4" />
                {{ project.isActive ? t('common.disable') : t('common.enable') }}
              </Button>
              <Button variant="outline" size="sm" :disabled="loading" @click="exportProject(project)">
                <Download class="h-4 w-4" /> {{ t('exportImport.export') }}
              </Button>
              <Button v-if="isSuperAdmin" variant="outline" size="sm" :disabled="loading" @click="openImport(project)">
                <Upload class="h-4 w-4" /> {{ t('exportImport.import') }}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  </div>

  <!-- Add project dialog -->
  <Dialog v-model:open="addOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('projects.addProject') }}</DialogTitle>
      </DialogHeader>
      <form class="flex flex-col gap-3 pt-2" @submit.prevent="addProject">
        <div class="flex flex-col gap-2">
          <Label for="p-key">{{ t('projects.key') }}</Label>
          <Input id="p-key" v-model="addForm.key" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="p-name">{{ t('projects.name') }}</Label>
          <Input id="p-name" v-model="addForm.name" />
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
</template>
