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
//
// A row the viewer may not edit (a workspace rule inherited by a project) renders the SAME
// controls, locked — the prompt stays in a read-only textarea rather than collapsing into a
// paragraph, so the project dialog's table reads exactly like the one on /settings.
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table/DataTable';
import { cn } from '@/lib/utils';

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

/** Locked controls keep their shape but read as inert. */
const LOCKED = 'cursor-default bg-gutter text-muted-foreground';

export function AiRulesTable({
  rows,
  onFieldChange,
  onSave,
  onReset,
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
  /** Revert a dirty row's local edits back to the saved values — the Cancel button's
   *  handler for existing rows (comment #91). Drafts cancel internally. */
  onReset?: (id: number) => void;
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
            <Input
              className={cn('h-8 flex-1 px-2 text-[0.8rem]', rule.readOnly && LOCKED)}
              aria-label={t('aiRules.titleLabel')}
              value={rule.title}
              readOnly={rule.readOnly}
              onChange={(e) => onFieldChange(rule.id, 'title', e.target.value)}
            />
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
        return (
          <textarea
            aria-label={t('aiRules.promptLabel')}
            placeholder={rule.isDraft ? t('aiRules.promptPlaceholder') : undefined}
            value={rule.prompt}
            readOnly={rule.readOnly}
            onChange={(e) =>
              rule.isDraft
                ? updateDraft('prompt', e.target.value)
                : onFieldChange(rule.id, 'prompt', e.target.value)
            }
            rows={2}
            className={cn(
              'w-full min-w-[220px] resize-y rounded-md border border-input bg-background px-2 py-1.5 text-[0.8rem] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              rule.readOnly && LOCKED,
            )}
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
        // The create endpoint takes no isActive, so a draft is simply created active.
        const locked = rule.readOnly || rule.isDraft;
        return (
          <label
            className={cn(
              'flex items-center gap-1.5 text-[13px] font-medium',
              locked ? 'cursor-default text-muted-foreground' : 'cursor-pointer',
            )}
          >
            <input
              type="checkbox"
              checked={rule.isActive}
              disabled={locked}
              onChange={(e) => onFieldChange(rule.id, 'isActive', e.target.checked)}
              className={cn('h-4 w-4', locked ? 'cursor-default' : 'cursor-pointer')}
            />
            {t(rule.isActive ? 'common.active' : 'common.disabled')}
          </label>
        );
      },
    },
    {
      // Comment #91: Save / Cancel / Delete live directly in the last td — no kebab
      // submenu. Cancel appears only for a draft or a dirty row and acts as a reset;
      // read-only (inherited) rows stay action-less. Follow-up: icon-only buttons with
      // tooltips, so the trailing column stays narrow.
      id: 'actions',
      enableSorting: false,
      header: () => '',
      cell: ({ row }) => {
        const rule = row.original;
        if (rule.readOnly) return null;
        const incomplete = !rule.title.trim() || !rule.prompt.trim();
        return (
          <div className="flex items-center justify-end gap-1">
            {(rule.isDraft || rule.dirty) && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-8 w-8"
                aria-label={t('common.cancel')}
                title={t('common.cancel')}
                disabled={rule.saving}
                onClick={() => (rule.isDraft ? setDraft(null) : onReset?.(rule.id))}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-8 w-8"
              aria-label={t('common.save')}
              title={t('common.save')}
              disabled={rule.readOnly || !rule.dirty || rule.saving || incomplete}
              onClick={() => (rule.isDraft ? void saveDraft() : onSave(rule.id))}
            >
              <Save className="h-4 w-4" />
            </Button>
            {!rule.isDraft && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-8 w-8 text-destructive hover:text-destructive"
                aria-label={t('aiRules.delete')}
                title={t('aiRules.delete')}
                disabled={deleting}
                onClick={() => onDelete(rule.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* Follow-up on comment #75: no empty state here at all — the Add button below
          is the empty state. The table (with its EmptyState) only renders once there
          are rows (or a draft) to show. Comment #80: the wide inline table scrolls
          horizontally instead of overflowing its dialog/accordion container. */}
      {tableRows.length > 0 && (
        <div className="overflow-x-auto">
          <DataTable
            data={tableRows}
            columns={columns}
            emptyMessage={emptyMessage}
          />
        </div>
      )}
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
