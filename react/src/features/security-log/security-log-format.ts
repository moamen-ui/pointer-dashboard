// Small pure helpers shared between SecurityLogPage (table) and SecurityLogEventDetail
// (dialog) — mirrors features/comments/comment-format.ts's shape. DB-12 §3.6/§3.8a.
import type { BadgeProps } from '@/components/ui/badge';

type Translate = (key: string, opts?: Record<string, unknown>) => string;

/** API validation for the `action` prefix filter (`AuditQuery.Action`) — matched
 *  client-side before the param is sent so an invalid value never reaches the API. */
export const ACTION_PREFIX_RE = /^[a-z_.]{1,64}$/;

/** `AuditEventDto.actorKind` is one of these four server strings (`AuditActorKind`).
 *  Maps to the translated chip label; unrecognised values fall back to the raw string
 *  so a future kind never renders blank. */
export function actorKindLabel(t: Translate, kind: string | null | undefined): string {
  switch (kind) {
    case 'User':
      return t('securityLog.actorKind.user');
    case 'SuperAdmin':
      return t('securityLog.actorKind.superAdmin');
    case 'System':
      return t('securityLog.actorKind.system');
    case 'Impersonation':
      return t('securityLog.actorKind.impersonation');
    default:
      return kind ?? '—';
  }
}

/** Neutral for every kind — this chip labels a category, not a workflow state, so it
 *  never carries the state-color semantics (DESIGN.md: color is never the only signal,
 *  and never spent on something that isn't a state). */
export function actorKindBadgeVariant(): NonNullable<BadgeProps['variant']> {
  return 'neutral';
}

/** `action` strings are dotted (`member.updated`, `auth.login.succeeded`) so they map
 *  directly onto i18next's nested-key lookup (default `keySeparator: '.'`) under
 *  `securityLog.actions.*` — one JSON tree mirrors the whole catalogue
 *  (Application/Common/AuditActions.cs) instead of a parallel JS switch. Unknown/future
 *  actions fall back to the raw string via `defaultValue`, per doc §11 ("fallback the
 *  raw string"). */
export function actionLabel(t: Translate, action: string | null | undefined): string {
  if (!action) return '—';
  return t(`securityLog.actions.${action}`, { defaultValue: action });
}

/** `targetType` strings are flat (underscored, e.g. `project_app_url`) — a single-level
 *  map under `securityLog.targets.*`, same fallback rule as `actionLabel`. */
export function targetTypeLabel(t: Translate, targetType: string | null | undefined): string {
  if (!targetType) return '—';
  return t(`securityLog.targets.${targetType}`, { defaultValue: targetType });
}

/** Shortens an id/hash for the table cell; the full value is always still available via
 *  `title` (hover) and the row's detail dialog — never destructively truncated data. */
export function truncateMiddle(value: string, keep = 8): string {
  if (value.length <= keep + 3) return value;
  return `${value.slice(0, keep)}…`;
}
