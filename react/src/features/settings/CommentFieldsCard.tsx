// Workspace comment fields card — lets a workspace admin define up to ten extra fields a
// comment can carry (e.g. a Jira ticket URL). Same gate and mutation pattern as AiRulesCard:
// PUT always replaces the whole list (there is no per-field create/update endpoint), so every
// mutation here (toggle/reorder/edit/delete/add) reads the current server list, edits it in
// memory, and PUTs the full array back with `sortOrder` re-normalised to the array index.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiAdminWorkspaceCommentFields,
  usePutApiAdminWorkspaceCommentFields,
  getGetApiAdminWorkspaceCommentFieldsQueryKey,
  CommentFieldType,
  type CommentFieldDefinitionDto,
} from '@moamen-ui/pointer-react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { AccordionSection } from '@/components/ui/accordion-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/shared/FormField';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';

const TYPE_TEXT = CommentFieldType.NUMBER_1;
const TYPE_URL = CommentFieldType.NUMBER_2;
const TYPE_SELECT = CommentFieldType.NUMBER_3;

// Mirrors A1 exactly (docs/roadmap/execution/R4-01-comment-fields.md § A1) so an obviously
// invalid definition never reaches the server — the API re-validates regardless.
const KEY_PATTERN = /^[a-z][a-z0-9_]{1,31}$/;
const LABEL_PATTERN = /^[\p{L}\p{N}\p{M}&().,'’/ -]{1,40}$/u;
const HOST_PATTERN = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/;
const TOOL_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MAX_FIELDS = 10;

/** Auto-slug: lower-case, non `[a-z0-9]` → `_`, collapse repeats, trim, cut to 32. */
function slugifyFieldKey(label: string): string {
  let key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  if (key && !/^[a-z]/.test(key)) key = `f_${key}`;
  return key.slice(0, 32).replace(/_+$/g, '');
}

function sortedDefs(fields: CommentFieldDefinitionDto[] | null | undefined): CommentFieldDefinitionDto[] {
  return [...(fields ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function withSortOrder(list: CommentFieldDefinitionDto[]): CommentFieldDefinitionDto[] {
  return list.map((d, i) => ({ ...d, sortOrder: i }));
}

type DraftState = {
  editingKey: string | null; // null while adding a new field
  label: string;
  key: string;
  type: CommentFieldType;
  options: string; // textarea, one per line
  hosts: string; // comma-separated
  tool: string;
  hint: string;
  enabled: boolean;
};

function blankDraft(): DraftState {
  return {
    editingKey: null,
    label: '',
    key: '',
    type: TYPE_TEXT,
    options: '',
    hosts: '',
    tool: '',
    hint: '',
    enabled: true,
  };
}

function draftFromDef(def: CommentFieldDefinitionDto): DraftState {
  return {
    editingKey: def.key ?? '',
    label: def.label ?? '',
    key: def.key ?? '',
    type: def.type ?? TYPE_TEXT,
    options: (def.options ?? []).join('\n'),
    hosts: (def.allowedHosts ?? []).join(', '),
    tool: def.suggestedTool ?? '',
    hint: def.hint ?? '',
    enabled: def.enabled ?? true,
  };
}

export function CommentFieldsCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useGetApiAdminWorkspaceCommentFields();
  const defs = sortedDefs(data?.fields);

  const reload = () =>
    void qc.invalidateQueries({ queryKey: getGetApiAdminWorkspaceCommentFieldsQueryKey() });

  const putMut = usePutApiAdminWorkspaceCommentFields({
    mutation: {
      onSuccess: () => {
        toast(t('commentFields.saved'));
        reload();
      },
      onError: (e: unknown) => toast(extractMessage(e), 'error'),
    },
  });

  function putList(list: CommentFieldDefinitionDto[], onDone?: () => void) {
    putMut.mutate({ data: { fields: withSortOrder(list) } }, { onSuccess: onDone });
  }

  function toggleEnabled(def: CommentFieldDefinitionDto) {
    putList(defs.map((d) => (d.key === def.key ? { ...d, enabled: !d.enabled } : d)));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= defs.length) return;
    const next = [...defs];
    [next[index], next[target]] = [next[target], next[index]];
    putList(next);
  }

  // ---- Add/edit dialog ----
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(blankDraft());
  const [touched, setTouched] = useState(false);

  function openAdd() {
    setDraft(blankDraft());
    setTouched(false);
    setDialogOpen(true);
  }

  function openEdit(def: CommentFieldDefinitionDto) {
    setDraft(draftFromDef(def));
    setTouched(false);
    setDialogOpen(true);
  }

  function updateLabel(value: string) {
    setDraft((prev) => ({
      ...prev,
      label: value,
      // Key is auto-derived from the label only while creating; it never changes on edit.
      key: prev.editingKey === null ? slugifyFieldKey(value) : prev.key,
    }));
  }

  const labelTrimmed = draft.label.trim();
  const toolTrimmed = draft.tool.trim();
  const hintTrimmed = draft.hint.trim();
  const optionsList = draft.options
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean);
  const hostsList = draft.hosts
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const otherDefs = defs.filter((d) => d.key !== draft.editingKey);

  const labelError = !labelTrimmed
    ? t('common.fieldRequired')
    : !LABEL_PATTERN.test(labelTrimmed)
      ? t('commentFields.labelInvalid')
      : null;
  const keyError = !KEY_PATTERN.test(draft.key) ? t('commentFields.keyRule') : null;
  const duplicateKeyError =
    !keyError && otherDefs.some((d) => d.key === draft.key) ? t('commentFields.duplicateKey') : null;
  const tooManyError =
    draft.editingKey === null && defs.length >= MAX_FIELDS ? t('commentFields.tooManyFields') : null;
  const optionsError =
    draft.type === TYPE_SELECT &&
    (optionsList.length < 1 ||
      optionsList.length > 20 ||
      optionsList.some((o) => o.length > 40) ||
      new Set(optionsList).size !== optionsList.length)
      ? t('commentFields.optionsInvalid')
      : null;
  const hostsError =
    draft.type === TYPE_URL && (hostsList.length > 10 || hostsList.some((h) => !HOST_PATTERN.test(h)))
      ? t('commentFields.hostsInvalid')
      : null;
  const toolError =
    toolTrimmed && (toolTrimmed.length > 40 || !TOOL_PATTERN.test(toolTrimmed))
      ? t('commentFields.toolInvalid')
      : null;
  const hintError = hintTrimmed.length > 120 ? t('commentFields.hintTooLong') : null;

  const dialogError =
    labelError ||
    keyError ||
    duplicateKeyError ||
    tooManyError ||
    optionsError ||
    hostsError ||
    toolError ||
    hintError;

  function saveDraft() {
    setTouched(true);
    if (dialogError) return;

    const nextDef: CommentFieldDefinitionDto = {
      key: draft.key,
      label: labelTrimmed,
      type: draft.type,
      options: draft.type === TYPE_SELECT ? optionsList : [],
      allowedHosts: draft.type === TYPE_URL ? hostsList : [],
      suggestedTool: toolTrimmed || null,
      hint: hintTrimmed || null,
      enabled: draft.enabled,
      sortOrder: 0,
    };

    const nextList =
      draft.editingKey === null
        ? [...defs, nextDef]
        : defs.map((d) => (d.key === draft.editingKey ? nextDef : d));

    putList(nextList, () => setDialogOpen(false));
  }

  // ---- Delete confirmation ----
  const [deleteTarget, setDeleteTarget] = useState<CommentFieldDefinitionDto | null>(null);

  function confirmDelete() {
    if (!deleteTarget) return;
    putList(
      defs.filter((d) => d.key !== deleteTarget.key),
      () => setDeleteTarget(null),
    );
  }

  function typeLabel(type: CommentFieldType | undefined): string {
    if (type === TYPE_URL) return t('commentFields.typeUrl');
    if (type === TYPE_SELECT) return t('commentFields.typeSelect');
    return t('commentFields.typeText');
  }

  const capturedLabels = [
    t('comments.detail.pageUrl'),
    t('comments.detail.route'),
    t('comments.detail.selector'),
    t('comments.detail.screenshot'),
  ];

  return (
    <AccordionSection title={t('commentFields.section')}>
      <div className="flex flex-col gap-4">
        <p className="text-[12px] text-muted-foreground max-w-[72ch]">{t('commentFields.intro')}</p>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-foreground">{t('commentFields.captured')}</span>
          <p className="text-[12px] text-muted-foreground max-w-[72ch]">{t('commentFields.capturedNote')}</p>
          <div className="flex flex-wrap gap-1.5">
            {capturedLabels.map((label) => (
              <Badge key={label} variant="neutral" hideGlyph>
                {label}
              </Badge>
            ))}
          </div>
        </div>

        {isLoading && defs.length === 0 && (
          <p className="text-[12px] text-muted-foreground">
            {t('common.loading', { defaultValue: 'Loading…' })}
          </p>
        )}

        {!isLoading && defs.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">{t('commentFields.empty')}</p>
        ) : (
          defs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('commentFields.label')}</TableHead>
                  <TableHead>{t('commentFields.key')}</TableHead>
                  <TableHead>{t('commentFields.type')}</TableHead>
                  <TableHead>{t('commentFields.enabled')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {defs.map((def, i) => (
                  <TableRow key={def.key}>
                    <TableCell className="text-[14px] font-medium">{def.label}</TableCell>
                    <TableCell>
                      <code className="rounded bg-gutter px-1.5 py-0.5 text-[12px] font-mono">
                        {def.key}
                      </code>
                    </TableCell>
                    <TableCell className="text-[14px] text-muted-foreground">
                      {typeLabel(def.type)}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={!!def.enabled}
                        onCheckedChange={() => toggleEnabled(def)}
                        disabled={putMut.isPending}
                        aria-label={t('commentFields.enabled')}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          disabled={i === 0 || putMut.isPending}
                          onClick={() => move(i, -1)}
                          aria-label={t('commentFields.moveUp')}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          disabled={i === defs.length - 1 || putMut.isPending}
                          onClick={() => move(i, 1)}
                          aria-label={t('commentFields.moveDown')}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => openEdit(def)}
                          aria-label={t('commentFields.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => setDeleteTarget(def)}
                          aria-label={t('commentFields.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}

        <div className="flex justify-end">
          <Button size="sm" variant="outline" type="button" disabled={putMut.isPending} onClick={openAdd}>
            <Plus className="h-4 w-4" />
            {t('commentFields.add')}
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {draft.editingKey === null ? t('commentFields.add') : t('commentFields.edit')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <FormField
              label={t('commentFields.label')}
              htmlFor="cf-label"
              error={touched && labelError ? labelError : undefined}
            >
              <Input
                id="cf-label"
                value={draft.label}
                maxLength={40}
                autoFocus
                onChange={(e) => updateLabel(e.target.value)}
              />
            </FormField>

            <FormField
              label={t('commentFields.key')}
              htmlFor="cf-key"
              hint={t('commentFields.keyRule')}
              error={touched && (keyError || duplicateKeyError) ? (keyError ?? duplicateKeyError ?? undefined) : undefined}
            >
              <Input
                id="cf-key"
                value={draft.key}
                readOnly
                className="cursor-default bg-gutter-strong font-mono text-muted-foreground"
              />
            </FormField>

            <FormField label={t('commentFields.type')} htmlFor="cf-type">
              <Select
                value={String(draft.type)}
                onValueChange={(v) => setDraft((prev) => ({ ...prev, type: Number(v) as CommentFieldType }))}
              >
                <SelectTrigger id="cf-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={String(TYPE_TEXT)}>{t('commentFields.typeText')}</SelectItem>
                  <SelectItem value={String(TYPE_URL)}>{t('commentFields.typeUrl')}</SelectItem>
                  <SelectItem value={String(TYPE_SELECT)}>{t('commentFields.typeSelect')}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {draft.type === TYPE_SELECT && (
              <FormField
                label={t('commentFields.options')}
                htmlFor="cf-options"
                hint={t('commentFields.optionsHelp')}
                error={touched && optionsError ? optionsError : undefined}
              >
                <textarea
                  id="cf-options"
                  rows={4}
                  value={draft.options}
                  onChange={(e) => setDraft((prev) => ({ ...prev, options: e.target.value }))}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </FormField>
            )}

            {draft.type === TYPE_URL && (
              <FormField
                label={t('commentFields.allowedHosts')}
                htmlFor="cf-hosts"
                hint={t('commentFields.allowedHostsHelp')}
                error={touched && hostsError ? hostsError : undefined}
              >
                <Input
                  id="cf-hosts"
                  value={draft.hosts}
                  placeholder="*.atlassian.net"
                  onChange={(e) => setDraft((prev) => ({ ...prev, hosts: e.target.value }))}
                />
              </FormField>
            )}

            <FormField
              label={t('commentFields.suggestedTool')}
              htmlFor="cf-tool"
              hint={t('commentFields.suggestedToolHelp')}
              error={touched && toolError ? toolError : undefined}
            >
              <Input
                id="cf-tool"
                value={draft.tool}
                maxLength={40}
                placeholder="atlassian"
                onChange={(e) => setDraft((prev) => ({ ...prev, tool: e.target.value }))}
              />
            </FormField>

            <FormField
              label={t('commentFields.hint')}
              htmlFor="cf-hint"
              error={touched && hintError ? hintError : undefined}
            >
              <Input
                id="cf-hint"
                value={draft.hint}
                maxLength={120}
                onChange={(e) => setDraft((prev) => ({ ...prev, hint: e.target.value }))}
              />
            </FormField>

            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="cf-enabled" className="text-[13px] font-medium text-foreground">
                {t('commentFields.enabled')}
              </Label>
              <Switch
                id="cf-enabled"
                checked={draft.enabled}
                onCheckedChange={(v) => setDraft((prev) => ({ ...prev, enabled: v }))}
              />
            </div>

            {touched && tooManyError && (
              <p className="text-[12px] text-state-danger">{tooManyError}</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={putMut.isPending} onClick={saveDraft}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        message={t('commentFields.confirmDelete', { label: deleteTarget?.label ?? '' })}
        confirmLabel={t('commentFields.delete')}
        confirmColor="warn"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AccordionSection>
  );
}
