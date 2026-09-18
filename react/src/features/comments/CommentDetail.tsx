// Comment detail — a wide dialog (mirrors ProjectsPage's edit-dialog pattern, the
// closest "row detail" convention already in this app; there is no Sheet/Drawer
// component here to reuse instead). Renders the full comment: body, element capture,
// applied/deploy state with verify, replies, and the status/visibility/delete actions.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetApiCommentsId,
  usePatchApiCommentsId,
  usePostApiCommentsIdVerify,
  usePostApiCommentsIdReplies,
  usePatchApiCommentsIdVisibility,
  useDeleteApiCommentsId,
  getGetApiCommentsIdQueryKey,
  CommentStatus,
  type CommentResponse,
} from '@moamen-ui/pointer-react';
import {
  Lock,
  Unlock,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  Rocket,
  Bot,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { extractMessage } from '@/lib/error';
import { formatRelativeTime } from '@/lib/format';
import { useStatusCatalog } from '@/lib/status-catalog';
import { badgeVariantForStatus, environmentLabelKey } from './comment-format';

const TEXTAREA_CLASS =
  'w-full resize-none rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

function commitShort(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : '';
}

export function CommentDetail({
  commentId,
  onClose,
  onChanged,
}: {
  commentId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isAdmin, user } = useAuth();
  const catalog = useStatusCatalog();

  const { data: comment, isLoading } = useGetApiCommentsId(commentId);

  const [replyBody, setReplyBody] = useState('');
  const [verifyNote, setVerifyNote] = useState('');
  const [showVerifyNote, setShowVerifyNote] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setReplyBody('');
    setVerifyNote('');
    setShowVerifyNote(false);
  }, [commentId]);

  function reloadDetail() {
    void qc.invalidateQueries({ queryKey: getGetApiCommentsIdQueryKey(commentId) });
    onChanged();
  }
  const onError = (e: unknown) => toast(extractMessage(e), 'error');

  const patchStatusMut = usePatchApiCommentsId({
    mutation: {
      onSuccess: () => {
        toast(t('comments.statusUpdated'));
        reloadDetail();
      },
      onError,
    },
  });

  const verifyMut = usePostApiCommentsIdVerify({
    mutation: {
      onSuccess: () => {
        toast(t('comments.verified'));
        setShowVerifyNote(false);
        setVerifyNote('');
        reloadDetail();
      },
      onError,
    },
  });

  const replyMut = usePostApiCommentsIdReplies({
    mutation: {
      onSuccess: () => {
        toast(t('comments.replyAdded'));
        setReplyBody('');
        reloadDetail();
      },
      onError,
    },
  });

  const visibilityMut = usePatchApiCommentsIdVisibility({
    mutation: {
      onSuccess: () => {
        toast(t('comments.visibilityUpdated'));
        reloadDetail();
      },
      onError,
    },
  });

  const deleteMut = useDeleteApiCommentsId({
    mutation: {
      onSuccess: () => {
        toast(t('comments.deleted'));
        setDeleteOpen(false);
        onChanged();
        onClose();
      },
      onError,
    },
  });

  const isAuthor = !!(user?.id && comment?.authorId && user.id === comment.authorId);
  const canDelete = isAdmin || isAuthor;
  // Verifying a fix is the original reporter's call (or an admin's, on their behalf) —
  // same "admin or author" rule the work order gives Delete.
  const canVerify = (isAdmin || isAuthor) && !!comment?.appliedAt && !comment?.verifiedAt;

  function submitReply() {
    const body = replyBody.trim();
    if (!body) return;
    replyMut.mutate({ id: commentId, data: { body } });
  }

  function submitVerify(ok: boolean) {
    if (ok) {
      verifyMut.mutate({ id: commentId, data: { ok: true } });
      return;
    }
    if (!showVerifyNote) {
      setShowVerifyNote(true);
      return;
    }
    verifyMut.mutate({ id: commentId, data: { ok: false, note: verifyNote.trim() || undefined } });
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('comments.detail.title')}</DialogTitle>
          </DialogHeader>

          {isLoading || !comment ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <CommentDetailBody
              comment={comment}
              canDelete={canDelete}
              canVerify={canVerify}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              onSubmitReply={submitReply}
              replyPending={replyMut.isPending}
              showVerifyNote={showVerifyNote}
              verifyNote={verifyNote}
              setVerifyNote={setVerifyNote}
              onVerify={submitVerify}
              verifyPending={verifyMut.isPending}
              onStatusChange={(status) => patchStatusMut.mutate({ id: commentId, data: { status } })}
              statusPending={patchStatusMut.isPending}
              isAuthor={isAuthor}
              onToggleVisibility={() =>
                visibilityMut.mutate({ id: commentId, data: { isPrivate: !comment.isPrivate } })
              }
              visibilityPending={visibilityMut.isPending}
              onDelete={() => setDeleteOpen(true)}
              catalog={catalog}
              t={t}
            />
          )}

          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        message={t('comments.detail.confirmDelete')}
        confirmLabel={t('common.delete')}
        confirmColor="warn"
        onConfirm={() => deleteMut.mutate({ id: commentId })}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}

