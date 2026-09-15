<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiCommentsId,
  usePatchApiCommentsId,
  usePostApiCommentsIdVerify,
  usePostApiCommentsIdReplies,
  usePatchApiCommentsIdVisibility,
  useDeleteApiCommentsId,
  getGetApiCommentsIdQueryKey,
  getGetApiProjectsKeyCommentsQueryKey,
  CommentStatus,
} from '@moamen-ui/pointer-vue';
import {
  ExternalLink,
  Lock,
  LockOpen,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  Smartphone,
  Monitor,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { extractMessage } from '@/lib/error';
import { formatRelativeTime } from '@/lib/relativeTime';
import { commentStatusLabel, commentStatusVariant, commentEnvironmentLabel, shortSha } from '@/lib/commentLabels';
import { confirm } from '@/composables/useConfirm';
import { toast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';

const props = defineProps<{
  open: boolean;
  id: number | null;
  /** The project key the list is scoped to — used only to invalidate the list query. */
  projectKey: string;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'deleted'): void;
}>();

const { t } = useI18n();
const { user, isAdmin } = useAuth();
const queryClient = useQueryClient();

const idOrZero = computed(() => props.id ?? 0);
const { data: comment, isLoading } = useGetApiCommentsId(idOrZero, {
  query: { enabled: () => props.open && props.id != null },
});

function close() {
  emit('update:open', false);
}

function reloadAll() {
  if (props.id != null) {
    void queryClient.invalidateQueries({ queryKey: getGetApiCommentsIdQueryKey(props.id) });
  }
  void queryClient.invalidateQueries({ queryKey: getGetApiProjectsKeyCommentsQueryKey(props.projectKey) });
}

function fail(e: unknown) {
  toast(extractMessage(e), 'danger');
}

// ── Permissions (mirrors the API's own gates — hides controls that would 403) ──
const isAuthor = computed(() => !!comment.value && !!user.value && comment.value.authorId === user.value.id);
const isQuickAccess = computed(() => !!user.value?.isQuickAccess);
const canManageStatus = computed(() => !isQuickAccess.value);
const canVerify = computed(
  () => comment.value?.status === CommentStatus.NUMBER_3 && (isAdmin.value || isAuthor.value),
);
const canDelete = computed(() => isAdmin.value || isAuthor.value);
const canToggleVisibility = computed(() => isAuthor.value);

// ── Labels ──────────────────────────────────────────────────────────────
function statusLabel(status: number | undefined): string {
  return commentStatusLabel(t, status);
}
function statusVariant(status: number | undefined) {
  return commentStatusVariant(status);
}
function envLabel(env: number | undefined): string {
  return commentEnvironmentLabel(t, env);
}
function deviceLabel(): string {
  const el = comment.value?.element;
  const dims = el?.viewportWidth && el?.viewportHeight ? `${el.viewportWidth}×${el.viewportHeight}` : null;
  const parts = [el?.deviceType, dims].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

// ── Status change ─────────────────────────────────────────────────────
const updateStatus = usePatchApiCommentsId();
const savingStatus = ref(false);

async function changeStatus(value: unknown) {
  const status = Number(value) as (typeof CommentStatus)[keyof typeof CommentStatus];
  if (!props.id || !status || status === comment.value?.status) return;
  savingStatus.value = true;
  try {
    await updateStatus.mutateAsync({ id: props.id, data: { status } });
    toast(t('comments.updated'), 'success');
    reloadAll();
  } catch (e) {
    fail(e);
  } finally {
    savingStatus.value = false;
  }
}

// ── Verify (👍 / 👎) ────────────────────────────────────────────────────
const verifyMutation = usePostApiCommentsIdVerify();
const showNotFixedNote = ref(false);
const notFixedNote = ref('');
const verifying = ref(false);

async function verifyOk() {
  if (!props.id) return;
  verifying.value = true;
  try {
    await verifyMutation.mutateAsync({ id: props.id, data: { ok: true } });
    toast(t('comments.verified'), 'success');
    reloadAll();
  } catch (e) {
    fail(e);
  } finally {
    verifying.value = false;
  }
}

function openNotFixed() {
  notFixedNote.value = '';
  showNotFixedNote.value = true;
}

async function submitNotFixed() {
  if (!props.id || !notFixedNote.value.trim()) return;
  verifying.value = true;
  try {
    await verifyMutation.mutateAsync({ id: props.id, data: { ok: false, note: notFixedNote.value.trim() } });
    toast(t('comments.reopened'), 'success');
    showNotFixedNote.value = false;
    reloadAll();
  } catch (e) {
    fail(e);
  } finally {
    verifying.value = false;
  }
}

// ── Replies ───────────────────────────────────────────────────────────
const addReplyMutation = usePostApiCommentsIdReplies();
const replyBody = ref('');
const addingReply = ref(false);

async function addReply() {
  if (!props.id || !replyBody.value.trim()) return;
  addingReply.value = true;
  try {
    await addReplyMutation.mutateAsync({ id: props.id, data: { body: replyBody.value.trim() } });
    replyBody.value = '';
    toast(t('comments.replyAdded'), 'success');
    reloadAll();
  } catch (e) {
    fail(e);
  } finally {
    addingReply.value = false;
  }
}

// ── Visibility (author-only) ───────────────────────────────────────────
const visibilityMutation = usePatchApiCommentsIdVisibility();
const togglingVisibility = ref(false);

async function toggleVisibility() {
  if (!props.id || !comment.value) return;
  togglingVisibility.value = true;
  try {
    await visibilityMutation.mutateAsync({ id: props.id, data: { isPrivate: !comment.value.isPrivate } });
    toast(t('comments.visibilityUpdated'), 'success');
    reloadAll();
  } catch (e) {
    fail(e);
  } finally {
    togglingVisibility.value = false;
  }
}

// ── Delete ──────────────────────────────────────────────────────────────
const deleteMutation = useDeleteApiCommentsId();

async function onDelete() {
  if (!props.id) return;
  const ok = await confirm({
    message: t('comments.deleteConfirm'),
    confirmLabel: t('comments.delete'),
    confirmVariant: 'destructive',
  });
  if (!ok) return;
  try {
    await deleteMutation.mutateAsync({ id: props.id });
    toast(t('comments.deleted'), 'success');
    void queryClient.invalidateQueries({ queryKey: getGetApiProjectsKeyCommentsQueryKey(props.projectKey) });
    emit('deleted');
    close();
  } catch (e) {
    fail(e);
  }
}

// Reset transient UI state whenever a different comment opens.
watch(
  () => props.id,
  () => {
    showNotFixedNote.value = false;
    notFixedNote.value = '';
    replyBody.value = '';
  },
);
</script>

<template>
  <Dialog :open="open" @update:open="(o: boolean) => emit('update:open', o)">
    <DialogContent class="max-w-[440px] sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          {{ t('comments.detailTitle') }}
          <Badge v-if="comment" :variant="statusVariant(comment.status)">{{ statusLabel(comment.status) }}</Badge>
        </DialogTitle>
      </DialogHeader>

      <div v-if="isLoading || !comment" class="flex flex-col gap-3 py-4">
        <div class="h-4 w-2/3 rounded bg-gutter animate-pulse" />
        <div class="h-4 w-full rounded bg-gutter animate-pulse" />
        <div class="h-4 w-1/2 rounded bg-gutter animate-pulse" />
      </div>

      <div v-else class="flex flex-col gap-5 py-1">
        <!-- Body + badges -->
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <Badge :variant="statusVariant(comment.status)">{{ statusLabel(comment.status) }}</Badge>
            <Badge variant="neutral">{{ envLabel(comment.environment) }}</Badge>
            <Badge v-if="comment.hasPayloadFlag" variant="danger">{{ t('comments.flaggedBadge') }}</Badge>
            <Badge v-if="comment.isBugReport" variant="neutral">{{ t('comments.bugBadge') }}</Badge>
            <span
              v-if="comment.isPrivate"
              class="inline-flex items-center gap-1 text-[12px] text-muted-foreground"
              :title="t('comments.privateTooltip')"
            >
              <Lock class="h-3 w-3" /> {{ t('comments.privateTooltip') }}
            </span>
          </div>
          <p class="whitespace-pre-wrap text-[14px] text-foreground">{{ comment.body }}</p>
          <p class="text-[12px] text-muted-foreground">
            {{ t('comments.by', { name: comment.authorName ?? '—' }) }}
            · {{ formatRelativeTime(comment.createdAt, t) }}
            <template v-if="comment.editedAt"> · {{ t('comments.edited') }}</template>
          </p>
          <ul v-if="comment.payloadFlags?.length" class="flex flex-col gap-0.5 text-[12px] text-state-danger">
            <li v-for="flag in comment.payloadFlags" :key="flag">{{ flag }}</li>
          </ul>
          <div v-if="comment.pickedActionTexts?.length" class="flex flex-wrap gap-1.5">
            <Badge v-for="(action, idx) in comment.pickedActionTexts" :key="idx" variant="default">
              {{ action }}
            </Badge>
          </div>
        </div>

        <!-- Element -->
        <div v-if="comment.element" class="flex flex-col gap-2 border-t border-border-muted pt-4">
          <span class="text-sm font-medium">{{ t('comments.element') }}</span>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-0.5">
              <span class="text-[12px] text-muted-foreground">{{ t('comments.route') }}</span>
              <code class="font-mono text-[13px] break-all">{{ comment.element.route ?? '—' }}</code>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="text-[12px] text-muted-foreground">{{ t('comments.pageTitle') }}</span>
              <span class="text-[14px] break-words">{{ comment.element.pageTitle ?? '—' }}</span>
            </div>
            <div class="flex flex-col gap-0.5 sm:col-span-2">
              <span class="text-[12px] text-muted-foreground">{{ t('comments.pageUrl') }}</span>
              <a
                v-if="comment.element.pageUrl"
                :href="comment.element.pageUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-[14px] text-brand hover:underline break-all"
              >
                {{ comment.element.pageUrl }} <ExternalLink class="h-3 w-3 shrink-0" />
              </a>
              <span v-else class="text-[14px] text-muted-foreground">—</span>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="text-[12px] text-muted-foreground">{{ t('comments.selector') }}</span>
              <code class="font-mono text-[13px] break-all">{{ comment.element.selector ?? '—' }}</code>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="text-[12px] text-muted-foreground">{{ t('comments.sourcePath') }}</span>
              <code class="font-mono text-[13px] break-all">{{ comment.element.sourcePath ?? '—' }}</code>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="text-[12px] text-muted-foreground">{{ t('comments.device') }}</span>
              <span class="inline-flex items-center gap-1.5 text-[14px]">
                <Smartphone v-if="comment.element.deviceType === 'mobile'" class="h-3.5 w-3.5 text-muted-foreground" />
                <Monitor v-else class="h-3.5 w-3.5 text-muted-foreground" />
                {{ deviceLabel() }}
              </span>
            </div>
          </div>
          <img
            v-if="comment.element.screenshotUrl"
            :src="comment.element.screenshotUrl"
            :alt="t('comments.screenshot')"
            class="mt-1 max-h-48 w-auto rounded-md border border-border object-contain"
          />
        </div>

        <!-- Applied -->
        <div v-if="comment.appliedAt" class="flex flex-col gap-2 border-t border-border-muted pt-4">
          <span class="text-sm font-medium">{{ t('comments.applied') }}</span>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-0.5">
              <span class="text-[12px] text-muted-foreground">{{ t('comments.appliedBy') }}</span>
              <span class="text-[14px]">{{ comment.appliedByLabel ?? '—' }}</span>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="text-[12px] text-muted-foreground">{{ t('comments.appliedAt') }}</span>
              <span class="text-[14px]">{{ formatRelativeTime(comment.appliedAt, t) }}</span>
            </div>
            <div v-if="comment.commitUrl" class="flex flex-col gap-0.5">
              <span class="text-[12px] text-muted-foreground">{{ t('comments.commit') }}</span>
              <a
                :href="comment.commitUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 font-mono text-[13px] text-brand hover:underline"
              >
                {{ shortSha(comment.commitSha) || comment.commitUrl }} <ExternalLink class="h-3 w-3 shrink-0" />
              </a>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="text-[12px] text-muted-foreground">{{ t('comments.deployState') }}</span>
              <Badge v-if="comment.deployedAt" variant="completed" :title="shortSha(comment.deployedSha)">
                {{ t('comments.liveSince', { date: formatRelativeTime(comment.deployedAt, t) }) }}
              </Badge>
              <Badge v-else variant="neutral">{{ t('comments.notYetLive') }}</Badge>
            </div>
          </div>

          <!-- Verify -->
          <div v-if="canVerify || comment.verifiedAt" class="flex flex-col gap-2 pt-1">
            <p v-if="comment.verifiedAt" class="text-[13px] text-state-completed">
              {{ t('comments.verifiedAt', { date: formatRelativeTime(comment.verifiedAt, t) }) }}
            </p>
            <div v-if="canVerify && !showNotFixedNote" class="flex items-center gap-2">
              <Button type="button" size="sm" variant="secondary" :disabled="verifying" @click="verifyOk">
                <ThumbsUp class="h-4 w-4" /> {{ t('comments.worksButton') }}
              </Button>
              <Button type="button" size="sm" variant="outline" :disabled="verifying" @click="openNotFixed">
                <ThumbsDown class="h-4 w-4" /> {{ t('comments.notFixedButton') }}
              </Button>
            </div>
            <div v-if="showNotFixedNote" class="flex flex-col gap-2">
              <textarea
                v-model="notFixedNote"
                rows="2"
                :placeholder="t('comments.notFixedNotePlaceholder')"
                class="flex w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm resize-none"
              />
              <div class="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" @click="showNotFixedNote = false">
                  {{ t('common.cancel') }}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  :disabled="!notFixedNote.trim() || verifying"
                  @click="submitNotFixed"
                >
                  {{ t('comments.notFixedButton') }}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Replies -->
        <div class="flex flex-col gap-2 border-t border-border-muted pt-4">
          <span class="text-sm font-medium">{{ t('comments.replies') }}</span>
          <p v-if="!comment.replies?.length" class="text-[13px] text-muted-foreground italic">
            {{ t('comments.noReplies') }}
          </p>
          <div v-else class="flex flex-col gap-2">
            <div
              v-for="reply in comment.replies"
              :key="reply.id"
              class="flex flex-col gap-0.5 rounded-md bg-gutter px-3 py-2"
            >
              <p class="whitespace-pre-wrap text-[14px]">{{ reply.body }}</p>
              <p class="text-[12px] text-muted-foreground">
                {{ reply.authorName ?? '—' }} · {{ formatRelativeTime(reply.createdAt, t) }}
              </p>
            </div>
          </div>
          <div class="flex flex-col gap-2 pt-1">
            <textarea
              v-model="replyBody"
              rows="2"
              :placeholder="t('comments.replyPlaceholder')"
              class="flex w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm resize-none"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              class="self-start"
              :disabled="!replyBody.trim() || addingReply"
              @click="addReply"
            >
              {{ t('comments.addReply') }}
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter class="flex sm:justify-between items-center gap-2">
        <div v-if="comment" class="flex items-center gap-2">
          <Select :model-value="String(comment.status)" :disabled="!canManageStatus || savingStatus" @update:model-value="changeStatus">
            <SelectTrigger class="h-8 w-[9.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{{ t('comments.statusOpen') }}</SelectItem>
              <SelectItem value="2">{{ t('comments.statusReadyToApply') }}</SelectItem>
              <SelectItem value="3">{{ t('comments.statusApplied') }}</SelectItem>
              <SelectItem value="4">{{ t('comments.statusArchived') }}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            v-if="canToggleVisibility"
            type="button"
            variant="outline"
            size="sm"
            :disabled="togglingVisibility"
            @click="toggleVisibility"
          >
            <LockOpen v-if="comment.isPrivate" class="h-4 w-4" />
            <Lock v-else class="h-4 w-4" />
            {{ t(comment.isPrivate ? 'comments.makePublic' : 'comments.makePrivate') }}
          </Button>
          <Button v-if="canDelete" type="button" variant="outline" size="sm" class="text-destructive" @click="onDelete">
            <Trash2 class="h-4 w-4" /> {{ t('comments.delete') }}
          </Button>
        </div>
        <Button variant="secondary" @click="close">{{ t('common.close') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
