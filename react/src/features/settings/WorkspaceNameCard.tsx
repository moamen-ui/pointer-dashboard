// Workspace name card (DB-03b) — lets a workspace admin set the workspace's own name (distinct
// from the admin's display name), shown in the header label (Shell.tsx) and the anonymous invite
// preview. Same card chrome and mutation pattern as CommentFieldsCard: one GET query, one PUT
// mutation, toast + reload on success. Unlike CommentFieldsCard's full-list PUT, this mutates a
// single field, so the "reload" on success invalidates both this card's own query key AND
// auth/me's — the header reads `me.tenantName`, so it would otherwise keep showing the old name
// until a hard reload.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiAdminWorkspace,
  usePutApiAdminWorkspaceName,
  getGetApiAdminWorkspaceQueryKey,
  getGetApiAuthMeQueryKey,
} from '@moamen-ui/pointer-react';
import { AccordionSection } from '@/components/ui/accordion-section';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/shared/FormField';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { extractMessage } from '@/lib/error';

const MAX_NAME_LENGTH = 120;

export function WorkspaceNameCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useGetApiAdminWorkspace();

  // Local draft, kept in sync with the server value until the admin starts typing — mirrors
  // CommentFieldsCard's draft pattern but for a single field instead of a list.
  const [name, setName] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setName(data?.name ?? '');
  }, [data, dirty]);

  const reload = () => {
    void qc.invalidateQueries({ queryKey: getGetApiAdminWorkspaceQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetApiAuthMeQueryKey() });
  };

  const putMut = usePutApiAdminWorkspaceName({
    mutation: {
      onSuccess: () => {
        toast(t('workspaceName.saved'));
        setDirty(false);
        reload();
      },
    },
  });

  const trimmed = name.trim();
  const currentTrimmed = (data?.name ?? '').trim();
  const saveDisabled =
    isLoading || !trimmed || trimmed === currentTrimmed || trimmed.length > MAX_NAME_LENGTH || putMut.isPending;

  function save() {
    if (saveDisabled) return;
    putMut.mutate({ data: { name: trimmed } });
  }

  const serverError = putMut.isError ? extractMessage(putMut.error) : undefined;

  return (
    <AccordionSection title={t('workspaceName.title')}>
      <div className="flex flex-col gap-4">
        {data?.isPlaceholderName && (
          <p className="text-[12px] text-muted-foreground max-w-[72ch]">
            {t('workspaceName.placeholderHint')}
          </p>
        )}

        <FormField label={t('workspaceName.label')} htmlFor="workspace-name" error={serverError}>
          <Input
            id="workspace-name"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            disabled={isLoading}
            onChange={(e) => {
              setDirty(true);
              setName(e.target.value);
            }}
          />
        </FormField>

        <div className="flex justify-end">
          <Button size="sm" type="button" disabled={saveDisabled} onClick={save}>
            {t('workspaceName.save')}
          </Button>
        </div>
      </div>
    </AccordionSection>
  );
}
