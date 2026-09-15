<script setup lang="ts">
import { computed, ref, watch, watchEffect, onMounted, onUnmounted } from 'vue';
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiMeNotificationsUnreadCount,
  useGetApiMeNotifications,
  usePatchApiMeNotificationsIdRead,
  usePostApiMeNotificationsReadAll,
  getGetApiMeNotificationsUnreadCountQueryKey,
  getGetApiMeNotificationsQueryKey,
  type NotificationDto,
} from '@moamen-ui/pointer-vue';
import {
  Pin,
  LayoutDashboard,
  UserCog,
  Users,
  Folder,
  Tag,
  Sun,
  Moon,
  LogOut,
  CircleUserRound,
  UserRound,
  Building2,
  Settings,
  Menu,
  CreditCard,
  Palette,
  Rocket,
  Languages,
  Globe,
  Compass,
  ChevronDown,
  Bell,
  MessageSquare,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/composables/useAuth';
import { usePreferences } from '@/composables/usePreferences';
import { useBranding } from '@/composables/useBranding';
import DemoPanel from '@/features/shell/DemoPanel.vue';
import InstallGuideDialog from '@/shared/install-guide/InstallGuideDialog.vue';
import TourSpotlight from '@/components/TourSpotlight.vue';
import { shouldAutoOpen, useInstallGuide } from '@/shared/install-guide/useInstallGuide';
import { useTour } from '@/lib/tour';

const sidebarOpen = ref(false);
const { startTour } = useTour();
const queryClient = useQueryClient();
const route = useRoute();

// Belt-and-braces close: the per-link @click already closes the drawer on a
// normal nav click, but this also covers back/forward and any programmatic
// navigation (e.g. the notifications bell jumping to /comments).
watch(
  () => route.fullPath,
  () => {
    sidebarOpen.value = false;
  },
);

// R2.4: Notifications
const notificationsMenuOpen = ref(false);
const { data: unreadCountData, refetch: refetchUnreadCount } = useGetApiMeNotificationsUnreadCount();
const unreadCount = computed(() => (unreadCountData.value as any)?.unreadCount ?? 0);

const { data: notificationsData, isFetching: notificationsLoading } = useGetApiMeNotifications(
  undefined,
  { query: { enabled: notificationsMenuOpen } }
);
const notifications = computed<NotificationDto[]>(
  () => (notificationsData.value as unknown as any)?.data ?? []
);

const markNotificationRead = usePatchApiMeNotificationsIdRead();
const markAllRead = usePostApiMeNotificationsReadAll();

async function doMarkRead(notification: NotificationDto) {
  if (!notification.id || notification.readAt) return;
  try {
    await markNotificationRead.mutateAsync({ id: notification.id });
    await refetchUnreadCount();
    void queryClient.invalidateQueries({ queryKey: getGetApiMeNotificationsQueryKey() });
  } catch {
    // Silent fail
  }
}

// Clicking a notification marks it read and jumps straight to the comment it's about — the
// Comments screen reads `project`/`comment` from the URL and opens the detail dialog.
function openNotification(notification: NotificationDto) {
  void doMarkRead(notification);
  notificationsMenuOpen.value = false;
  if (notification.commentId == null) return;
  void router.push({
    path: '/comments',
    query: {
      ...(notification.projectKey ? { project: notification.projectKey } : {}),
      comment: String(notification.commentId),
    },
  });
}

async function doMarkAllRead() {
  try {
    await markAllRead.mutateAsync({} as any);
    await refetchUnreadCount();
    void queryClient.invalidateQueries({ queryKey: getGetApiMeNotificationsQueryKey() });
  } catch {
    // Silent fail
  }
}

// Pause notifications polling when document is hidden
let pollInterval: number | undefined;
onMounted(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Pause polling
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = undefined;
      }
    } else {
      // Resume polling
      pollInterval = window.setInterval(() => {
        void queryClient.refetchQueries({ queryKey: getGetApiMeNotificationsUnreadCountQueryKey() });
      }, 60000);
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
});

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});

function notificationTypeLabel(type: number | null | undefined): string {
  // NotificationType enum: 0=CommentApplied, 1=CommentReopened, 2=ReplyAdded
  switch (type) {
    case 0: return t('notifications.commentApplied');
    case 1: return t('notifications.commentReopened');
    case 2: return t('notifications.replyAdded');
    default: return '';
  }
}

function formatNotificationTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('time.justNow');
    if (diffMins < 60) return t('time.minutesAgo', { n: diffMins });
    if (diffHours < 24) return t('time.hoursAgo', { n: diffHours });
    if (diffDays < 7) return t('time.daysAgo', { n: diffDays });
    return date.toLocaleDateString();
  } catch {
    return isoDate;
  }
}

const ADMIN_NAV = [
  { to: '/overview', key: 'nav.overview', icon: LayoutDashboard },
  { to: '/roles', key: 'nav.roles', icon: UserCog },
  { to: '/users', key: 'nav.users', icon: Users },
  { to: '/statuses', key: 'nav.statuses', icon: Tag },
  { to: '/environments', key: 'nav.environments', icon: Globe },
  { to: '/settings', key: 'nav.settings', icon: Settings },
];

const ALL_NAV = [
  { to: '/projects', key: 'nav.projects', icon: Folder },
  { to: '/comments', key: 'nav.comments', icon: MessageSquare },
];

const SUPER_ADMIN_NAV = [
  { to: '/tenants', key: 'nav.tenants', icon: Building2 },
  { to: '/plans', key: 'nav.plans', icon: CreditCard },
  { to: '/branding', key: 'nav.branding', icon: Palette },
];

const { t } = useI18n();
const router = useRouter();
const { user, isAdmin, isSuperAdmin, logout } = useAuth();

// First name only: enough to tell whose session this is without spending
// header width on the full display name + role (both stay inside the menu).
const firstName = computed(() => user.value?.displayName?.trim().split(/\s+/)[0] ?? '');
const { theme, language, toggleTheme, toggleLanguage } = usePreferences();
const { branding } = useBranding();
const {
  guideOpen,
  commentsCount,
  nothingCollectedYet,
  isLoading: projectsLoading,
} = useInstallGuide();

// A workspace admin who is new here — or whose workspace has collected nothing
// yet — gets the guide opened for them, once. Waits for the project list so
// commentsCount is real rather than a loading 0.
watchEffect(() => {
  if (projectsLoading.value) return;
  const u = user.value;
  if (!u) return;
  if (
    shouldAutoOpen({
      isAdmin: isAdmin.value,
      isSuperAdmin: isSuperAdmin.value,
      userId: u.id ?? null,
      commentsCount: commentsCount.value,
    })
  ) {
    guideOpen.value = true;
  }
});

