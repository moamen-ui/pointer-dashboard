// One editable AI-rule per row, rendered through the shared DataTable. Both places that
// manage rules (the workspace section on /settings and the project edit dialog) used to
// stack each rule in its own bordered block with a Save button that only appeared once the
// row went dirty — which read as "it saves while you type". The rules are a list of the
// same three fields, so they belong in a table, and every editable row carries an explicit,
// always-visible Save button (disabled until there is something to save).
//
// Adding a rule happens in the same table: "Add rule" appends an empty draft row typed in
// place, instead of the separate form block that used to sit underneath. The draft's Save
// calls `onCreate` and the row only disappears once that resolves, so a failed create keeps
// what was typed.
//
// Like `statuses`, this is the deliberate inline-edit-every-row escape hatch: every column
// renders a live control through the table's custom-cell mechanism rather than a
// display-only value. Delete stays in the row actions menu (last, as everywhere else).
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table/DataTable';
import type { RowActionItem } from '@/components/shared/types';

export type AiRuleField = 'title' | 'prompt' | 'isActive';

export type AiRuleDraft = { title: string; prompt: string };

export type AiRuleRowModel = {
  id: number;
  title: string;
  prompt: string;
  isActive: boolean;
  /** Local edits pending a save — drives the Save button's enabled state. */
  dirty: boolean;
  /** This row's PUT is in flight. */
  saving?: boolean;
  /** Inherited (workspace-wide) rules render read-only here — they are edited where they live. */
  readOnly?: boolean;
  /** Scope chip shown before the title (Workspace / Project / Personal). */
  badge?: { label: string; variant: BadgeProps['variant'] };
  /** The unsaved "new rule" row — saving it creates, discarding it just drops the row. */
  isDraft?: boolean;
};

/** Never collides with a real rule id, so the draft can ride along in the same row list. */
const DRAFT_ID = -1;

