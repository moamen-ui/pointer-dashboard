<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
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
  Languages,
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

      <!-- One profile menu instead of a row of loose header buttons: identity, the
           install guide, theme, language and sign-out all live in here. The
           install-guide dot rides on the trigger so the nudge is still visible
           while the menu is closed. -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" class="h-11 gap-1 px-2" :aria-label="t('header.account')">
            <CircleUserRound class="h-5 w-5" />
            <!-- Name with the role beneath it, right on the trigger: who you are signed
                 in as is worth seeing without opening the menu (Pointer feedback #136). -->
            <span
              v-if="firstName"
              class="ms-1 hidden flex-col items-start leading-tight sm:inline-flex"
            >
              <span class="text-[0.9rem] font-medium">{{ firstName }}</span>
              <span v-if="user?.roleName" class="text-[0.7rem] font-normal text-muted-foreground">
                {{ user.roleName }}
              </span>
            </span>
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

    <!-- Body: sidebar + content -->
    <div class="flex flex-1 overflow-hidden bg-app">
      <!-- Backdrop (mobile only) -->
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-30 bg-black/40 md:hidden"
        @click="sidebarOpen = false"
      />

      <aside
        class="fixed bottom-0 start-0 top-14 z-40 flex w-[232px] flex-shrink-0 flex-col border-e border-border bg-sidebar py-2 transition-transform md:static md:top-auto md:z-auto md:translate-x-0"
        :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'"
      >
        <nav class="flex flex-1 flex-col gap-0.5 px-2.5">
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

        <!-- Installation steps sit at the foot of the nav rather than in the account
             menu: it is a one-off setup task for the workspace, not a personal
             setting. The hint dot lives here too, so it is visible without opening
             anything. -->
        <div class="mt-auto border-t border-border px-2.5 pt-2">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-start text-sm font-medium text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            @click="sidebarOpen = false; guideOpen = true"
          >
            <Rocket class="h-5 w-5" />
            <span>{{ t('install.title') }}</span>
            <span v-if="nothingCollectedYet" class="h-2 w-2 rounded-full bg-brand" />
          </button>
        </div>
      </aside>

      <main class="h-full min-w-0 flex-1 overflow-auto bg-app p-4 sm:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