function signOut() {
  logout();
  void router.replace('/login');
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <!-- Header -->
    <header
      class="z-10 h-12 flex flex-shrink-0 items-center gap-3 border-b border-border bg-background px-4"
    >
      <Button
        variant="ghost"
        size="icon"
        class="md:hidden"
        :aria-label="t('header.menu')"
        @click="sidebarOpen = !sidebarOpen"
      >
        <Menu class="h-5 w-5" />
      </Button>
      <!-- min-w-0 lets this shrink instead of forcing the header to overflow —
           a long white-label product name truncates rather than pushing the
           bell/install/account controls off a 360px viewport. -->
      <div class="flex min-w-0 items-center gap-2">
        <img
          v-if="branding.assets.logo"
          :src="branding.assets.logo"
          :alt="branding.productName"
          class="h-6 max-w-[120px] shrink-0 object-contain"
        />
        <template v-else>
          <Pin class="h-4 w-4 shrink-0 rotate-45 text-brand" />
          <span class="truncate text-[14px] font-semibold text-foreground">
            {{ branding.productName ? `${branding.productName} Admin` : t('header.brand') }}
          </span>
        </template>
      </div>
      <span class="flex-1" />

      <!-- R2.4: Notifications bell -->
      <div class="relative">
        <Button
          variant="ghost"
          size="icon"
          class="relative"
          :aria-label="t('header.notifications')"
          @click="notificationsMenuOpen = !notificationsMenuOpen"
        >
          <Bell class="h-5 w-5" />
          <span
            v-if="unreadCount > 0"
            class="absolute right-0 top-0 h-5 w-5 rounded-full bg-state-danger text-white text-[10px] font-bold flex items-center justify-center"
          >
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
        </Button>

        <!-- Notifications dropdown -->
        <div
          v-if="notificationsMenuOpen"
          class="absolute right-0 mt-1 w-80 rounded-md border border-border bg-background shadow-menu z-50"
        >
          <div class="max-h-96 overflow-y-auto">
            <div v-if="notificationsLoading || notifications.length === 0" class="p-4 text-center text-[13px] text-muted-foreground">
              {{ notificationsLoading ? t('notifications.loading') : t('notifications.empty') }}
            </div>
            <template v-else>
              <div
                v-for="n of notifications"
                :key="n.id"
                class="border-b border-border-muted last:border-0 p-3 hover:bg-gutter transition-colors cursor-pointer"
                @click="openNotification(n)"
              >
                <div class="flex items-start gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="text-[13px] font-medium">{{ notificationTypeLabel(n.type) }}</div>
                    <div class="text-[12px] text-muted-foreground mt-0.5 truncate">{{ n.commentBodyExcerpt ?? n.projectName ?? '' }}</div>
                    <div class="text-[12px] text-muted-foreground mt-1">{{ formatNotificationTime(n.createdAt) }}</div>
                  </div>
                  <div v-if="!n.readAt" class="flex-shrink-0 h-2 w-2 rounded-full bg-brand mt-1" />
                </div>
              </div>
            </template>
          </div>
          <div v-if="notifications.length > 0" class="border-t border-border p-2 flex gap-1">
            <Button variant="ghost" size="sm" class="text-[12px]" @click="doMarkAllRead">
              {{ t('notifications.markAllRead') }}
            </Button>
          </div>
        </div>
      </div>

      <!-- Install steps button or icon -->
      <Button
        v-if="nothingCollectedYet"
        variant="default"
        size="sm"
        @click="guideOpen = true"
        data-tour="nav-install-guide"
        class="flex items-center gap-1.5"
      >
        <Rocket class="h-4 w-4" />
        <span>{{ t('install.title') }}</span>
      </Button>
      <Button
        v-else
        variant="ghost"
        size="icon"
        @click="guideOpen = true"
        data-tour="nav-install-guide"
      >
        <Rocket class="h-4 w-4" />
      </Button>

      <!-- Account menu with identity, theme, language, sign-out -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            class="flex items-center gap-1.5 px-2"
            :aria-label="t('header.account')"
          >
            <CircleUserRound class="h-5 w-5" />
            <!-- Name with the role beneath it, right on the trigger (sm+ only) -->
            <div
              v-if="firstName"
              class="hidden sm:flex flex-col items-start"
            >
              <span class="text-[14px] font-medium leading-none">{{ firstName }}</span>
              <span
                v-if="user?.roleName"
                class="text-[12px] text-muted-foreground leading-none"
              >
                {{ user.roleName }}
              </span>
            </div>
            <ChevronDown class="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div v-if="user" class="px-2 py-1.5 leading-tight">
            <div class="text-sm font-semibold">{{ user.displayName }}</div>
            <div class="text-xs text-muted-foreground">{{ user.roleName }}</div>
          </div>
          <DropdownMenuSeparator v-if="user" />

          <DropdownMenuItem @select="router.push('/profile')">
            <UserRound class="h-4 w-4" />
            {{ t('nav.myProfile') }}
          </DropdownMenuItem>

          <DropdownMenuItem @select="toggleTheme">
            <Sun v-if="theme === 'dark'" class="h-4 w-4" />
            <Moon v-else class="h-4 w-4" />
            {{ t('header.theme') }}:
            {{ theme === 'dark' ? t('header.themeLight') : t('header.themeDark') }}
          </DropdownMenuItem>

          <DropdownMenuItem @select="toggleLanguage">
            <Languages class="h-4 w-4" />
            {{ t('header.language') }}: {{ language === 'ar' ? 'English' : 'العربية' }}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem @select="signOut">
            <LogOut class="h-4 w-4" />
            {{ t('header.signOut') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>

    <!-- Demo banner (only when a demo session is active) -->
    <DemoPanel />

    <!-- Shared installation-steps dialog (header rocket + demo banner + auto-open) -->
    <InstallGuideDialog />
    <TourSpotlight />

    <!-- Body: rail + content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Backdrop (mobile only) -->
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-30 bg-overlay md:hidden"
        @click="sidebarOpen = false"
      />

      <!-- Rail: 240px nav sidebar. Below md it becomes an off-canvas drawer over the overlay
           backdrop — a floating layer in the same family as a dialog (they share the overlay
           token), so it earns the dialog shadow there; at rest on desktop it stays flat, per
           the rail's own no-shadow rule. -->
      <aside
        class="fixed bottom-0 start-0 top-12 z-40 w-[240px] flex flex-col border-e border-border bg-gutter py-3 transition-transform max-md:shadow-dialog md:static md:top-auto md:z-auto"
        :class="sidebarOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full max-md:rtl:translate-x-full'"
      >
        <nav class="flex flex-1 flex-col">
          <!-- Admin-only nav items -->
          <div v-if="isAdmin">
            <RouterLink
              v-for="item in ADMIN_NAV"
              :key="item.to"
              :to="item.to"
              :data-tour="item.to === '/environments' ? 'nav-environments' : undefined"
              class="h-8 mx-2 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground max-md:min-h-11"
              active-class="bg-brand-tint !text-brand font-semibold"
              @click="sidebarOpen = false"
            >
              <component :is="item.icon" class="h-4 w-4" />
              <span>{{ t(item.key) }}</span>
            </RouterLink>
          </div>

          <!-- Projects (available to all) with separator above -->
          <div :class="isAdmin && 'my-2 border-t border-border-muted'">
            <RouterLink
              v-for="item in ALL_NAV"
              :key="item.to"
              :to="item.to"
              :data-tour="item.to === '/projects' ? 'nav-projects' : undefined"
              class="h-8 mx-2 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground max-md:min-h-11"
              active-class="bg-brand-tint !text-brand font-semibold"
              @click="sidebarOpen = false"
            >
              <component :is="item.icon" class="h-4 w-4" />
              <span>{{ t(item.key) }}</span>
            </RouterLink>
          </div>

          <!-- Super-admin nav items with separator above -->
          <div v-if="isSuperAdmin" class="my-2 border-t border-border-muted">
            <RouterLink
              v-for="item in SUPER_ADMIN_NAV"
              :key="item.to"
              :to="item.to"
              class="h-8 mx-2 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground max-md:min-h-11"
              active-class="bg-brand-tint !text-brand font-semibold"
              @click="sidebarOpen = false"
            >
              <component :is="item.icon" class="h-4 w-4" />
              <span>{{ t(item.key) }}</span>
            </RouterLink>
          </div>

          <!-- My Profile with separator above (unless non-admin with no groups) -->
          <div :class="(isAdmin || isSuperAdmin) && 'my-2 border-t border-border-muted'">
            <RouterLink
              to="/profile"
              class="h-8 mx-2 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground max-md:min-h-11"
              active-class="bg-brand-tint !text-brand font-semibold"
              @click="sidebarOpen = false"
            >
              <CircleUserRound class="h-4 w-4" />
              <span>{{ t('nav.myProfile') }}</span>
            </RouterLink>
          </div>
        </nav>

        <!-- Quick tour + Installation steps in the footer -->
        <div class="mt-auto flex flex-col border-t border-border-muted pt-2 px-2">
          <button
            type="button"
            class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground max-md:min-h-11"
            @click="sidebarOpen = false; startTour()"
          >
            <Compass class="h-4 w-4" />
            <span>{{ t('tour.quickTour') }}</span>
          </button>

          <button
            type="button"
            data-tour="nav-install-guide"
            class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground max-md:min-h-11"
            @click="sidebarOpen = false; guideOpen = true"
          >
            <Rocket class="h-4 w-4" />
            <span>{{ t('install.title') }}</span>
            <span v-if="nothingCollectedYet" class="h-1.5 w-1.5 rounded-full bg-brand ms-auto" />
          </button>
        </div>
      </aside>

      <!-- Main content. overflow-x-clip is a belt-and-braces guard: no page
           should ever need to scroll horizontally (only tables/cards do, in
           their own container), so this just clips instead of scrolling if
           something someday overflows. -->
      <main class="flex-1 min-w-0 overflow-y-auto overflow-x-clip bg-background p-6">
        <div class="mx-auto w-full min-w-0 max-w-[1120px] ms-0">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>
