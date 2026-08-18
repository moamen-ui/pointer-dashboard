<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { RouterView, RouterLink, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
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
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/composables/useAuth';
import { usePreferences } from '@/composables/usePreferences';
import { useBranding } from '@/composables/useBranding';
import DemoPanel from '@/features/shell/DemoPanel.vue';
import InstallGuideDialog from '@/shared/install-guide/InstallGuideDialog.vue';
import { shouldAutoOpen, useInstallGuide } from '@/shared/install-guide/useInstallGuide';

const sidebarOpen = ref(false);

const ADMIN_NAV = [
  { to: '/overview', key: 'nav.overview', icon: LayoutDashboard },
  { to: '/roles', key: 'nav.roles', icon: UserCog },
  { to: '/users', key: 'nav.users', icon: Users },
  { to: '/statuses', key: 'nav.statuses', icon: Tag },
];

const ALL_NAV = [
  { to: '/projects', key: 'nav.projects', icon: Folder },
];

const SUPER_ADMIN_NAV = [
  { to: '/tenants', key: 'nav.tenants', icon: Building2 },
  { to: '/plans', key: 'nav.plans', icon: CreditCard },
  { to: '/branding', key: 'nav.branding', icon: Palette },
  { to: '/settings', key: 'nav.settings', icon: Settings },
];

const { t } = useI18n();
const router = useRouter();
const { user, isAdmin, isSuperAdmin, logout } = useAuth();
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
      class="z-10 flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-header px-4 shadow-sm"
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
      <span class="flex items-center gap-2 font-bold">
        <img
          v-if="branding.assets.logo"
          :src="branding.assets.logo"
          :alt="branding.productName"
          class="h-7 max-w-[120px] object-contain"
        />
        <template v-else>
          <Pin class="h-5 w-5 rotate-45 text-brand" />
          {{ branding.productName }} Admin
        </template>
      </span>
      <span class="flex-1" />
      <span
        v-if="user"
        class="me-2 hidden items-center gap-1.5 text-sm text-muted-foreground sm:inline-flex"
      >
        <CircleUserRound class="h-4 w-4" />
        {{ user.displayName }} · {{ user.roleName }}
      </span>
      <!-- Installation steps: always reachable, with a dot while no feedback has
           landed yet (that dot is the nudge for a workspace that isn't wired up). -->
      <Button
        variant="ghost"
        size="icon"
        class="relative"
        :title="t('install.title')"
        :aria-label="t('install.title')"
        @click="guideOpen = true"
      >
        <Rocket class="h-4 w-4" />
        <span
          v-if="nothingCollectedYet"
          class="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-brand"
        />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Toggle theme" @click="toggleTheme">
        <Sun v-if="theme === 'dark'" class="h-4 w-4" />
        <Moon v-else class="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="text-xs font-semibold"
        :aria-label="t('header.language')"
        @click="toggleLanguage"
      >
        {{ language === 'ar' ? 'EN' : 'ع' }}
      </Button>
      <Button variant="outline" size="sm" @click="signOut">
        <LogOut class="h-4 w-4" />
        <span class="hidden sm:inline">{{ t('header.signOut') }}</span>
      </Button>
    </header>

    <!-- Demo banner (only when a demo session is active) -->
    <DemoPanel />

    <!-- Shared installation-steps dialog (header rocket + demo banner + auto-open) -->
    <InstallGuideDialog />

    <!-- Body: sidebar + content -->
    <div class="flex flex-1 overflow-hidden bg-app">
      <!-- Backdrop (mobile only) -->
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-30 bg-black/40 md:hidden"
        @click="sidebarOpen = false"
      />

      <aside
        class="fixed bottom-0 start-0 top-14 z-40 w-[232px] flex-shrink-0 border-e border-border bg-sidebar py-2 transition-transform md:static md:top-auto md:z-auto md:translate-x-0"
        :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'"
      >
        <nav class="flex flex-col gap-0.5 px-2.5">
          <!-- Admin-only nav items -->
          <template v-if="isAdmin">
            <RouterLink
              v-for="item in ADMIN_NAV"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              active-class="bg-brand-tint font-semibold !text-brand"
              @click="sidebarOpen = false"
            >
              <component :is="item.icon" class="h-5 w-5" />
              <span>{{ t(item.key) }}</span>
            </RouterLink>
          </template>
          <!-- Super-admin-only nav items -->
          <template v-if="isSuperAdmin">
            <RouterLink
              v-for="item in SUPER_ADMIN_NAV"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              active-class="bg-brand-tint font-semibold !text-brand"
              @click="sidebarOpen = false"
            >
              <component :is="item.icon" class="h-5 w-5" />
              <span>{{ t(item.key) }}</span>
            </RouterLink>
          </template>
          <!-- Available to all authenticated users -->
          <RouterLink
            v-for="item in ALL_NAV"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            active-class="bg-brand-tint font-semibold !text-brand"
            @click="sidebarOpen = false"
          >
            <component :is="item.icon" class="h-5 w-5" />
            <span>{{ t(item.key) }}</span>
          </RouterLink>
          <!-- Always visible: My profile -->
          <RouterLink
            to="/profile"
            class="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            active-class="bg-brand-tint font-semibold !text-brand"
            @click="sidebarOpen = false"
          >
            <UserRound class="h-5 w-5" />
            <span>{{ t('nav.myProfile') }}</span>
          </RouterLink>
        </nav>
      </aside>

      <main class="h-full min-w-0 flex-1 overflow-auto bg-app p-4 sm:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
