// One editable AI-rule per row, rendered through the shared DataTable. Both places that
// manage rules (the workspace section on /settings and the project edit dialog) used to
// stack each rule in its own bordered block with a Save button that only appeared once the
// row went dirty — which read as "it saves while you type". The rules are a list of the
// same three fields, so they belong in a table, and every editable row carries an explicit,
// always-visible Save button (disabled until there is something to save).
//
// Like `statuses`, this is the deliberate inline-edit-every-row escape hatch: every column
// renders a live control through the table's custom-cell mechanism rather than a
// display-only value. Delete stays in the row actions menu (last, as everywhere else).
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { Save, Trash2 } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table/DataTable';
import type { RowActionItem } from '@/components/shared/types';

export type AiRuleField = 'title' | 'prompt' | 'isActive';

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
};

export function AiRulesTable({
  rows,
  onFieldChange,
  onSave,
  onDelete,
  deleting = false,
  emptyMessage,
}: {
  rows: AiRuleRowModel[];
  onFieldChange: (id: number, field: AiRuleField, value: string | boolean) => void;
  onSave: (id: number) => void;
  onDelete: (id: number) => void;
  deleting?: boolean;
  emptyMessage: string;
}) {
  const { t } = useTranslation();

  const columns: ColumnDef<AiRuleRowModel>[] = [
    {
      id: 'title',
      enableSorting: false,
      header: t('aiRules.titleLabel'),
      meta: { mobile: 'primary' },
      cell: ({ row }) => {
        const rule = row.original;
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
            value={rule.prompt}
            onChange={(e) => onFieldChange(rule.id, 'prompt', e.target.value)}
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
        if (rule.readOnly) {
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
        return (
          <Button
            size="sm"
            type="button"
            className="h-8"
            disabled={!rule.dirty || rule.saving || !rule.title.trim() || !rule.prompt.trim()}
            onClick={() => onSave(rule.id)}
          >
            <Save className="h-4 w-4" />
            {t('common.save')}
          </Button>
        );
      },
    },
  ];

  const actionsFor = (rule: AiRuleRowModel): RowActionItem[] =>
    rule.readOnly
      ? []
      : [
          {
            label: t('aiRules.delete'),
            icon: Trash2,
            severity: 'danger',
            disabled: deleting,
            onClick: () => onDelete(rule.id),
          },
        ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      actions={actionsFor}
      actionsAriaLabel={t('common.actions')}
      emptyMessage={emptyMessage}
    />
  );
}
