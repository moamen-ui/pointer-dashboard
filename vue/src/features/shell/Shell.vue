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
  Globe,
  Compass,
  ChevronDown,
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
      <div class="flex items-center gap-2">
        <img
          v-if="branding.assets.logo"
          :src="branding.assets.logo"
          :alt="branding.productName"
          class="h-6 max-w-[120px] object-contain"
        />
        <template v-else>
          <Pin class="h-4 w-4 rotate-45 text-brand" />
          <span class="text-[14px] font-semibold text-foreground">
            {{ branding.productName ? `${branding.productName} Admin` : t('header.brand') }}
          </span>
        </template>
      </div>
      <span class="flex-1" />

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

      <!-- Rail: 240px nav sidebar -->
      <aside
        class="fixed bottom-0 start-0 top-12 z-40 w-[240px] flex flex-col border-e border-border bg-gutter py-3 transition-transform md:static md:top-auto md:z-auto"
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
              class="h-8 mx-2 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground"
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
              class="h-8 mx-2 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground"
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
              class="h-8 mx-2 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground"
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
              class="h-8 mx-2 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground"
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
            class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground"
            @click="sidebarOpen = false; startTour()"
          >
            <Compass class="h-4 w-4" />
            <span>{{ t('tour.quickTour') }}</span>
          </button>

          <button
            type="button"
            data-tour="nav-install-guide"
            class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground"
            @click="sidebarOpen = false; guideOpen = true"
          >
            <Rocket class="h-4 w-4" />
            <span>{{ t('install.title') }}</span>
            <span v-if="nothingCollectedYet" class="h-1.5 w-1.5 rounded-full bg-brand ms-auto" />
          </button>
        </div>
      </aside>

      <!-- Main content -->
      <main class="flex-1 min-w-0 overflow-auto bg-background p-6">
        <div class="mx-auto w-full max-w-[1120px] ms-0">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>
