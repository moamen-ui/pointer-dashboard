// Projects page — available to all authenticated users.
// Admins see all projects; non-admins see their own.
// Per-row capabilities driven by server flags: canEdit, canDelete.
// New in this revision:
//   • Delete (useDeleteApiAdminProjectsId) — only when canDelete; disabled+tooltip when !canDelete
//   • commentsCount + createdByName shown as row info
//   • View predefined prompts read-only when !canEdit
//   • "Suggest prompt" dialog when !canEdit (usePostApiProjectsIdPredefinedActionSuggestions)
//   • Other-environment rows have NO per-row save — the dialog's single Save persists
//     every dirty row (plus the pending add-row) together after the project PATCH
//   • "Environment switcher visibility" role multiselect (environmentSelectorRoleIds)
import { useRef, useState, useEffect } from 'react';
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
  useGetApiAdminRoles,
  putApiAdminProjectsIdAppUrlsEnvironmentId,
  useDeleteApiAdminProjectsIdAppUrlsEnvironmentId,
  getGetApiAdminProjectsQueryKey,
  getGetApiAdminProjectsIdAppUrlsQueryKey,
  getApiProjectsKeyExport,
  useGetApiAiRulesProjectKey,
  getGetApiAiRulesProjectKeyQueryKey,
  usePostApiAdminAiRules,
  usePutApiAdminAiRulesId,
  useDeleteApiAdminAiRulesId,
  getGetApiAiRulesMyQueryKey,
  usePostApiAiRulesMy,
  usePutApiAiRulesMyId,
  useDeleteApiAiRulesMyId,
  type AiRuleResponse,
  ProjectActivationState,
  type ProjectResponse,
  type PredefinedActionInput,
  type ExportFileDto,
} from '@moamen-ui/pointer-react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Plus,
  Ban,
  CheckCircle2,
  Download,
  Upload,
  Trash2,
  Eye,
  MessageSquarePlus,
  FolderOpen,
  X,
  ChevronDown,
  Check,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
type PredefinedActionRow = {
  _localId: number;
  id?: number;
  text: string;
  prompt: string;
};

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

type EditableAiRule = {
  id?: number;
  title: string;
  prompt: string;
  isActive: boolean;
  isInherited?: boolean;
  isPersonal?: boolean;
  dirty: boolean;
};

type ProjectAiRulesContentProps = {
  project: ProjectResponse;
  canEditProject?: boolean;
};

