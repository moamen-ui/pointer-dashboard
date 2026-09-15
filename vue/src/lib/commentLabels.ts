// Shared label/tone mapping for the Comments screen (list + detail), so the
// enum → i18n-key → badge-variant mapping lives in exactly one place.
import type { StateTone } from '@/lib/statusTone';

/** CommentStatus: 1 Open, 2 ReadyToApply, 3 Applied, 4 Archived. */
const STATUS_I18N_KEYS: Record<number, string> = {
  1: 'comments.statusOpen',
  2: 'comments.statusReadyToApply',
  3: 'comments.statusApplied',
  4: 'comments.statusArchived',
};

const STATUS_TONES: Record<number, StateTone> = {
  1: 'open',
  2: 'ready',
  3: 'completed',
  4: 'archived',
};

export function commentStatusLabel(t: (key: string) => string, status: number | undefined): string {
  if (status == null) return '—';
  return t(STATUS_I18N_KEYS[status] ?? 'comments.statusOpen');
}

export function commentStatusVariant(status: number | undefined): StateTone {
  return status != null ? (STATUS_TONES[status] ?? 'neutral') : 'neutral';
}

/** EnvironmentTag: 0 Unknown, 1 Local, 2 Staging, 3 Production. */
const ENVIRONMENT_I18N_KEYS: Record<number, string> = {
  0: 'comments.environmentUnknown',
  1: 'comments.environmentLocal',
  2: 'comments.environmentStaging',
  3: 'comments.environmentProduction',
};

export function commentEnvironmentLabel(t: (key: string) => string, env: number | undefined): string {
  if (env == null) return '—';
  return t(ENVIRONMENT_I18N_KEYS[env] ?? 'comments.environmentUnknown');
}

export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : '';
}
