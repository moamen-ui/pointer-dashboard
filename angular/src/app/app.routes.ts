import { inject } from '@angular/core';
import { CanActivateFn, Routes, Router } from '@angular/router';
import { adminGuard } from './core/auth/auth.guard';
import { authenticatedGuard } from './core/auth/authenticated.guard';
import { AuthService } from './core/auth/auth.service';

/** Redirects admin → /overview, non-admin → /profile after authentication. */
const roleRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.parseUrl('/login');
  return router.parseUrl(auth.isAdmin() ? '/overview' : '/profile');
};

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('./features/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [roleRedirectGuard],
        children: [],
      },
      {
        path: 'overview',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/overview/overview.component').then((m) => m.OverviewComponent),
      },
      {
        path: 'roles',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/roles/roles.component').then((m) => m.RolesComponent),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'users/:id/profile',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'projects',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/projects/projects.component').then((m) => m.ProjectsComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
