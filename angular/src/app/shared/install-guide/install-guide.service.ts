import { computed, inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { getApiAdminProjectsResource } from '@moamen-ui/pointer-angular';
import { InstallGuideComponent } from './install-guide.component';

/** Per-user localStorage/sessionStorage keys for the auto-open policy. */
const SEEN_KEY = (userId: number | string) => `pointer_install_seen:${userId}`;
const SUPPRESSED_KEY = (userId: number | string) => `pointer_install_suppressed:${userId}`;
const SESSION_KEY = (userId: number | string) => `pointer_install_shown_session:${userId}`;

export interface AutoOpenContext {
  isAdmin: boolean;
  userId: number | string | null;
  /** Comments across every project the user can see. */
  commentsCount: number;
}

/**
 * Owns the install guide: how it opens, and whether it opens by itself.
 *
 * The project list lives here rather than in the dialog so the header (which shows
 * a hint dot while nothing has been collected yet) and the dialog's project picker
 * share a single fetch. `GET /api/admin/projects` is plain [Authorize], so every
 * signed-in user — stakeholders included — gets their own projects.
 */
@Injectable({ providedIn: 'root' })
export class InstallGuideService {
  private dialog = inject(MatDialog);

  readonly projectsResource = getApiAdminProjectsResource();
  readonly projects = computed(() => this.projectsResource.value() ?? []);

  /** Total comments across visible projects; 0 means nothing has been collected yet. */
  readonly commentsCount = computed(() =>
    this.projects().reduce((sum, p) => sum + (p.commentsCount ?? 0), 0),
  );

  /** True once the project list has loaded and no comment exists anywhere. */
  readonly nothingCollectedYet = computed(
    () => !this.projectsResource.isLoading() && this.commentsCount() === 0,
  );

  open(): void {
    this.dialog.open(InstallGuideComponent, { width: '680px', maxWidth: '94vw' });
  }

  /**
   * Auto-open policy: a workspace admin who is either new here or has no feedback
   * yet gets the guide opened for them. An explicit "don't show again" wins over
   * both, and it opens at most once per browser session so a reload doesn't nag.
   */
  shouldAutoOpen(ctx: AutoOpenContext): boolean {
    if (!ctx.isAdmin || ctx.userId == null) return false;
    if (this.flag(SUPPRESSED_KEY(ctx.userId))) return false;
    if (this.flag(SESSION_KEY(ctx.userId), sessionStorage)) return false;
    const firstTime = !this.flag(SEEN_KEY(ctx.userId));
    return firstTime || ctx.commentsCount === 0;
  }

  /** Records that the guide has been shown (first-time no longer applies). */
  markShown(userId: number | string | null): void {
    if (userId == null) return;
    this.setFlag(SEEN_KEY(userId));
    this.setFlag(SESSION_KEY(userId), sessionStorage);
  }

  /** "Don't show this again" — stops every future auto-open for this user. */
  suppress(userId: number | string | null): void {
    if (userId == null) return;
    this.setFlag(SUPPRESSED_KEY(userId));
  }

  /** Undoes "don't show again" when the user unticks the box. */
  unsuppress(userId: number | string | null): void {
    if (userId == null) return;
    try {
      localStorage.removeItem(SUPPRESSED_KEY(userId));
    } catch {
      // ignore
    }
  }

  isSuppressed(userId: number | string | null): boolean {
    return userId != null && this.flag(SUPPRESSED_KEY(userId));
  }

  private flag(key: string, store: Storage = localStorage): boolean {
    try {
      return store.getItem(key) === '1';
    } catch {
      return false;
    }
  }

  private setFlag(key: string, store: Storage = localStorage): void {
    try {
      store.setItem(key, '1');
    } catch {
      // Private-mode storage failures must not break the guide.
    }
  }
}