export function AiRulesTable({
  rows,
  onFieldChange,
  onSave,
  onDelete,
  onCreate,
  addLabel,
  creating = false,
  deleting = false,
  emptyMessage,
}: {
  rows: AiRuleRowModel[];
  onFieldChange: (id: number, field: AiRuleField, value: string | boolean) => void;
  onSave: (id: number) => void;
  onDelete: (id: number) => void;
  /** Resolve to clear the draft row; reject (the caller's mutation toasts) to keep it.
   *  Omitted when the viewer may not add rules here — the Add button then never renders. */
  onCreate?: (draft: AiRuleDraft) => Promise<unknown>;
  addLabel?: string;
  creating?: boolean;
  deleting?: boolean;
  emptyMessage: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<AiRuleDraft | null>(null);

  function updateDraft(field: 'title' | 'prompt', value: string) {
    setDraft((prev) => ({ ...(prev ?? { title: '', prompt: '' }), [field]: value }));
  }

  async function saveDraft() {
    if (!draft || !onCreate) return;
    try {
      await onCreate({ title: draft.title.trim(), prompt: draft.prompt.trim() });
      setDraft(null);
    } catch {
      // The caller's mutation surfaces the failure as a toast — keep what was typed.
    }
  }

  const tableRows: AiRuleRowModel[] = draft
    ? [
        ...rows,
        {
          id: DRAFT_ID,
          title: draft.title,
          prompt: draft.prompt,
          // New rules are created active (the create endpoint takes no isActive).
          isActive: true,
          dirty: true,
          saving: creating,
          isDraft: true,
        },
      ]
    : rows;

  const columns: ColumnDef<AiRuleRowModel>[] = [
    {
      id: 'title',
      enableSorting: false,
      header: t('aiRules.titleLabel'),
      meta: { mobile: 'primary' },
      cell: ({ row }) => {
        const rule = row.original;
        if (rule.isDraft) {
          return (
            <Input
              autoFocus
              className="h-8 min-w-[180px] px-2 text-[0.8rem]"
              aria-label={t('aiRules.titleLabel')}
              placeholder={t('aiRules.titlePlaceholder')}
              value={rule.title}
              onChange={(e) => updateDraft('title', e.target.value)}
            />
          );
        }
        return (
          <div className="flex min-w-[180px] items-center gap-2">
            {rule.badge && (
              <Badge variant={rule.badge.variant} hideGlyph>
                {rule.badge.label}
              </Badge>
            )}
            {rule.readOnly ? (
              <span className="text-sm font-medium">{rule.title}</span>
            ) : (
              <Input
                className="h-8 flex-1 px-2 text-[0.8rem]"
                aria-label={t('aiRules.titleLabel')}
                value={rule.title}
                onChange={(e) => onFieldChange(rule.id, 'title', e.target.value)}
              />
            )}
          </div>
        );
      },
    },
    {
      id: 'prompt',
      enableSorting: false,
      header: t('aiRules.promptLabel'),
      cell: ({ row }) => {
        const rule = row.original;
        if (rule.readOnly) {
          return (
            <p className="max-w-[46ch] whitespace-pre-wrap font-mono text-xs text-muted-foreground">
              {rule.prompt}
            </p>
          );
        }
        return (
          <textarea
            aria-label={t('aiRules.promptLabel')}
            placeholder={rule.isDraft ? t('aiRules.promptPlaceholder') : undefined}
            value={rule.prompt}
            onChange={(e) =>
              rule.isDraft
                ? updateDraft('prompt', e.target.value)
                : onFieldChange(rule.id, 'prompt', e.target.value)
            }
            rows={2}
            className="w-full min-w-[220px] resize-y rounded-md border border-input bg-background px-2 py-1.5 text-[0.8rem] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        );
      },
    },
    {
      id: 'isActive',
      enableSorting: false,
      header: t('common.active'),
      cell: ({ row }) => {
        const rule = row.original;
        if (rule.readOnly || rule.isDraft) {
          return (
            <Badge variant={rule.isActive ? 'success' : 'destructive'}>
              {t(rule.isActive ? 'common.active' : 'common.disabled')}
            </Badge>
          );
        }
        return (
          <label className="flex cursor-pointer items-center gap-1.5 text-[13px] font-medium">
            <input
              type="checkbox"
              checked={rule.isActive}
              onChange={(e) => onFieldChange(rule.id, 'isActive', e.target.checked)}
              className="h-4 w-4 cursor-pointer"
            />
            {t(rule.isActive ? 'common.active' : 'common.disabled')}
          </label>
        );
      },
    },
    {
      id: 'save',
      enableSorting: false,
      header: t('common.save'),
      cell: ({ row }) => {
        const rule = row.original;
        if (rule.readOnly) return null;
        const incomplete = !rule.title.trim() || !rule.prompt.trim();
        return (
          <Button
            size="sm"
            type="button"
            className="h-8"
            disabled={!rule.dirty || rule.saving || incomplete}
            onClick={() => (rule.isDraft ? void saveDraft() : onSave(rule.id))}
          >
            <Save className="h-4 w-4" />
            {t('common.save')}
          </Button>
        );
      },
    },
  ];

  const actionsFor = (rule: AiRuleRowModel): RowActionItem[] => {
    if (rule.readOnly) return [];
    if (rule.isDraft) {
      return [
        {
          label: t('common.cancel'),
          icon: Trash2,
          severity: 'danger',
          disabled: creating,
          onClick: () => setDraft(null),
        },
      ];
    }
    return [
      {
        label: t('aiRules.delete'),
        icon: Trash2,
        severity: 'danger',
        disabled: deleting,
        onClick: () => onDelete(rule.id),
      },
    ];
  };

  return (
    <div className="flex flex-col gap-2">
      <DataTable
        data={tableRows}
        columns={columns}
        actions={actionsFor}
        actionsAriaLabel={t('common.actions')}
        emptyMessage={emptyMessage}
      />
      {onCreate && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={!!draft}
            onClick={() => setDraft({ title: '', prompt: '' })}
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