function ProjectAiRulesContent({ project, canEditProject }: ProjectAiRulesContentProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const projectKey = project.key ?? '';
  const { data: rulesData, isLoading } = useGetApiAiRulesProjectKey(projectKey, {
    query: { enabled: !!projectKey },
  });

  const adminRules: AiRuleResponse[] = (rulesData?.adminRules as AiRuleResponse[]) ?? [];
  const myRules: AiRuleResponse[] = (rulesData?.myRules as AiRuleResponse[]) ?? [];

  const [localAdminRules, setLocalAdminRules] = useState<Record<number, EditableAiRule>>({});
  const [localMyRules, setLocalMyRules] = useState<Record<number, EditableAiRule>>({});

  const [newProjectRuleTitle, setNewProjectRuleTitle] = useState('');
  const [newProjectRulePrompt, setNewProjectRulePrompt] = useState('');

  const [newPersonalRuleTitle, setNewPersonalRuleTitle] = useState('');
  const [newPersonalRulePrompt, setNewPersonalRulePrompt] = useState('');

  const reloadRules = () => {
    void qc.invalidateQueries({ queryKey: getGetApiAiRulesProjectKeyQueryKey(projectKey) });
    void qc.invalidateQueries({ queryKey: getGetApiAiRulesMyQueryKey() });
  };

  useEffect(() => {
    setLocalAdminRules((prev) => {
      let added = false;
      const next = { ...prev };
      for (const r of adminRules) {
        if (r.id != null && !(r.id in next)) {
          next[r.id] = {
            id: r.id,
            title: r.title ?? '',
            prompt: r.prompt ?? '',
            isActive: r.isActive ?? true,
            isInherited: r.isTenantWide ?? false,
            dirty: false,
          };
          added = true;
        }
      }
      return added ? next : prev;
    });
  }, [adminRules]);

  useEffect(() => {
    setLocalMyRules((prev) => {
      let added = false;
      const next = { ...prev };
      for (const r of myRules) {
        if (r.id != null && !(r.id in next)) {
          next[r.id] = {
            id: r.id,
            title: r.title ?? '',
            prompt: r.prompt ?? '',
            isActive: r.isActive ?? true,
            isPersonal: true,
            dirty: false,
          };
          added = true;
        }
      }
      return added ? next : prev;
    });
  }, [myRules]);

  function updateAdminRule(id: number, field: 'title' | 'prompt' | 'isActive', value: any) {
    setLocalAdminRules((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, dirty: true },
    }));
  }

  function updateMyRule(id: number, field: 'title' | 'prompt' | 'isActive', value: any) {
    setLocalMyRules((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, dirty: true },
    }));
  }

  // Admin rule mutations
  const putAdminRuleMut = usePutApiAdminAiRulesId({
    mutation: {
      onSuccess: (_data, vars) => {
        setLocalAdminRules((prev) => ({
          ...prev,
          [vars.id]: { ...prev[vars.id], dirty: false },
        }));
        reloadRules();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  const deleteAdminRuleMut = useDeleteApiAdminAiRulesId({
    mutation: {
      onSuccess: (_data, vars) => {
        setLocalAdminRules((prev) => {
          const next = { ...prev };
          delete next[vars.id];
          return next;
        });
        reloadRules();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  const postAdminRuleMut = usePostApiAdminAiRules({
    mutation: {
      onSuccess: () => {
        setNewProjectRuleTitle('');
        setNewProjectRulePrompt('');
        reloadRules();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  // Personal rule mutations
  const putMyRuleMut = usePutApiAiRulesMyId({
    mutation: {
      onSuccess: (_data, vars) => {
        setLocalMyRules((prev) => ({
          ...prev,
          [vars.id]: { ...prev[vars.id], dirty: false },
        }));
        reloadRules();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  const deleteMyRuleMut = useDeleteApiAiRulesMyId({
    mutation: {
      onSuccess: (_data, vars) => {
        setLocalMyRules((prev) => {
          const next = { ...prev };
          delete next[vars.id];
          return next;
        });
        reloadRules();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  const postMyRuleMut = usePostApiAiRulesMy({
    mutation: {
      onSuccess: () => {
        setNewPersonalRuleTitle('');
        setNewPersonalRulePrompt('');
        reloadRules();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  function saveAdminRule(ruleId: number) {
    const edit = localAdminRules[ruleId];
    if (!edit) return;
    putAdminRuleMut.mutate({
      id: ruleId,
      data: {
        title: edit.title.trim(),
        prompt: edit.prompt.trim(),
        isActive: edit.isActive,
      },
    });
  }

  function handleCreateAdminRule() {
    if (!project.id || !newProjectRuleTitle.trim() || !newProjectRulePrompt.trim()) return;
    postAdminRuleMut.mutate({
      data: {
        projectId: project.id,
        title: newProjectRuleTitle.trim(),
        prompt: newProjectRulePrompt.trim(),
        sortOrder: adminRules.length,
      },
    });
  }

  function savePersonalRule(ruleId: number) {
    const edit = localMyRules[ruleId];
    if (!edit) return;
    putMyRuleMut.mutate({
      id: ruleId,
      data: {
        title: edit.title.trim(),
        prompt: edit.prompt.trim(),
        isActive: edit.isActive,
      },
    });
  }

  function handleCreatePersonalRule() {
    if (!project.id || !newPersonalRuleTitle.trim() || !newPersonalRulePrompt.trim()) return;
    postMyRuleMut.mutate({
      data: {
        projectId: project.id,
        title: newPersonalRuleTitle.trim(),
        prompt: newPersonalRulePrompt.trim(),
        sortOrder: myRules.length,
      },
    });
  }

  const canManageAdminRules = canEditProject || isAdmin;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-muted-foreground">{t('aiRules.projectHelp')}</p>

      {isLoading && adminRules.length === 0 && myRules.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('projects.loading', { defaultValue: 'Loading…' })}</p>
      )}

      {/* Section 1: Workspace & Project Admin Rules */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-semibold">{t('aiRules.adminRulesTitle')}</div>
          <div className="text-xs text-muted-foreground">{t('aiRules.adminRulesSubtitle')}</div>
        </div>

        <div className="flex flex-col gap-3">
          {adminRules.map((rule) => {
            const isInherited = !!rule.isTenantWide;
            const edit = localAdminRules[rule.id!] ?? {
              id: rule.id,
              title: rule.title ?? '',
              prompt: rule.prompt ?? '',
              isActive: rule.isActive ?? true,
              isInherited,
              dirty: false,
            };
            const isSaving =
              putAdminRuleMut.isPending &&
              (putAdminRuleMut.variables as { id?: number } | undefined)?.id === rule.id;

            return (
              <div
                key={rule.id}
                className="flex flex-col gap-2 rounded-md border border-border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-1 items-center gap-2">
                    <Badge variant={isInherited ? 'default' : 'warning'}>
                      {t(isInherited ? 'aiRules.inheritedBadge' : 'aiRules.projectBadge')}
                    </Badge>
                    {!isInherited && canManageAdminRules ? (
                      <Input
                        value={edit.title}
                        onChange={(e) => updateAdminRule(rule.id!, 'title', e.target.value)}
                        className="h-8 flex-1"
                      />
                    ) : (
                      <span className="text-sm font-medium">{rule.title}</span>
                    )}
                  </div>
                  {!isInherited && canManageAdminRules ? (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={edit.isActive}
                          onChange={(e) => updateAdminRule(rule.id!, 'isActive', e.target.checked)}
                          className="h-4 w-4 cursor-pointer"
                        />
                        {t(edit.isActive ? 'common.active' : 'common.disabled')}
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        type="button"
                        disabled={deleteAdminRuleMut.isPending}
                        onClick={() => deleteAdminRuleMut.mutate({ id: rule.id! })}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant={rule.isActive ? 'success' : 'destructive'}>
                      {t(rule.isActive ? 'common.active' : 'common.disabled')}
                    </Badge>
                  )}
                </div>

                {!isInherited && canManageAdminRules ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">{t('aiRules.promptLabel')}</Label>
                      <textarea
                        value={edit.prompt}
                        onChange={(e) => updateAdminRule(rule.id!, 'prompt', e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    {edit.dirty && (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={isSaving}
                          onClick={() => saveAdminRule(rule.id!)}
                        >
                          {t('common.save')}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded bg-muted/50 p-2 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                    {rule.prompt}
                  </div>
                )}
              </div>
            );
          })}

          {adminRules.length === 0 && !isLoading && (
            <p className="text-xs text-muted-foreground">{t('aiRules.empty')}</p>
          )}

          {/* Add Project Admin Rule Form */}
          {canManageAdminRules && (
            <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
              <div className="text-xs font-semibold text-muted-foreground">{t('aiRules.addRule')}</div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t('aiRules.titleLabel')}</Label>
                <Input
                  value={newProjectRuleTitle}
                  onChange={(e) => setNewProjectRuleTitle(e.target.value)}
                  placeholder={t('aiRules.titlePlaceholder')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t('aiRules.promptLabel')}</Label>
                <textarea
                  value={newProjectRulePrompt}
                  onChange={(e) => setNewProjectRulePrompt(e.target.value)}
                  rows={2}
                  placeholder={t('aiRules.promptPlaceholder')}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!newProjectRuleTitle.trim() || !newProjectRulePrompt.trim() || postAdminRuleMut.isPending}
                  onClick={handleCreateAdminRule}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  {t('aiRules.addRule')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: My Personal Rules */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-semibold">{t('aiRules.myRulesTitle')}</div>
          <div className="text-xs text-muted-foreground">{t('aiRules.myRulesSubtitle')}</div>
        </div>

        <div className="flex flex-col gap-3">
          {myRules.map((rule) => {
            const edit = localMyRules[rule.id!] ?? {
              id: rule.id,
              title: rule.title ?? '',
              prompt: rule.prompt ?? '',
              isActive: rule.isActive ?? true,
              isPersonal: true,
              dirty: false,
            };
            const isSaving =
              putMyRuleMut.isPending &&
              (putMyRuleMut.variables as { id?: number } | undefined)?.id === rule.id;

            return (
              <div
                key={rule.id}
                className="flex flex-col gap-2 rounded-md border border-border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-1 items-center gap-2">
                    <Badge variant="neutral">{t('aiRules.personalBadge')}</Badge>
                    <Input
                      value={edit.title}
                      onChange={(e) => updateMyRule(rule.id!, 'title', e.target.value)}
                      className="h-8 flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={edit.isActive}
                        onChange={(e) => updateMyRule(rule.id!, 'isActive', e.target.checked)}
                        className="h-4 w-4 cursor-pointer"
                      />
                      {t(edit.isActive ? 'common.active' : 'common.disabled')}
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      type="button"
                      disabled={deleteMyRuleMut.isPending}
                      onClick={() => deleteMyRuleMut.mutate({ id: rule.id! })}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t('aiRules.promptLabel')}</Label>
                  <textarea
                    value={edit.prompt}
                    onChange={(e) => updateMyRule(rule.id!, 'prompt', e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                {edit.dirty && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={isSaving}
                      onClick={() => savePersonalRule(rule.id!)}
                    >
                      {t('common.save')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {myRules.length === 0 && !isLoading && (
            <p className="text-xs text-muted-foreground">{t('aiRules.noPersonalRules')}</p>
          )}

          {/* Add Personal Rule Form */}
          <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
            <div className="text-xs font-semibold text-muted-foreground">{t('aiRules.addPersonalRule')}</div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t('aiRules.titleLabel')}</Label>
              <Input
                value={newPersonalRuleTitle}
                onChange={(e) => setNewPersonalRuleTitle(e.target.value)}
                placeholder={t('aiRules.titlePlaceholder')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t('aiRules.promptLabel')}</Label>
              <textarea
                value={newPersonalRulePrompt}
                onChange={(e) => setNewPersonalRulePrompt(e.target.value)}
                rows={2}
                placeholder={t('aiRules.promptPlaceholder')}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={!newPersonalRuleTitle.trim() || !newPersonalRulePrompt.trim() || postMyRuleMut.isPending}
                onClick={handleCreatePersonalRule}
                type="button"
              >
                <Plus className="h-4 w-4" />
                {t('aiRules.addPersonalRule')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
  // Which roles see the widget's environment switcher (empty = default: everyone except Client).
  const [editEnvSelectorRoleIds, setEditEnvSelectorRoleIds] = useState<number[]>([]);
  // Covers the WHOLE save sequence (project PATCH + environment batch), not just the PATCH.
  const [saving, setSaving] = useState(false);

  // Success flow is per-call (saveEdit chains the environment batch after the PATCH),
  // so only the shared error toast lives at the mutation level.
  const patchMut = usePatchApiAdminProjectsId({
    mutation: {
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

  // Every role this tenant can assign — options for the "environment switcher
  // visibility" multiselect (same endpoint the Roles admin page uses).
  const { data: roles = [] } = useGetApiAdminRoles({
    query: { enabled: envSectionActive },
  });
  const selectedRoleNames = roles
    .filter((r) => r.id != null && editEnvSelectorRoleIds.includes(r.id))
    .map((r) => r.name ?? '');

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

  // Originally-loaded per-row values — the baseline the dialog's Save compares each
  // draft against to decide which rows are dirty.
  const envLoaded: Record<number, EnvDraft> = {};
  for (const u of configuredEnvironments) {
    if (u.appEnvironmentId != null) {
      envLoaded[u.appEnvironmentId] = { url: u.url ?? '', isActive: u.isActive ?? true };
    }
  }

  // Draft state per EXISTING row (url + isActive together) — overlays the loaded
  // value with whatever the user is actively editing. Rows have no save button of
  // their own: the dialog's single Save persists every dirty row (see
  // saveEnvironmentChangesIfPending) together with the project's own fields.
  // Delete stays immediate.
  const [envOverrides, setEnvOverrides] = useState<Record<number, EnvDraft>>({});
  const envDrafts: Record<number, EnvDraft> = { ...envLoaded, ...envOverrides };

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

  const deleteEnvMut = useDeleteApiAdminProjectsIdAppUrlsEnvironmentId({
    mutation: {
      onSuccess: reloadAppUrls,
      onError,
    },
  });

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
  const [isAddingEnv, setIsAddingEnv] = useState(false);

  // AI Rules state
  const [aiRulesOpen, setAiRulesOpen] = useState(false);
  const [selectedAiProject, setSelectedAiProject] = useState<ProjectResponse | null>(null);
  const [showEditAiRules, setShowEditAiRules] = useState(false);

  function startAddEnvironment() {
    setNewEnvId(null);
    setNewEnvUrl('');
    setNewEnvActive(true);
    setShowAddEnvRow(true);
  }

  function cancelAddEnvironment() {
    if (isAddingEnv) return;
    setShowAddEnvRow(false);
    setNewEnvId(null);
    setNewEnvUrl('');
    setNewEnvActive(true);
  }

  async function confirmAddEnvironment() {
    const projectId = editProject?.id;
    const envId = newEnvId;
    const url = newEnvUrl.trim();
    if (!projectId || envId == null || !url) return;

    setIsAddingEnv(true);
    try {
      await putApiAdminProjectsIdAppUrlsEnvironmentId(projectId, envId, {
        url,
        isActive: newEnvActive,
      });
      setShowAddEnvRow(false);
      setNewEnvId(null);
      setNewEnvUrl('');
      setNewEnvActive(true);
      reloadAppUrls();
    } catch (e: unknown) {
      toast(extractMessage(e), 'error');
    } finally {
      setIsAddingEnv(false);
    }
  }

  // Rows whose draft differs from what is loaded — the ones the dialog's Save must persist.
  function dirtyEnvironmentIds(): number[] {
    return Object.entries(envOverrides)
      .filter(([id, draft]) => {
        const base = envLoaded[Number(id)];
        return !base || base.url !== draft.url || base.isActive !== draft.isActive;
      })
      .map(([id]) => Number(id));
  }

  // Persists every pending environment change — edited existing rows plus the "add
  // environment" row, if one is filled in — called from saveEdit() after the project's
  // own fields are patched, so the dialog's single Save button covers all of it. Rows
  // with a blank URL are skipped, not errors. Failures are surfaced individually (each
  // failure toasts on its own); the rest of the batch and the project's own field save
  // still go through, and a failed row's edit is kept so the user can retry it.
  async function saveEnvironmentChangesIfPending(onDone: () => void) {
    const projectId = editProject?.id;
    if (projectId == null) {
      onDone();
      return;
    }

    const requests: Promise<{ environmentId: number; ok: boolean }>[] = dirtyEnvironmentIds()
      .filter((envId) => (envDrafts[envId]?.url ?? '').trim() !== '')
      .map((envId) => {
        const draft = envDrafts[envId] ?? { url: '', isActive: true };
        return putApiAdminProjectsIdAppUrlsEnvironmentId(projectId, envId, {
          url: draft.url.trim(),
          isActive: draft.isActive,
        })
          .then(() => ({ environmentId: envId, ok: true }))
          .catch((e: unknown) => {
            toast(extractMessage(e), 'error');
            return { environmentId: envId, ok: false };
          });
      });

    const pendingNewEnvId = newEnvId;
    const newUrl = newEnvUrl.trim();
    if (showAddEnvRow && pendingNewEnvId != null && newUrl) {
      const addEnvId = pendingNewEnvId;
      requests.push(
        putApiAdminProjectsIdAppUrlsEnvironmentId(projectId, addEnvId, {
          url: newUrl,
          isActive: newEnvActive,
        })
          .then(() => ({ environmentId: addEnvId, ok: true }))
          .catch((e: unknown) => {
            toast(extractMessage(e), 'error');
            return { environmentId: addEnvId, ok: false };
          }),
      );
    }

    if (requests.length === 0) {
      onDone();
      return;
    }

    const results = await Promise.all(requests);
    const saved = new Set(results.filter((r) => r.ok).map((r) => r.environmentId));
    // Drop the drafts that landed; keep a failed row's edit so the user can retry it.
    setEnvOverrides((o) => {
      const rest = { ...o };
      for (const id of saved) delete rest[id];
      return rest;
    });
    if (saved.has(pendingNewEnvId ?? -1)) setShowAddEnvRow(false);
    reloadAppUrls();
    onDone();
  }

  function openEdit(project: ProjectResponse, readOnly = false) {
    setEditProject(project);
    setEditName(project.name ?? '');
    setEditAppUrl(project.appUrl ?? '');
    setEditReadOnly(readOnly);
    setEditPageContextCaptureEnabled(!!project.pageContextCaptureEnabled);
    setEditEnvSelectorRoleIds(project.environmentSelectorRoleIds ?? []);
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
    setSaving(true);
    const predefinedActions: PredefinedActionInput[] = editActions.map((row, idx) => ({
      id: row.id ?? null,
      text: row.text,
      prompt: row.prompt,
      sortOrder: idx,
      isActive: true,
    }));
    patchMut.mutate(
      {
        id: editProject.id!,
        data: {
          name: editName.trim(),
          appUrl: editAppUrl.trim(),
          predefinedActions: predefinedActions,
          pageContextCaptureEnabled: editPageContextCaptureEnabled,
          // Always sent as the full array (empty = the default visibility).
          environmentSelectorRoleIds: editEnvSelectorRoleIds,
          // Not editable from this dialog — passed through unchanged; only the
          // row-level bulk enable/disable action ever changes them.
          isActiveLocal: !!editProject.isActiveLocal,
          isActiveStaging: !!editProject.isActiveStaging,
          isActiveProduction: !!editProject.isActiveProduction,
        },
      },
      {
        // The single Save covers the environment drafts too — persist them right
        // after the project's own fields land, then close/reload/toast once.
        onSuccess: () => {
          saveEnvironmentChangesIfPending(() => {
            setSaving(false);
            setEditOpen(false);
            reload();
            toast(t('projects.saved'));
          });
        },
        onError: () => setSaving(false),
      },
    );
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
    items.push({
      label: t('aiRules.section'),
      icon: Brain,
      onClick: () => {
        setSelectedAiProject(project);
        setAiRulesOpen(true);
      },
    });
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
                              disabled={isAddingEnv}
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
                              disabled={isAddingEnv}
                            />
                          </td>
                          <td className="py-1 text-center">
                            <input
                              type="checkbox"
                              checked={newEnvActive}
                              onChange={(e) => setNewEnvActive(e.target.checked)}
                              aria-label={t('common.active')}
                              className="h-4 w-4 cursor-pointer"
                              disabled={isAddingEnv}
                            />
                          </td>
                          <td className="py-1 whitespace-nowrap text-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:text-primary"
                              type="button"
                              disabled={isAddingEnv || newEnvId == null || !newEnvUrl.trim()}
                              aria-label={t('common.add')}
                              onClick={confirmAddEnvironment}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              type="button"
                              disabled={isAddingEnv}
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

            {/* Environment switcher visibility — which roles can switch environments
                in the widget's toolbar. Empty selection = the default (everyone
                except Client). */}
            {!editReadOnly && (
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">{t('projects.envSelectorRoles')}</h4>
                <p className="text-xs text-muted-foreground">{t('projects.envSelectorRolesHint')}</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">
                        {selectedRoleNames.length > 0
                          ? selectedRoleNames.join(', ')
                          : t('projects.envSelectorRolesPlaceholder')}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-64 min-w-48 overflow-y-auto">
                    {roles.map((role) => (
                      <DropdownMenuCheckboxItem
                        key={role.id}
                        checked={role.id != null && editEnvSelectorRoleIds.includes(role.id)}
                        onCheckedChange={(checked) => {
                          if (role.id == null) return;
                          setEditEnvSelectorRoleIds((ids) =>
                            checked ? [...ids, role.id!] : ids.filter((id) => id !== role.id),
                          );
                        }}
                        // Keep the menu open so several roles can be toggled in one go.
                        onSelect={(e) => e.preventDefault()}
                      >
                        {role.name ?? ''}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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

            {/* AI Roles & Rules section */}
            {editProject && (
              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">{t('aiRules.section')}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditAiRules((prev) => !prev)}
                  >
                    {showEditAiRules ? t('common.cancel') : t('aiRules.section')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t('aiRules.projectHelp')}</p>
                {showEditAiRules && (
                  <div className="mt-3 border-t border-border pt-3">
                    <ProjectAiRulesContent
                      project={editProject}
                      canEditProject={!editReadOnly}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {editReadOnly && editProject && (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setSelectedAiProject(editProject);
                  setAiRulesOpen(true);
                }}
              >
                <Brain className="h-4 w-4 text-primary" />
                {t('aiRules.section')}
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t('common.cancel')}
            </Button>
            {!editReadOnly && (
              <Button
                disabled={!editName.trim() || patchMut.isPending || saving}
                onClick={saveEdit}
              >
                {t('common.save')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Standalone Project AI Rules Dialog */}
      <Dialog open={aiRulesOpen} onOpenChange={setAiRulesOpen}>
        <DialogContent className="max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              {t('aiRules.section')}: {selectedAiProject?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            {selectedAiProject && (
              <ProjectAiRulesContent
                project={selectedAiProject}
                canEditProject={selectedAiProject.canEdit}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiRulesOpen(false)}>
              {t('common.cancel')}
            </Button>
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
