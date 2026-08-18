// Owns the install guide: how it opens, and whether it opens by itself.
// Vue port of the Angular InstallGuideService — the "service" is a composable
// whose open flag is a module-level ref shared by the header button, the demo
// banner and the auto-open policy. The project list is a useGetApiAdminProjects
// query: every call site observes the same vue-query cache entry (one fetch).
//
// `GET /api/admin/projects` is plain [Authorize], so every signed-in user —
// stakeholders included — gets their own projects, and the comments total is
// derived by summing commentsCount over that list.
import { computed, ref } from 'vue';
import { useGetApiAdminProjects, type ProjectResponse } from '@moamen-ui/pointer-vue';

/** Per-user localStorage/sessionStorage keys for the auto-open policy. */
const SEEN_KEY = (userId: string) => `pointer_install_seen:${userId}`;
const SUPPRESSED_KEY = (userId: string) => `pointer_install_suppressed:${userId}`;
const SESSION_KEY = (userId: string) => `pointer_install_shown_session:${userId}`;

export interface AutoOpenContext {
  isAdmin: boolean;
  userId: string | null;
  /** Comments across every project the user can see. */
  commentsCount: number;
}

function flag(key: string, store: Storage = localStorage): boolean {
  try {
    return store.getItem(key) === '1';
  } catch {
    return false;
  }
}

function setFlag(key: string, store: Storage = localStorage): void {
  try {
    store.setItem(key, '1');
  } catch {
    // Private-mode storage failures must not break the guide.
  }
}

/**
 * Auto-open policy: a workspace admin who is either new here or has no feedback
 * yet gets the guide opened for them. An explicit "don't show again" wins over
 * both, and it opens at most once per browser session so a reload doesn't nag.
 * Pure (inputs + storage only) so it is unit-testable.
 */
export function shouldAutoOpen(ctx: AutoOpenContext): boolean {
  if (!ctx.isAdmin || ctx.userId == null) return false;
  if (flag(SUPPRESSED_KEY(ctx.userId))) return false;
  if (flag(SESSION_KEY(ctx.userId), sessionStorage)) return false;
  const firstTime = !flag(SEEN_KEY(ctx.userId));
  return firstTime || ctx.commentsCount === 0;
}

/** Records that the guide has been shown (first-time no longer applies). */
export function markShown(userId: string | null): void {
  if (userId == null) return;
  setFlag(SEEN_KEY(userId));
  setFlag(SESSION_KEY(userId), sessionStorage);
}

/** "Don't show this again" — stops every future auto-open for this user. */
export function suppress(userId: string | null): void {
  if (userId == null) return;
  setFlag(SUPPRESSED_KEY(userId));
}

/** Undoes "don't show again" when the user unticks the box. */
export function unsuppress(userId: string | null): void {
  if (userId == null) return;
  try {
    localStorage.removeItem(SUPPRESSED_KEY(userId));
  } catch {
    // ignore
  }
}

export function isSuppressed(userId: string | null): boolean {
  return userId != null && flag(SUPPRESSED_KEY(userId));
}

/** One shared dialog: every entry point flips this same ref. */
const guideOpen = ref(false);

export function useInstallGuide() {
  const projectsQuery = useGetApiAdminProjects();
  const projects = computed<ProjectResponse[]>(() => projectsQuery.data.value ?? []);

  /** Total comments across visible projects; 0 means nothing has been collected yet. */
  const commentsCount = computed(() =>
    projects.value.reduce((sum, p) => sum + (p.commentsCount ?? 0), 0),
  );

  /** True once the project list has loaded and no comment exists anywhere. */
  const nothingCollectedYet = computed(
    () => !projectsQuery.isLoading.value && commentsCount.value === 0,
  );

  function open(): void {
    guideOpen.value = true;
  }

  return {
    guideOpen,
    open,
    projects,
    commentsCount,
    nothingCollectedYet,
    isLoading: projectsQuery.isLoading,
  };
}
