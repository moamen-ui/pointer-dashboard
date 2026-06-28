// vue-router with an admin route guard (Vue equivalent of React's ProtectedRoute
// / Angular's adminGuard): unauthenticated or non-admin sessions are bounced to
// /login. Protected pages render inside the Shell layout.
import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import Shell from '@/features/shell/Shell.vue';
import LoginPage from '@/features/login/LoginPage.vue';
import OverviewPage from '@/features/overview/OverviewPage.vue';
import RolesPage from '@/features/roles/RolesPage.vue';
import UsersPage from '@/features/users/UsersPage.vue';
import ProjectsPage from '@/features/projects/ProjectsPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginPage },
    {
      path: '/',
      component: Shell,
      meta: { requiresAdmin: true },
      children: [
        { path: '', redirect: '/overview' },
        { path: 'overview', name: 'overview', component: OverviewPage },
        { path: 'roles', name: 'roles', component: RolesPage },
        { path: 'users', name: 'users', component: UsersPage },
        { path: 'projects', name: 'projects', component: ProjectsPage },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const { isAuthenticated, isAdmin } = useAuth();
  if (to.meta.requiresAdmin && (!isAuthenticated.value || !isAdmin.value)) {
    return { name: 'login' };
  }
  return true;
});
