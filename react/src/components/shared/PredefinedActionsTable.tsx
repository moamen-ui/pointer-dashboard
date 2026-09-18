import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table/DataTable';
import type { RowActionItem } from '@/components/shared/types';
import { cn } from '@/lib/utils';

export type PredefinedActionField = 'text' | 'prompt' | 'isActive';

export type PredefinedActionDraft = { text: string; prompt: string };

export type PredefinedActionRowModel = {
  id: number;
  text: string;
  prompt: string;
  isActive: boolean;
  dirty: boolean;
  saving?: boolean;
  readOnly?: boolean;
  isDraft?: boolean;
};

const DRAFT_ID = -1;
const LOCKED = 'cursor-default bg-gutter text-muted-foreground';

export function PredefinedActionsTable({
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
  rows: PredefinedActionRowModel[];
  onFieldChange: (id: number, field: PredefinedActionField, value: string | boolean) => void;
  onSave: (id: number) => void;
  onDelete: (id: number) => void;
  onCreate?: (draft: PredefinedActionDraft) => Promise<unknown>;
  addLabel?: string;
  creating?: boolean;
  deleting?: boolean;
  emptyMessage: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<PredefinedActionDraft | null>(null);

  function updateDraft(field: 'text' | 'prompt', value: string) {
    setDraft((prev) => ({ ...(prev ?? { text: '', prompt: '' }), [field]: value }));
  }

  async function saveDraft() {
    if (!draft || !onCreate) return;
    try {
      await onCreate({ text: draft.text.trim(), prompt: draft.prompt.trim() });
      setDraft(null);
    } catch {
      // The caller surfaces the error via toast
    }
  }

  const tableRows: PredefinedActionRowModel[] = draft
    ? [
        ...rows,
        {
          id: DRAFT_ID,
          text: draft.text,
          prompt: draft.prompt,
          isActive: true,
          dirty: true,
          saving: creating,
          isDraft: true,
        },
      ]
    : rows;

  const columns: ColumnDef<PredefinedActionRowModel>[] = [
    {
      id: 'text',
      enableSorting: false,
      header: t('predefined.text'),
      meta: { mobile: 'primary' },
      cell: ({ row }) => {
        const action = row.original;
        if (action.isDraft) {
          return (
            <Input
              autoFocus
              className="h-8 min-w-[180px] px-2 text-[0.8rem]"
              aria-label={t('predefined.text')}
              placeholder={t('predefined.text')}
              value={action.text}
              onChange={(e) => updateDraft('text', e.target.value)}
            />
          );
        }
        return (
          <Input
            className={cn('h-8 min-w-[180px] px-2 text-[0.8rem]', action.readOnly && LOCKED)}
            aria-label={t('predefined.text')}
            value={action.text}
            readOnly={action.readOnly}
            onChange={(e) => onFieldChange(action.id, 'text', e.target.value)}
          />
        );
      },
    },
    {
      id: 'prompt',
      enableSorting: false,
      header: t('predefined.prompt'),
      cell: ({ row }) => {
        const action = row.original;
        return (
          <textarea
            aria-label={t('predefined.prompt')}
            placeholder={action.isDraft ? t('predefined.prompt') : undefined}
            value={action.prompt}
            readOnly={action.readOnly}
            onChange={(e) =>
              action.isDraft
                ? updateDraft('prompt', e.target.value)
                : onFieldChange(action.id, 'prompt', e.target.value)
            }
            rows={2}
            className={cn(
              'w-full min-w-[220px] resize-y rounded-md border border-input bg-background px-2 py-1.5 text-[0.8rem] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              action.readOnly && LOCKED,
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
        const action = row.original;
        const locked = action.readOnly || action.isDraft;
        return (
          <label
            className={cn(
              'flex items-center gap-1.5 text-[13px] font-medium',
              locked ? 'cursor-default text-muted-foreground' : 'cursor-pointer',
            )}
          >
            <input
              type="checkbox"
              checked={action.isActive}
              disabled={locked}
              onChange={(e) => onFieldChange(action.id, 'isActive', e.target.checked)}
              className={cn('h-4 w-4', locked ? 'cursor-default' : 'cursor-pointer')}
            />
            {t(action.isActive ? 'common.active' : 'common.disabled')}
          </label>
        );
      },
    },
    {
      id: 'save',
      enableSorting: false,
      header: t('common.save'),
      cell: ({ row }) => {
        const action = row.original;
        const incomplete = !action.text.trim() || !action.prompt.trim();
        return (
          <Button
            size="sm"
            type="button"
            className="h-8"
            disabled={action.readOnly || !action.dirty || action.saving || incomplete}
            onClick={() => (action.isDraft ? void saveDraft() : onSave(action.id))}
          >
            <Save className="h-4 w-4" />
            {t('common.save')}
          </Button>
        );
      },
    },
  ];

  const actionsFor = (action: PredefinedActionRowModel): RowActionItem[] => {
    if (action.readOnly) return [];
    if (action.isDraft) {
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
        label: t('predefined.delete'),
        icon: Trash2,
        severity: 'danger',
        disabled: deleting,
        onClick: () => onDelete(action.id),
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
            onClick={() => setDraft({ text: '', prompt: '' })}
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
