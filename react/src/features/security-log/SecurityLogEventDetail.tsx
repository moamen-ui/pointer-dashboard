// Row detail dialog — the "expandable before/after JSON diff" from DB-12 §11.1, opened
// via the table's onRowClick (mirrors features/comments/CommentDetail's dialog-on-click
// pattern; there is no single-event GET endpoint, so this renders the already-fetched
// row instead of issuing its own request).
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuditEventDto } from '@moamen-ui/pointer-react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import {
  actionLabel,
  actorKindBadgeVariant,
  actorKindLabel,
  targetTypeLabel,
} from './security-log-format';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="w-32 shrink-0 text-[12px] font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-[14px] text-foreground break-words">{children}</span>
    </div>
  );
}

/** Union of every key present in either snapshot, in first-seen order — so an added or
 *  removed field still gets its own diff line (blank side rendered as "—"). */
function diffKeys(before: Record<string, string> | null | undefined, after: Record<string, string> | null | undefined): string[] {
  const keys: string[] = [];
  for (const k of Object.keys(before ?? {})) if (!keys.includes(k)) keys.push(k);
  for (const k of Object.keys(after ?? {})) if (!keys.includes(k)) keys.push(k);
  return keys;
}

export function SecurityLogEventDetail({
  event,
  showOperatorColumns,
  onClose,
}: {
  event: AuditEventDto;
  /** Super-admin `/all` view only — shows workspace id, IP hash and user agent. */
  showOperatorColumns: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();

  function copy(value: string | null | undefined) {
    if (!value) return;
    navigator.clipboard?.writeText(value).then(
      () => toast(t('common.copied'), 'success'),
      () => toast(t('common.copyFailed'), 'error'),
    );
  }

  const keys = diffKeys(event.before, event.after);
  const occurredAt = event.occurredAt ? new Date(event.occurredAt) : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{actionLabel(t, event.action)}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Row label={t('securityLog.time')}>
            {occurredAt && !Number.isNaN(occurredAt.getTime()) ? occurredAt.toLocaleString() : '—'}
          </Row>

          <Row label={t('securityLog.actor')}>
            <span className="inline-flex items-center gap-2">
              {event.actorName ?? t('securityLog.systemActor')}
              <Badge variant={actorKindBadgeVariant()} hideGlyph>
                {actorKindLabel(t, event.actorKind)}
              </Badge>
            </span>
          </Row>

          <Row label={t('securityLog.action')}>
            <code className="font-mono text-[13px] text-muted-foreground">{event.action ?? '—'}</code>
          </Row>

          <Row label={t('securityLog.target')}>
            {event.targetType ? (
              <span>
                {targetTypeLabel(t, event.targetType)}{' '}
                {event.targetId && (
                  <code className="font-mono text-[13px] text-muted-foreground break-all">
                    {event.targetId}
                  </code>
                )}
              </span>
            ) : (
              '—'
            )}
          </Row>

          {showOperatorColumns && (
            <Row label={t('securityLog.workspace')}>
              {event.workspaceId ? (
                <code className="font-mono text-[13px] text-muted-foreground break-all">
                  {event.workspaceId}
                </code>
              ) : (
                t('securityLog.systemWide')
              )}
            </Row>
          )}

          <Row label={t('securityLog.requestId')}>
            {event.requestId ? (
              <span className="inline-flex items-center gap-1">
                <code className="font-mono text-[13px] break-all">{event.requestId}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => copy(event.requestId)}
                  title={t('common.copyLink')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </span>
            ) : (
              '—'
            )}
          </Row>

          {showOperatorColumns && (
            <>
              <Row label={t('securityLog.ipHash')}>
                <code className="font-mono text-[13px] break-all">{event.ipHash ?? '—'}</code>
              </Row>
              <Row label={t('securityLog.userAgent')}>
                <span className="text-[13px] text-muted-foreground break-words">
                  {event.userAgent ?? '—'}
                </span>
              </Row>
            </>
          )}

          {/* Before/after diff — DESIGN.md's diff vocabulary: removed value struck through
              muted, added value in the state-completed hue, unchanged fields skipped. */}
          <div className="flex flex-col gap-2 border-t border-border-muted pt-3">
            <span className="text-[12px] font-medium text-muted-foreground">
              {t('securityLog.changes')}
            </span>
            {keys.length === 0 ? (
              <p className="text-[13px] text-faint-foreground">{t('securityLog.noChanges')}</p>
            ) : (
              <div className="flex flex-col gap-1.5 rounded-md border border-border bg-gutter p-3">
                {keys.map((key) => {
                  const beforeVal = event.before?.[key];
                  const afterVal = event.after?.[key];
                  const unchanged = beforeVal === afterVal;
                  return (
                    <div key={key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]">
                      <span className="font-medium text-foreground">{key}</span>
                      {unchanged ? (
                        <code className="font-mono text-muted-foreground break-all">
                          {beforeVal ?? '—'}
                        </code>
                      ) : (
                        <>
                          {beforeVal != null && (
                            <code className="font-mono text-state-danger line-through break-all">
                              {beforeVal}
                            </code>
                          )}
                          <code className="font-mono text-state-completed break-all">
                            {afterVal ?? t('securityLog.removed')}
                          </code>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
