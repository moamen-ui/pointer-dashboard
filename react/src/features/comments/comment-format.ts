// Small pure helpers shared between CommentsPage (table) and CommentDetail (dialog) so
// the two views render status/environment identically.
import type { BadgeProps } from '@/components/ui/badge';

/** Built-in CommentStatus values (1 Open, 2 ReadyToApply, 3 Applied, 4 Archived) map onto
 *  the badge variants that carry their fixed diff hue + glyph — mirrors
 *  features/statuses/StatusesPage.tsx's badgeVariantForStatus (not exported from there). */
export function badgeVariantForStatus(value: number | undefined): NonNullable<BadgeProps['variant']> {
  switch (value) {
    case 2:
      return 'warning';
    case 3:
      return 'success';
    case 4:
      return 'archived';
    default:
      return 'open';
  }
}

/** EnvironmentTag (0 Unknown, 1 Local, 2 Staging, 3 Production) → i18n key. */
export function environmentLabelKey(env: number | undefined): string {
  switch (env) {
    case 1:
      return 'comments.env.local';
    case 2:
      return 'comments.env.staging';
    case 3:
      return 'comments.env.production';
    default:
      return 'comments.env.unknown';
  }
}
