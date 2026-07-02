import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { catchError, map, throwError } from 'rxjs';
import type { PlanLimit } from '@moamen-ui/pointer-angular';
import { environment } from '../../../environments/environment';

/** Lever name (server sends PascalCase entitlement names) → friendly i18n key. */
const LEVER_I18N: Record<string, string> = {
  MaxProjects: 'limit.leverMaxProjects',
  MaxSeats: 'limit.leverMaxSeats',
  MaxCommentsPerMonth: 'limit.leverMaxCommentsPerMonth',
  ExtensionEnabled: 'limit.leverExtensionEnabled',
  MaxExtensionSites: 'limit.leverMaxExtensionSites',
  MaxPredefinedActionsPerProject: 'limit.leverMaxPredefinedActionsPerProject',
  MaxTenantWidePredefinedActions: 'limit.leverMaxTenantWidePredefinedActions',
};

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiRequest = req.url.startsWith('/api/');

  let modifiedReq = req;
  if (isApiRequest) {
    modifiedReq = req.clone({ url: environment.apiBase + req.url });
  }

  const token = localStorage.getItem('pointer_admin_token');
  if (token) {
    modifiedReq = modifiedReq.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  const router = inject(Router);
  const snack = inject(MatSnackBar);
  const transloco = inject(TranslocoService);

  // Feature 3: plan-enforcement upgrade prompt. Enforcement is OFF in prod today, but
  // this is wired now so it lights up the moment the server starts returning isLimitReached.
  const showUpgradePrompt = (limit: PlanLimit | undefined): void => {
    const leverKey = limit?.lever ?? '';
    const leverLabel = transloco.translate(LEVER_I18N[leverKey] ?? 'limit.reached');
    const msg = transloco.translate('limit.message', {
      lever: leverLabel,
      current: limit?.current ?? 0,
      limit: limit?.limit ?? 0,
    });
    snack
      .open(msg, transloco.translate('limit.upgrade'), { duration: 8000 })
      .onAction()
      .subscribe(() => router.navigateByUrl('/plans'));
  };

  return next(modifiedReq).pipe(
    map((event) => {
      if (event instanceof HttpResponse && isApiRequest) {
        const body = event.body as {
          isSuccess?: boolean;
          message?: string | null;
          data?: unknown;
          isLimitReached?: boolean;
          limit?: PlanLimit;
        } | null;
        if (body && typeof body === 'object' && 'isSuccess' in body) {
          // A limit-reached envelope can arrive on a 200 response as well as a 400.
          if (body.isLimitReached === true) {
            showUpgradePrompt(body.limit);
          }
          if (!body.isSuccess) {
            throw new Error(body.message || 'Request failed');
          }
          return event.clone({ body: body.data });
        }
      }
      return event;
    }),
    catchError((err) => {
      // Plan-enforcement blocks come back as HTTP 400 with the Result envelope in err.error.
      const envelope = err?.error as { isLimitReached?: boolean; limit?: PlanLimit } | undefined;
      if (envelope && typeof envelope === 'object' && envelope.isLimitReached === true) {
        showUpgradePrompt(envelope.limit);
      }
      if (err?.status === 401) {
        localStorage.removeItem('pointer_admin_token');
        localStorage.removeItem('pointer_admin_user');
        router.navigateByUrl('/login');
      }
      return throwError(() => err);
    }),
  );
};
