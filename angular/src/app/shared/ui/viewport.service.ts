import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';

/** The one `< md` breakpoint every mobile-adaptive piece of the app agrees on (matches Tailwind's
 *  default `md` at 768px, minus the same 0.02px CDK epsilon the shell already used). Shared here so
 *  the data table, dialogs and the tour prompt all flip card/sheet/prompt behavior at the same pixel
 *  instead of drifting between a `window.matchMedia` string in one place and another elsewhere. */
export const MOBILE_QUERY = '(max-width: 767.98px)';

@Injectable({ providedIn: 'root' })
export class ViewportService {
  /** True below the `md` breakpoint. Initial value falls back to `window.innerWidth` for the
   *  first synchronous read (SSR-safe: `window` is guarded). */
  readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe(MOBILE_QUERY)
      .pipe(map((r) => r.matches)),
    { initialValue: typeof window !== 'undefined' && window.innerWidth < 768 },
  );
}
