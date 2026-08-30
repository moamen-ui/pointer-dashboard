import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Blocks a quick-access (e.g. "Client") account from a route — they only exist to leave widget
 * comments on their own project and must never reach project management. Redirects to /profile
 * (not /login: they're legitimately signed in, just not allowed here).
 */
export const notQuickAccessGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isQuickAccess()) return router.parseUrl('/profile');
  return true;
};
