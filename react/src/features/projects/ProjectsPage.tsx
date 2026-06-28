// Projects admin page. React port of angular/.../projects/projects.component.ts.
// list (key, name, status) + add project + enable/disable (disable confirmed).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getApiAdminProjects,
  postApiAdminProjects,
  patchApiAdminProjectsId,
  type ProjectResponse,
} from '@moamen-ui/pointer-react';
import { Plus, Ban, CheckCircle2 } from 'lucide-react';
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

const PROJECTS_KEY = ['admin', 'projects'];

export function ProjectsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: projects = [] } = useQuery<ProjectResponse[]>({
    queryKey: PROJECTS_KEY,
    queryFn: ({ signal }) => getApiAdminProjects(signal),
  });

  const reload = () => qc.invalidateQueries({ queryKey: PROJECTS_KEY });
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  // ---- Add project ----
  const [addOpen, setAddOpen] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');

  const addMut = useMutation({
    mutationFn: (body: { key: string; name: string }) => postApiAdminProjects(body),
    onSuccess: () => {
      setAddOpen(false);
      setKey('');
      setName('');
      reload();
    },
    onError,
  });

  function openAdd() {
    setKey('');
    setName('');
    setAddOpen(true);
  }
  function addProject() {
    if (!key.trim() || !name.trim()) return;
    addMut.mutate({ key: key.trim(), name: name.trim() });
  }

  // ---- Enable / disable ----
  const patchMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      patchApiAdminProjectsId(id, { isActive }),
    onSuccess: () => reload(),
    onError,
  });

  const [confirmProject, setConfirmProject] = useState<ProjectResponse | null>(null);

  function toggleActive(project: ProjectResponse) {
    if (!project.isActive) {
      patchMut.mutate({ id: project.id!, isActive: true });
      return;
    }
    setConfirmProject(project);
  }
  function confirmDisable() {
    const p = confirmProject;
    setConfirmProject(null);
    if (p) patchMut.mutate({ id: p.id!, isActive: false });
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(project)}
                    disabled={patchMut.isPending}
                  >
                    {project.isActive ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {t(project.isActive ? 'common.disable' : 'common.enable')}
                  </Button>
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
        <DialogContent className="max-w-md">
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