type Translate = (key: string, opts?: Record<string, unknown>) => string;

function CommentDetailBody({
  comment,
  canDelete,
  canVerify,
  replyBody,
  setReplyBody,
  onSubmitReply,
  replyPending,
  showVerifyNote,
  verifyNote,
  setVerifyNote,
  onVerify,
  verifyPending,
  onStatusChange,
  statusPending,
  isAuthor,
  onToggleVisibility,
  visibilityPending,
  onDelete,
  catalog,
  t,
}: {
  comment: CommentResponse;
  canDelete: boolean;
  canVerify: boolean;
  replyBody: string;
  setReplyBody: (v: string) => void;
  onSubmitReply: () => void;
  replyPending: boolean;
  showVerifyNote: boolean;
  verifyNote: string;
  setVerifyNote: (v: string) => void;
  onVerify: (ok: boolean) => void;
  verifyPending: boolean;
  onStatusChange: (status: CommentStatus) => void;
  statusPending: boolean;
  isAuthor: boolean;
  onToggleVisibility: () => void;
  visibilityPending: boolean;
  onDelete: () => void;
  catalog: ReturnType<typeof useStatusCatalog>;
  t: Translate;
}) {
  const el = comment.element;
  const statusItem = catalog.items.find((s) => s.value === comment.status);

  return (
    <div className="flex flex-col gap-5 py-1">
      {/* Header meta */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={badgeVariantForStatus(comment.status)}>
            {statusItem ? catalog.displayLabel(statusItem) : '—'}
          </Badge>
          <Badge variant="neutral" hideGlyph>
            {t(environmentLabelKey(comment.environment))}
          </Badge>
          {comment.isPrivate && (
            <Badge variant="neutral" hideGlyph>
              <Lock className="h-3 w-3" aria-hidden="true" />
              {t('comments.privateTooltip')}
            </Badge>
          )}
          {comment.isBugReport && <Badge variant="neutral" hideGlyph>{t('comments.bugBadge')}</Badge>}
          {comment.hasPayloadFlag && (
            <Badge variant="destructive">{t('comments.flaggedBadge')}</Badge>
          )}
        </div>
        <p className="text-[14px] whitespace-pre-wrap">{comment.body || '—'}</p>
        <p className="text-[12px] text-muted-foreground">
          {t('comments.detail.by', { name: comment.authorName || '—' })}
          {' · '}
          {t('comments.detail.createdAt', { date: formatRelativeTime(t, comment.createdAt) })}
          {comment.editedAt && (
            <>
              {' · '}
              {t('comments.detail.editedAt', { date: formatRelativeTime(t, comment.editedAt) })}
            </>
          )}
        </p>
        {comment.hasPayloadFlag && comment.payloadFlags && comment.payloadFlags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-muted-foreground">{t('comments.detail.payloadFlags')}:</span>
            {comment.payloadFlags.map((f) => (
              <Badge key={f} variant="neutral" hideGlyph>
                {f}
              </Badge>
            ))}
          </div>
        )}
        {comment.pickedActionTexts && comment.pickedActionTexts.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-muted-foreground">
              {t('comments.detail.pickedActions')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {comment.pickedActionTexts.map((a, i) => (
                <Badge key={i} variant="neutral" hideGlyph>
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Element */}
      {el && (
        <div className="flex flex-col gap-2 border-t border-border-muted pt-4">
          <h3 className="text-[16px] font-semibold leading-6">{t('comments.detail.elementSection')}</h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-2">
            {el.route && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{t('comments.detail.route')}</dt>
                <dd className="font-mono break-all">{el.route}</dd>
              </div>
            )}
            {el.pageTitle && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{t('comments.detail.pageTitle')}</dt>
                <dd className="break-words">{el.pageTitle}</dd>
              </div>
            )}
            {el.pageUrl && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{t('comments.detail.pageUrl')}</dt>
                <dd>
                  <a
                    href={el.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline break-all"
                  >
                    {el.pageUrl}
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                  </a>
                </dd>
              </div>
            )}
            {el.selector && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{t('comments.detail.selector')}</dt>
                <dd className="font-mono break-all">{el.selector}</dd>
              </div>
            )}
            {el.sourcePath && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{t('comments.detail.sourcePath')}</dt>
                <dd className="font-mono break-all">{el.sourcePath}</dd>
              </div>
            )}
            {(el.deviceType || el.viewportWidth) && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{t('comments.detail.device')}</dt>
                <dd>
                  {el.deviceType ?? '—'}
                  {el.viewportWidth && el.viewportHeight
                    ? ` · ${el.viewportWidth}×${el.viewportHeight}`
                    : ''}
                </dd>
              </div>
            )}
          </dl>
          {el.screenshotUrl && (
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-muted-foreground">{t('comments.detail.screenshot')}</span>
              <a href={el.screenshotUrl} target="_blank" rel="noreferrer" className="inline-block w-fit">
                <img
                  src={el.screenshotUrl}
                  alt={t('comments.detail.screenshot')}
                  className="max-h-[160px] rounded-md border border-border"
                />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Applied / deploy / verify */}
      {comment.appliedAt && (
        <div className="flex flex-col gap-2 border-t border-border-muted pt-4">
          <h3 className="text-[16px] font-semibold leading-6">{t('comments.detail.appliedSection')}</h3>
          <p className="text-[13px] text-muted-foreground">
            {t('comments.detail.appliedBy', { name: comment.appliedByLabel || '—' })}
            {' · '}
            {t('comments.detail.appliedAt', { date: formatRelativeTime(t, comment.appliedAt) })}
          </p>
          {comment.commitUrl && (
            <a
              href={comment.commitUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 font-mono text-[13px] text-primary underline-offset-4 hover:underline"
            >
              {t('comments.detail.commit')}: {commitShort(comment.commitSha) || comment.commitUrl}
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            </a>
          )}
          <div className="flex items-center gap-2">
            {comment.deployedAt ? (
              <Badge variant="success" title={comment.deployedSha ? commitShort(comment.deployedSha) : undefined}>
                <Rocket className="h-3 w-3" aria-hidden="true" />
                {t('comments.detail.deployLiveSince', { date: formatRelativeTime(t, comment.deployedAt) })}
              </Badge>
            ) : (
              <Badge variant="neutral" hideGlyph>{t('comments.detail.deployNotYetLive')}</Badge>
            )}
          </div>

          {comment.verifiedAt ? (
            <p className="text-[13px] text-muted-foreground">
              {t('comments.detail.verifiedAt', { date: formatRelativeTime(t, comment.verifiedAt) })}
            </p>
          ) : canVerify ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={verifyPending}
                  onClick={() => onVerify(true)}
                >
                  <ThumbsUp className="h-4 w-4" />
                  {t('comments.detail.verifyWorks')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={verifyPending}
                  onClick={() => onVerify(false)}
                >
                  <ThumbsDown className="h-4 w-4" />
                  {t('comments.detail.verifyNotFixed')}
                </Button>
              </div>
              {showVerifyNote && (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={verifyNote}
                    onChange={(e) => setVerifyNote(e.target.value)}
                    rows={2}
                    placeholder={t('comments.detail.verifyNotePlaceholder')}
                    className={TEXTAREA_CLASS}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={verifyPending}
                      onClick={() => onVerify(false)}
                    >
                      {t('comments.detail.verifyNotFixed')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Replies */}
      <div className="flex flex-col gap-2 border-t border-border-muted pt-4">
        <h3 className="text-[16px] font-semibold leading-6">{t('comments.detail.repliesSection')}</h3>
        {comment.replies && comment.replies.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {comment.replies.map((r) => {
              // Automated (AI apply flow) replies are always read-only server-side — no edit/delete
              // affordance to hide here since replies never had one in this dashboard to begin with.
              if (r.isAi) {
                const attribution = [
                  r.aiTool,
                  r.aiModel,
                  r.authorName ? t('comments.detail.aiVia', { name: r.authorName }) : null,
                ].filter(Boolean) as string[];
                return (
                  <li key={r.id} className="rounded-md border border-border-muted bg-muted/40 p-2">
                    <p className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
                      <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('comments.detail.automatedReply')}
                    </p>
                    <p className="mt-1 text-[13px] whitespace-pre-wrap">{r.body}</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {attribution.length > 0 ? `${attribution.join(' · ')} · ` : ''}
                      {formatRelativeTime(t, r.createdAt)}
                    </p>
                  </li>
                );
              }
              return (
                <li key={r.id} className="rounded-md border border-border-muted p-2">
                  <p className="text-[13px] whitespace-pre-wrap">{r.body}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {r.authorName || '—'} · {formatRelativeTime(t, r.createdAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">{t('comments.detail.noReplies')}</p>
        )}
        <div className="flex flex-col gap-2">
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={2}
            placeholder={t('comments.detail.replyPlaceholder')}
            className={TEXTAREA_CLASS}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={!replyBody.trim() || replyPending}
              onClick={onSubmitReply}
            >
              {t('comments.detail.addReply')}
            </Button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 border-t border-border-muted pt-4">
        <h3 className="text-[16px] font-semibold leading-6">{t('comments.detail.statusSection')}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={comment.status != null ? String(comment.status) : undefined}
            onValueChange={(v) => onStatusChange(Number(v) as CommentStatus)}
          >
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {catalog.items.map((s) => (
                <SelectItem key={s.value} value={String(s.value)}>
                  {catalog.displayLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {statusPending && <span className="text-[12px] text-muted-foreground">{t('common.loading')}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAuthor && (
            <Button type="button" variant="outline" size="sm" disabled={visibilityPending} onClick={onToggleVisibility}>
              {comment.isPrivate ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {t(comment.isPrivate ? 'comments.detail.makePublic' : 'comments.detail.makePrivate')}
            </Button>
          )}
          {canDelete && (
            <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              {t('comments.detail.delete')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
