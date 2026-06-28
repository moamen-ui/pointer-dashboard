<script setup lang="ts">
import { RouterView, RouterLink, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  Pin,
  LayoutDashboard,
  UserCog,
  Users,
  Folder,
  Sun,
  Moon,
  LogOut,
  CircleUserRound,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/composables/useAuth';
import { usePreferences } from '@/composables/usePreferences';

const NAV = [
  { to: '/overview', key: 'nav.overview', icon: LayoutDashboard },
  { to: '/roles', key: 'nav.roles', icon: UserCog },
  { to: '/users', key: 'nav.users', icon: Users },
  { to: '/projects', key: 'nav.projects', icon: Folder },
];

const { t } = useI18n();
const router = useRouter();
const { user, logout } = useAuth();
const { theme, language, toggleTheme, toggleLanguage } = usePreferences();

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
      <span class="flex items-center gap-2 font-bold">
        <Pin class="h-5 w-5 rotate-45 text-brand" />
        {{ t('header.brand') }}
      </span>
      <span class="flex-1" />
      <span
        v-if="user"
        class="me-2 hidden items-center gap-1.5 text-sm text-muted-foreground sm:inline-flex"
      >
        <CircleUserRound class="h-4 w-4" />
        {{ user.displayName }} · {{ user.roleName }}
      </span>
      <Button variant="ghost" size="icon" aria-label="Toggle theme" @click="toggleTheme">
        <Sun v-if="theme === 'dark'" class="h-4 w-4" />
        <Moon v-else class="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" @click="toggleLanguage">
        {{ language === 'ar' ? 'EN' : 'ع' }}
      </Button>
      <Button variant="outline" size="sm" @click="signOut">
        <LogOut class="h-4 w-4" />
        {{ t('header.signOut') }}
      </Button>
    </header>

    <!-- Body: sidebar + content -->
    <div class="flex flex-1 overflow-hidden bg-app">
      <aside class="w-[232px] flex-shrink-0 border-e border-border bg-sidebar py-2">
        <nav class="flex flex-col gap-0.5 px-2.5">
          <RouterLink
            v-for="item in NAV"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            active-class="bg-brand-tint font-semibold !text-brand"
          >
            <component :is="item.icon" class="h-5 w-5" />
            <span>{{ t(item.key) }}</span>
          </RouterLink>
        </nav>
      </aside>

      <main class="h-full flex-1 overflow-y-auto bg-app p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
