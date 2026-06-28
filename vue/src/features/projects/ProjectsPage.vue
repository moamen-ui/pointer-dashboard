<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiAdminProjects,
  usePostApiAdminProjects,
  usePatchApiAdminProjectsId,
  getGetApiAdminProjectsQueryKey,
  type ProjectResponse,
} from '@moamen-ui/pointer-vue';
import { Plus, Ban, CheckCircle2 } from 'lucide-vue-next';
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

const { t } = useI18n();

const queryClient = useQueryClient();

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

function openAdd() {
  addForm.key = '';
  addForm.name = '';
  addOpen.value = true;
}

async function addProject() {
  if (addInvalid.value) return;
  busy.value = true;
  try {
    await createProject.mutateAsync({ data: { ...addForm } });
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
            <TableCell>
              <Button
                :variant="project.isActive ? 'destructive' : 'default'"
                size="sm"
                :disabled="loading"
                @click="toggleActive(project)"
              >
                <component :is="project.isActive ? Ban : CheckCircle2" class="h-4 w-4" />
                {{ project.isActive ? t('common.disable') : t('common.enable') }}
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
      </form>
      <DialogFooter>
        <Button variant="outline" @click="addOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="addInvalid || loading" @click="addProject">
          <Plus class="h-4 w-4" /> {{ t('projects.addProject') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
