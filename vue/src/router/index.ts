// vue-router with three route guards:
//   authenticatedGuard — any logged-in user (blocks unauthenticated → /login)
//   adminGuard         — admin only (blocks non-admin → /login)
//   superAdminGuard    — super-admin only (blocks non-super-admin → /login)
// The shell is reachable by any authenticated user; admin-only children are
// additionally guarded by requiresAdmin. The `/profile` child is available to
// all authenticated users. The index redirect picks the target by role so
// there are no redirect chains.
import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import Shell from '@/features/shell/Shell.vue';
import LoginPage from '@/features/login/LoginPage.vue';
import OverviewPage from '@/features/overview/OverviewPage.vue';
import RolesPage from '@/features/roles/RolesPage.vue';
import UsersPage from '@/features/users/UsersPage.vue';
import ProjectsPage from '@/features/projects/ProjectsPage.vue';
import ProfilePage from '@/features/profile/ProfilePage.vue';
import StatusesPage from '@/features/statuses/StatusesPage.vue';
import TenantsPage from '@/features/tenants/TenantsPage.vue';
import SettingsPage from '@/features/settings/SettingsPage.vue';
import SignupPage from '@/features/signup/SignupPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginPage },
    // Public self-signup (no auth required)
    { path: '/signup', name: 'signup', component: SignupPage },
    {
      path: '/',
      component: Shell,
      meta: { requiresAuth: true },
      children: [
        // Role-aware index: no redirect chain — resolved in the guard below.
        // NOTE: requiresAuth is inherited from the shell parent via vue-router meta-merge; do NOT add requiresAdmin here — that would break non-admin access.
        { path: '', name: 'index', component: { template: '<div/>' } },
        // Admin-only children.
        { path: 'overview', name: 'overview', component: OverviewPage, meta: { requiresAdmin: true } },
        { path: 'roles', name: 'roles', component: RolesPage, meta: { requiresAdmin: true } },
        { path: 'users', name: 'users', component: UsersPage, meta: { requiresAdmin: true } },
        { path: 'projects', name: 'projects', component: ProjectsPage, meta: { requiresAdmin: true } },
        { path: 'statuses', name: 'statuses', component: StatusesPage, meta: { requiresAdmin: true } },
        // Admin-only: view another user's profile by id.
        { path: 'users/:id/profile', name: 'user-profile', component: ProfilePage, meta: { requiresAdmin: true } },
        // Authenticated (any role): own profile.
        { path: 'profile', name: 'profile', component: ProfilePage },
        // Super-admin-only children.
        { path: 'tenants', name: 'tenants', component: TenantsPage, meta: { requiresAdmin: true, requiresSuperAdmin: true } },
        { path: 'settings', name: 'settings', component: SettingsPage, meta: { requiresAdmin: true, requiresSuperAdmin: true } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const { isAuthenticated, isAdmin, isSuperAdmin } = useAuth();

  // requiresAuth: must be logged in.
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return { name: 'login' };
  }

  // requiresAdmin: must be admin (also enforces auth).
  if (to.meta.requiresAdmin && (!isAuthenticated.value || !isAdmin.value)) {
    return { name: 'login' };
  }

  // requiresSuperAdmin: must be super-admin (also enforces auth + admin).
  if (to.meta.requiresSuperAdmin && (!isAuthenticated.value || !isSuperAdmin.value)) {
    return { name: 'login' };
  }

  // Role-aware index redirect — resolves in one hop, no chain.
  if (to.name === 'index' && isAuthenticated.value) {
    return isAdmin.value ? { name: 'overview' } : { name: 'profile' };
  }

  return true;
});
