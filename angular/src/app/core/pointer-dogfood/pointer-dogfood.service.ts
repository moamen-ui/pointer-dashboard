import { computed, effect, Injectable, inject } from '@angular/core';
import { getApiAdminProjectsResource } from '@moamen-ui/pointer-angular';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

const WIDGET_TAG = 'pointer-feedback';

/**
 * Mounts the dogfooding `<pointer-feedback>` widget on the dashboard itself, but only for a user
 * whose own tenant actually has the `pointerFeedback.project` project — otherwise every OTHER
 * tenant's users would see the floating widget for a project they have no relationship to. There is
 * no per-project ACL in this codebase (tenant membership grants access to every project in the
 * tenant), so "has access" reduces to "this project key appears in my tenant's project list", which
 * GET /api/admin/projects already returns for any authenticated member (not just admins).
 */
@Injectable({ providedIn: 'root' })
export class PointerDogfoodService {
  private readonly auth = inject(AuthService);
  private readonly resource = getApiAdminProjectsResource();
  private scriptInjected = false;

  private readonly hasAccess = computed(() => {
    if (!environment.pointerFeedback.enabled || !this.auth.isAuthenticated()) return false;
    // A super admin has no tenant of their own — GET /api/admin/projects returns a cross-tenant,
    // platform-wide list for them (by design, for platform management), so "does some project
    // named pointer-dashboard exist ANYWHERE" would trivially match regardless of who owns it.
    // "my tenant has this project" is a meaningless question for a super admin; the only correct
    // answer is that they never see the dogfooding widget at all.
    if (this.auth.isSuperAdmin()) return false;
    // httpResource THROWS from .value() while in an error state (unlike a plain signal) — a
    // transient failure here (network blip, CORS, a 401 racing a fresh login) must not crash the
    // effect below and take the whole app down with it; just treat it as "no access yet".
    try {
      const projects = this.resource.value() ?? [];
      return projects.some((p) => p.key === environment.pointerFeedback.project);
    } catch {
      return false;
    }
  });

  constructor() {
    // Refetch the project list whenever auth state flips to signed-in (login, or app boot with an
    // existing session) — httpResource fetches once at construction, before any session exists.
    effect(() => {
      if (this.auth.isAuthenticated()) this.resource.reload();
    });

    effect(() => {
      if (this.hasAccess()) this.mount();
      else this.unmount();
    });
  }

  private mount(): void {
    if (!this.scriptInjected) {
      const script = document.createElement('script');
      script.src = `${environment.apiBase}/pointer.js`;
      script.defer = true;
      document.head.appendChild(script);
      this.scriptInjected = true;
    }
    if (document.querySelector(WIDGET_TAG)) return;
    const widget = document.createElement(WIDGET_TAG);
    widget.setAttribute('project', environment.pointerFeedback.project);
    widget.setAttribute('server', environment.apiBase);
    widget.setAttribute('environment', environment.pointerFeedback.environment);
    widget.setAttribute('source-attr', 'data-component-source');
    document.body.appendChild(widget);
  }

  private unmount(): void {
    document.querySelector(WIDGET_TAG)?.remove();
  }
}
