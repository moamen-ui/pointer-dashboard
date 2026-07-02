# Branding UI — Angular Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add branding runtime consumption (Feature 2) and a super-admin branding editor page (Feature 1) to the Angular dashboard at `/Users/momen/Desktop/REPOS/pointer-dashboard/angular/`.

**Architecture:** A `BrandingService` (providedIn root, uses raw `HttpClient`) fetches `GET /api/branding` on app init, exposes signals for `productName`, `logo`, `favicon`, and `primaryColor`, and immediately applies `document.title` / favicon DOM effects. The branding admin page at route `/branding` (super-admin guarded) uses `HttpClient` directly for all branding API calls (`GET /api/admin/branding`, `PUT /api/admin/branding`, `POST/DELETE /api/admin/branding/asset/{kind}`) because the generated client in `@moamen-ui/pointer-angular@1.0.17` does not model multipart — consistent approach is to use the same HttpClient everywhere for branding. The shell header references `BrandingService` signals instead of hardcoded `'header.brand'` transloco keys.

**Tech Stack:** Angular 22, Angular Material, Transloco (`@jsverse/transloco`), Angular signals, HttpClient (no orval-generated service for branding), Tailwind CSS.

## Global Constraints

- Work directory: `/Users/momen/Desktop/REPOS/pointer-dashboard/angular/` — all relative paths below are from this root.
- Package must be upgraded: `@moamen-ui/pointer-angular@1.0.17` (run `npm install @moamen-ui/pointer-angular@1.0.17` — NOT `@^1.0.17`).
- Node binary for build: `/opt/homebrew/opt/node@26/bin/node` (use `PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run build`).
- No new dependencies beyond the package upgrade.
- Do NOT commit.
- `npm run build` must pass with zero errors before done.
- All new user-visible strings must have `en` + `ar` i18n keys in `public/assets/i18n/en.json` and `public/assets/i18n/ar.json`.
- Follow existing patterns: standalone components, Angular signals (`signal()`, `computed()`, `toSignal()`), Material UI, transloco pipe for i18n, `inject()` in constructor body.
- File upload: `POST /api/admin/branding/asset/{kind}` with `FormData` field `file` via `HttpClient.post()` (not the generated orval service — multipart is not modelled there). `DELETE /api/admin/branding/asset/{kind}` likewise via `HttpClient.delete()`.
- API URLs follow the interceptor pattern: use paths like `/api/branding` and `/api/admin/branding` — the `apiInterceptor` prepends `environment.apiBase` automatically AND adds the Bearer token. The BrandingService's public `GET /api/branding` call is the only unauthenticated one; the interceptor only adds the token when `localStorage` has it, so it's safe to always call through the same HttpClient.
- Accept mime types for upload: `image/png,image/svg+xml,image/webp,image/jpeg`, max 1 MB.
- Asset `{kind}` values: `logo`, `iconSquare`, `favicon`, `appleTouch`, `pwa192`, `pwa512`.
- Expected dimensions per kind (show in the upload widget): logo=`SVG or PNG ~40px tall`, iconSquare=`512×512 PNG`, favicon=`32×32 PNG`, appleTouch=`180×180 PNG`, pwa192=`192×192 PNG`, pwa512=`512×512 PNG`.
- Fallback: if `GET /api/branding` fails, keep bundled defaults — never blank the header.

---

## File Map

**Create:**
- `src/app/core/branding/branding.service.ts` — fetches `GET /api/branding`; exposes signals; applies `document.title` and favicon side-effects; `refresh()` method for post-save calls.
- `src/app/features/branding/branding.component.ts` — super-admin branding editor page (standalone component, template inline).

**Modify:**
- `package.json` — bump `@moamen-ui/pointer-angular` to `1.0.17`.
- `src/app/app.ts` — inject `BrandingService` in constructor to trigger app-init fetch.
- `src/app/app.routes.ts` — add `/branding` route guarded by `superAdminGuard`.
- `src/app/features/shell/shell.component.ts` — inject `BrandingService`; replace hardcoded brand name `'header.brand' | transloco` with dynamic `branding.productName()` + optional logo image; add `/branding` nav item in super-admin section.
- `public/assets/i18n/en.json` — add `branding` key block.
- `public/assets/i18n/ar.json` — add `branding` key block.

---

## Task 1: Upgrade package and define BrandingService

**Files:**
- Modify: `package.json`
- Create: `src/app/core/branding/branding.service.ts`

**Interfaces:**
- Produces: `BrandingService` with signals `productName: Signal<string>`, `logo: Signal<string | null>`, `favicon: Signal<string | null>`, `primaryColor: Signal<string>`, and method `refresh(): void` (re-fetches GET /api/branding and re-applies effects).

- [ ] **Step 1: Install the upgraded package**

```bash
cd /Users/momen/Desktop/REPOS/pointer-dashboard/angular
npm install @moamen-ui/pointer-angular@1.0.17
```

Expected: `node_modules/@moamen-ui/pointer-angular/package.json` shows `"version": "1.0.17"`, `package.json` dependency updated to `"@moamen-ui/pointer-angular": "1.0.17"`.

- [ ] **Step 2: Create the BrandingService**

Create `/Users/momen/Desktop/REPOS/pointer-dashboard/angular/src/app/core/branding/branding.service.ts`:

```typescript
import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

export interface BrandingResponse {
  productName: string;
  tagline: string;
  primaryColor: string;
  urls: { app: string; demo: string; docs: string; landing: string };
  assets: {
    logo: string | null;
    iconSquare: string | null;
    favicon: string | null;
    appleTouch: string | null;
    pwa192: string | null;
    pwa512: string | null;
  };
  version: number;
}

const DEFAULTS: BrandingResponse = {
  productName: 'Pointer',
  tagline: 'Point at the UI. Ship it with AI.',
  primaryColor: '#2563eb',
  urls: { app: '', demo: '', docs: '', landing: '' },
  assets: { logo: null, iconSquare: null, favicon: null, appleTouch: null, pwa192: null, pwa512: null },
  version: 0,
};

@Injectable({ providedIn: 'root' })
export class BrandingService {
  private http = inject(HttpClient);
  private _data = signal<BrandingResponse>(DEFAULTS);

  readonly productName = computed(() => this._data().productName || 'Pointer');
  readonly tagline = computed(() => this._data().tagline);
  readonly primaryColor = computed(() => this._data().primaryColor);
  readonly logo = computed(() => this._data().assets.logo);
  readonly favicon = computed(() => this._data().assets.favicon);
  readonly data = this._data.asReadonly();

  /** Call once on app init. Also called after save/upload to refresh live branding. */
  refresh(): void {
    this.http.get<BrandingResponse>('/api/branding')
      .pipe(catchError(() => of(DEFAULTS)))
      .subscribe((res) => {
        this._data.set(res);
        this.applyEffects(res);
      });
  }

  private applyEffects(res: BrandingResponse): void {
    if (typeof document === 'undefined') return;
    document.title = `${res.productName || 'Pointer'} Admin`;
    const fav = res.assets.favicon;
    if (fav) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = fav;
    }
  }
}
```

- [ ] **Step 3: Verify syntax**

```bash
cd /Users/momen/Desktop/REPOS/pointer-dashboard/angular
/opt/homebrew/opt/node@26/bin/node node_modules/@angular/compiler-cli/bin/ngc --version 2>/dev/null || true
PATH=/opt/homebrew/opt/node@26/bin:$PATH npx tsc --noEmit --project tsconfig.app.json 2>&1 | head -30
```

Expected: No errors for the new file. (Other pre-existing errors are OK at this stage — focus on new file only.)

---

## Task 2: Wire BrandingService into app init and shell

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/features/shell/shell.component.ts`
- Modify: `src/app/app.routes.ts`

**Interfaces:**
- Consumes: `BrandingService.productName(): string`, `BrandingService.logo(): string | null`, `BrandingService.refresh(): void`
- Produces: Shell header shows dynamic product name + optional logo image; `/branding` route wired with `superAdminGuard`; nav item in super-admin section.

- [ ] **Step 1: Wire BrandingService into app root init**

Edit `/Users/momen/Desktop/REPOS/pointer-dashboard/angular/src/app/app.ts` — inject `BrandingService` in the constructor and call `refresh()`:

```typescript
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { PreferencesService } from './core/prefs/preferences.service';
import { BrandingService } from './core/branding/branding.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {
  constructor() {
    const auth = inject(AuthService);
    const prefs = inject(PreferencesService);
    const branding = inject(BrandingService);
    prefs.init(auth.user() ?? undefined);
    branding.refresh();
  }
}
```

- [ ] **Step 2: Add `/branding` route to app.routes.ts**

Edit `/Users/momen/Desktop/REPOS/pointer-dashboard/angular/src/app/app.routes.ts`. In the `children` array of the shell route, add this entry after the `plans` route entry:

Old text to replace:
```typescript
      {
        path: 'settings',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
```

New text:
```typescript
      {
        path: 'settings',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'branding',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/branding/branding.component').then((m) => m.BrandingComponent),
      },
```

- [ ] **Step 3: Update ShellComponent to use BrandingService and add nav item**

Replace the full content of `/Users/momen/Desktop/REPOS/pointer-dashboard/angular/src/app/features/shell/shell.component.ts` with:

```typescript
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { BidiModule } from '@angular/cdk/bidi';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { PreferencesService } from '../../core/prefs/preferences.service';
import { BrandingService } from '../../core/branding/branding.service';
import { DemoPanelComponent } from './demo-panel.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    BidiModule,
    TranslocoModule,
    DemoPanelComponent,
  ],
  template: `
    <mat-toolbar class="toolbar z-[2] shrink-0 border-b border-app-border bg-header text-ink shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      @if (isMobile()) {
        <button mat-icon-button class="me-1" (click)="snav.toggle()" [attr.aria-label]="'header.menu' | transloco">
          <mat-icon>menu</mat-icon>
        </button>
      }
      <span class="flex items-center gap-2 text-[1.1rem] font-bold">
        @if (branding.logo()) {
          <img [src]="branding.logo()!" alt="" class="h-[28px] max-w-[120px] object-contain" />
        } @else {
          <mat-icon class="rotate-45 text-brand">push_pin</mat-icon>
        }
        {{ branding.productName() }} Admin
      </span>
      <span class="flex-1"></span>
      @if (auth.user()) {
        <span class="me-3.5 hidden items-center gap-1.5 text-[0.9rem] text-muted sm:inline-flex">
          <mat-icon class="text-muted">account_circle</mat-icon>
          {{ auth.user()!.displayName }} · {{ auth.user()!.roleName }}
        </span>
      }
      <button mat-icon-button (click)="toggleTheme()">
        <mat-icon>{{ prefs.theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
      </button>
      <button mat-button (click)="togglePrefsLang()">{{ prefs.language() === 'ar' ? 'EN' : 'ع' }}</button>
      <button mat-stroked-button class="border-app-border text-ink" (click)="auth.logout()">
        <mat-icon>logout</mat-icon> <span class="hidden sm:inline">{{ 'header.signOut' | transloco }}</span>
      </button>
    </mat-toolbar>

    <mat-sidenav-container class="flex-1 overflow-hidden bg-app" [dir]="prefs.language() === 'ar' ? 'rtl' : 'ltr'">
      <mat-sidenav #snav [mode]="isMobile() ? 'over' : 'side'" [opened]="!isMobile()" class="sidenav w-[232px] border-e border-app-border bg-sidebar pt-2">
        <mat-nav-list (click)="onNavClick(snav)">
          <a mat-list-item routerLink="/profile" routerLinkActive="active-link">
            <mat-icon matListItemIcon>person</mat-icon>
            <span matListItemTitle>{{ 'nav.myProfile' | transloco }}</span>
          </a>
          <a mat-list-item routerLink="/projects" routerLinkActive="active-link">
            <mat-icon matListItemIcon>folder</mat-icon>
            <span matListItemTitle>{{ 'nav.projects' | transloco }}</span>
          </a>
          @if (auth.isAdmin()) {
            <a mat-list-item routerLink="/overview" routerLinkActive="active-link">
              <mat-icon matListItemIcon>dashboard</mat-icon>
              <span matListItemTitle>{{ 'nav.overview' | transloco }}</span>
            </a>
            <a mat-list-item routerLink="/roles" routerLinkActive="active-link">
              <mat-icon matListItemIcon>manage_accounts</mat-icon>
              <span matListItemTitle>{{ 'nav.roles' | transloco }}</span>
            </a>
            <a mat-list-item routerLink="/users" routerLinkActive="active-link">
              <mat-icon matListItemIcon>people</mat-icon>
              <span matListItemTitle>{{ 'nav.users' | transloco }}</span>
            </a>
            <a mat-list-item routerLink="/statuses" routerLinkActive="active-link">
              <mat-icon matListItemIcon>label</mat-icon>
              <span matListItemTitle>{{ 'nav.statuses' | transloco }}</span>
            </a>
          }
          @if (auth.isSuperAdmin()) {
            <a mat-list-item routerLink="/tenants" routerLinkActive="active-link">
              <mat-icon matListItemIcon>business</mat-icon>
              <span matListItemTitle>{{ 'nav.tenants' | transloco }}</span>
            </a>
            <a mat-list-item routerLink="/plans" routerLinkActive="active-link">
              <mat-icon matListItemIcon>credit_card</mat-icon>
              <span matListItemTitle>{{ 'nav.plans' | transloco }}</span>
            </a>
            <a mat-list-item routerLink="/settings" routerLinkActive="active-link">
              <mat-icon matListItemIcon>settings</mat-icon>
              <span matListItemTitle>{{ 'nav.settings' | transloco }}</span>
            </a>
            <a mat-list-item routerLink="/branding" routerLinkActive="active-link">
              <mat-icon matListItemIcon>palette</mat-icon>
              <span matListItemTitle>{{ 'nav.branding' | transloco }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="h-full overflow-auto bg-app p-4 sm:p-6">
        <app-demo-panel />
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100vh; }

    .sidenav a.mat-mdc-list-item {
      margin: 2px 10px;
      border-radius: 10px;
      color: var(--muted);
    }
    .sidenav a.mat-mdc-list-item mat-icon { color: var(--muted); }
    .sidenav a.mat-mdc-list-item:hover { background: rgba(15, 23, 42, 0.04); }
    .active-link.mat-mdc-list-item { background: var(--brand-tint); color: var(--brand); font-weight: 600; }
    .active-link.mat-mdc-list-item mat-icon { color: var(--brand); }
  `],
})
export class ShellComponent {
  auth = inject(AuthService);
  prefs = inject(PreferencesService);
  branding = inject(BrandingService);

  isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767.98px)')
      .pipe(map((r) => r.matches)),
    { initialValue: typeof window !== 'undefined' && window.innerWidth < 768 },
  );

  onNavClick(snav: { close: () => void }): void {
    if (this.isMobile()) snav.close();
  }

  togglePrefsLang(): void {
    this.prefs.setLanguage(this.prefs.language() === 'ar' ? 'en' : 'ar');
  }

  toggleTheme(): void {
    this.prefs.setTheme(this.prefs.theme() === 'dark' ? 'light' : 'dark');
  }
}
```

- [ ] **Step 4: Add nav.branding i18n keys (both languages)**

In `public/assets/i18n/en.json`, add `"branding": "Branding"` to the `"nav"` object:

```json
  "nav": {
    "overview": "Overview",
    "roles": "Roles",
    "users": "Users",
    "projects": "Projects",
    "statuses": "Statuses",
    "myProfile": "My Profile",
    "tenants": "Tenants",
    "plans": "Plans",
    "settings": "Settings",
    "branding": "Branding"
  },
```

In `public/assets/i18n/ar.json`, add `"branding": "العلامة التجارية"` to the `"nav"` object:

```json
  "nav": {
    "overview": "نظرة عامة",
    "roles": "الأدوار",
    "users": "المستخدمون",
    "projects": "المشاريع",
    "statuses": "الحالات",
    "myProfile": "ملفي الشخصي",
    "tenants": "المستأجرون",
    "plans": "الخطط",
    "settings": "الإعدادات",
    "branding": "العلامة التجارية"
  },
```

- [ ] **Step 5: Run tsc check**

```bash
cd /Users/momen/Desktop/REPOS/pointer-dashboard/angular
PATH=/opt/homebrew/opt/node@26/bin:$PATH npx tsc --noEmit --project tsconfig.app.json 2>&1 | head -40
```

Expected: No errors in the files just edited. (BrandingComponent not yet created — ignore "cannot find module" for `./features/branding/branding.component`.)

---

## Task 3: Build the branding admin page component

**Files:**
- Create: `src/app/features/branding/branding.component.ts`

**Interfaces:**
- Consumes: `BrandingService.refresh()` — calls it after save/upload/delete to refresh live branding.
- Produces: Standalone `BrandingComponent` at selector `app-branding`.

The component uses `HttpClient` directly (injected) for all API calls:
- `GET /api/admin/branding` — loaded via `httpResource` from `@angular/common/http` or via a signal + explicit fetch. Use Angular's `httpResource` (Angular 19.2+ experimental) matching the existing `getApiAdminPlansResource()` pattern, but since there's no generated function for branding, do a manual fetch in `ngOnInit` / constructor using `HttpClient.get()` into a signal instead.
- `PUT /api/admin/branding` — `HttpClient.put()`.
- `POST /api/admin/branding/asset/{kind}` — `HttpClient.post()` with `FormData`.
- `DELETE /api/admin/branding/asset/{kind}` — `HttpClient.delete()`.

- [ ] **Step 1: Create the branding component**

Create `/Users/momen/Desktop/REPOS/pointer-dashboard/angular/src/app/features/branding/branding.component.ts` with the full content below:

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { BrandingService, BrandingResponse } from '../../core/branding/branding.service';
import { extractMessage } from '../../core/api/extract-message';

type AssetKind = 'logo' | 'iconSquare' | 'favicon' | 'appleTouch' | 'pwa192' | 'pwa512';

interface AssetMeta {
  kind: AssetKind;
  labelKey: string;
  hintKey: string;
  accept: string;
}

const ASSET_KINDS: AssetMeta[] = [
  { kind: 'logo',        labelKey: 'branding.assetLogo',        hintKey: 'branding.assetLogoHint',        accept: 'image/png,image/svg+xml,image/webp,image/jpeg' },
  { kind: 'iconSquare',  labelKey: 'branding.assetIconSquare',  hintKey: 'branding.assetIconSquareHint',  accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'favicon',     labelKey: 'branding.assetFavicon',     hintKey: 'branding.assetFaviconHint',     accept: 'image/png,image/webp' },
  { kind: 'appleTouch',  labelKey: 'branding.assetAppleTouch',  hintKey: 'branding.assetAppleTouchHint',  accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'pwa192',      labelKey: 'branding.assetPwa192',      hintKey: 'branding.assetPwa192Hint',      accept: 'image/png,image/webp' },
  { kind: 'pwa512',      labelKey: 'branding.assetPwa512',      hintKey: 'branding.assetPwa512Hint',      accept: 'image/png,image/webp' },
];

interface BrandingForm {
  productName: string;
  tagline: string;
  primaryColor: string;
  urlApp: string;
  urlDemo: string;
  urlDocs: string;
  urlLanding: string;
}

@Component({
  selector: 'app-branding',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSnackBar,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslocoModule,
  ],
  template: `
    <div class="p-6 max-w-3xl">
      <h2 class="m-0 mb-6 text-[1.5em] font-bold">{{ 'branding.title' | transloco }}</h2>

      @if (loading()) {
        <p class="text-muted">{{ 'branding.loading' | transloco }}</p>
      } @else if (loadError()) {
        <p class="text-red-500">{{ 'branding.loadError' | transloco }}</p>
      } @else {

        <!-- Text / URL form -->
        <section class="mb-8">
          <h3 class="m-0 mb-4 text-[1.1em] font-semibold">{{ 'branding.sectionText' | transloco }}</h3>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <mat-form-field appearance="outline" class="col-span-1 sm:col-span-2">
              <mat-label>{{ 'branding.productName' | transloco }}</mat-label>
              <input matInput [(ngModel)]="form.productName" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="col-span-1 sm:col-span-2">
              <mat-label>{{ 'branding.tagline' | transloco }}</mat-label>
              <input matInput [(ngModel)]="form.tagline" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'branding.primaryColor' | transloco }}</mat-label>
              <input matInput type="color" [(ngModel)]="form.primaryColor" style="height:36px;padding:2px 4px;cursor:pointer" />
            </mat-form-field>
          </div>

          <h3 class="m-0 mb-4 mt-4 text-[1.1em] font-semibold">{{ 'branding.sectionUrls' | transloco }}</h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'branding.urlApp' | transloco }}</mat-label>
              <input matInput type="url" [(ngModel)]="form.urlApp" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'branding.urlDemo' | transloco }}</mat-label>
              <input matInput type="url" [(ngModel)]="form.urlDemo" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'branding.urlDocs' | transloco }}</mat-label>
              <input matInput type="url" [(ngModel)]="form.urlDocs" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'branding.urlLanding' | transloco }}</mat-label>
              <input matInput type="url" [(ngModel)]="form.urlLanding" />
            </mat-form-field>
          </div>

          <div class="mt-4 flex justify-end">
            <button mat-flat-button color="primary" [disabled]="saving()" (click)="saveText()">
              <mat-icon>save</mat-icon> {{ 'branding.save' | transloco }}
            </button>
          </div>
        </section>

        <!-- Asset uploaders -->
        <section>
          <h3 class="m-0 mb-4 text-[1.1em] font-semibold">{{ 'branding.sectionAssets' | transloco }}</h3>
          <div class="flex flex-col gap-6">
            @for (asset of assetKinds; track asset.kind) {
              <div class="rounded-lg border border-app-border p-4">
                <div class="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p class="m-0 font-medium">{{ asset.labelKey | transloco }}</p>
                    <p class="m-0 text-xs text-muted">{{ asset.hintKey | transloco }}</p>
                  </div>
                  @if (assetUrl(asset.kind)) {
                    <img [src]="assetUrl(asset.kind)!" [alt]="asset.kind"
                      class="max-h-[48px] max-w-[96px] rounded border border-app-border object-contain bg-gray-100 dark:bg-gray-800" />
                  } @else {
                    <span class="text-xs text-muted italic">{{ 'branding.usingDefault' | transloco }}</span>
                  }
                </div>
                <div class="flex items-center gap-2">
                  <input #fileInput type="file" [accept]="asset.accept" class="hidden"
                    (change)="onFileChange(asset.kind, fileInput)" />
                  <button mat-stroked-button [disabled]="uploadingKind() === asset.kind"
                    (click)="fileInput.click()">
                    <mat-icon>upload</mat-icon> {{ 'branding.upload' | transloco }}
                  </button>
                  @if (assetUrl(asset.kind)) {
                    <button mat-stroked-button color="warn" [disabled]="deletingKind() === asset.kind"
                      (click)="deleteAsset(asset.kind)">
                      <mat-icon>restore</mat-icon> {{ 'branding.resetToDefault' | transloco }}
                    </button>
                  }
                  @if (uploadingKind() === asset.kind || deletingKind() === asset.kind) {
                    <mat-spinner diameter="20" />
                  }
                </div>
              </div>
            }
          </div>
        </section>

      }
    </div>
  `,
})
export class BrandingComponent implements OnInit {
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private brandingService = inject(BrandingService);

  readonly assetKinds = ASSET_KINDS;

  loading = signal(true);
  loadError = signal(false);
  saving = signal(false);
  uploadingKind = signal<AssetKind | null>(null);
  deletingKind = signal<AssetKind | null>(null);

  private _serverData = signal<BrandingResponse | null>(null);

  form: BrandingForm = {
    productName: '', tagline: '', primaryColor: '#2563eb',
    urlApp: '', urlDemo: '', urlDocs: '', urlLanding: '',
  };

  ngOnInit(): void {
    this.loadBranding();
  }

  assetUrl(kind: AssetKind): string | null {
    return this._serverData()?.assets[kind] ?? null;
  }

  private loadBranding(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.http.get<BrandingResponse>('/api/admin/branding').subscribe({
      next: (res) => {
        this._serverData.set(res);
        this.form = {
          productName: res.productName ?? '',
          tagline: res.tagline ?? '',
          primaryColor: res.primaryColor ?? '#2563eb',
          urlApp: res.urls?.app ?? '',
          urlDemo: res.urls?.demo ?? '',
          urlDocs: res.urls?.docs ?? '',
          urlLanding: res.urls?.landing ?? '',
        };
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  saveText(): void {
    this.saving.set(true);
    const body = {
      productName: this.form.productName.trim(),
      tagline: this.form.tagline.trim(),
      primaryColor: this.form.primaryColor,
      urls: {
        app: this.form.urlApp.trim(),
        demo: this.form.urlDemo.trim(),
        docs: this.form.urlDocs.trim(),
        landing: this.form.urlLanding.trim(),
      },
    };
    this.http.put<unknown>('/api/admin/branding', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open(this.transloco.translate('branding.saved'), 'OK', { duration: 3000 });
        this.brandingService.refresh();
        this.loadBranding();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snack.open(extractMessage(err), 'OK', { duration: 4000 });
      },
    });
  }

  onFileChange(kind: AssetKind, input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 1_048_576) {
      this.snack.open(this.transloco.translate('branding.fileTooLarge'), 'OK', { duration: 4000 });
      input.value = '';
      return;
    }
    this.uploadingKind.set(kind);
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<unknown>(`/api/admin/branding/asset/${kind}`, fd).subscribe({
      next: () => {
        this.uploadingKind.set(null);
        input.value = '';
        this.snack.open(this.transloco.translate('branding.uploaded'), 'OK', { duration: 3000 });
        this.brandingService.refresh();
        this.loadBranding();
      },
      error: (err: unknown) => {
        this.uploadingKind.set(null);
        input.value = '';
        this.snack.open(extractMessage(err), 'OK', { duration: 4000 });
      },
    });
  }

  deleteAsset(kind: AssetKind): void {
    this.deletingKind.set(kind);
    this.http.delete<unknown>(`/api/admin/branding/asset/${kind}`).subscribe({
      next: () => {
        this.deletingKind.set(null);
        this.snack.open(this.transloco.translate('branding.resetDone'), 'OK', { duration: 3000 });
        this.brandingService.refresh();
        this.loadBranding();
      },
      error: (err: unknown) => {
        this.deletingKind.set(null);
        this.snack.open(extractMessage(err), 'OK', { duration: 4000 });
      },
    });
  }
}
```

- [ ] **Step 2: Fix the MatSnackBar import in BrandingComponent**

`MatSnackBar` is a service, not a module — it does not go in `imports: []`. Remove `MatSnackBar` from the `imports` array in the `@Component` decorator. The component already injects it as a service via `inject(MatSnackBar)`. The correct `imports` array is:

```typescript
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslocoModule,
  ],
```

- [ ] **Step 3: Verify syntax**

```bash
cd /Users/momen/Desktop/REPOS/pointer-dashboard/angular
PATH=/opt/homebrew/opt/node@26/bin:$PATH npx tsc --noEmit --project tsconfig.app.json 2>&1 | head -40
```

Expected: Zero TS errors.

---

## Task 4: Add i18n keys for branding page (en + ar)

**Files:**
- Modify: `public/assets/i18n/en.json`
- Modify: `public/assets/i18n/ar.json`

**Interfaces:**
- Produces: All `branding.*` transloco keys used in `BrandingComponent` + `nav.branding` (already added in Task 2 Step 4).

- [ ] **Step 1: Add branding section to en.json**

In `/Users/momen/Desktop/REPOS/pointer-dashboard/angular/public/assets/i18n/en.json`, add the following JSON object as a new top-level key before the closing `}` of the file (after the `"invite"` block):

```json
  "branding": {
    "title": "Branding",
    "loading": "Loading branding settings…",
    "loadError": "Failed to load branding settings.",
    "saved": "Branding saved.",
    "uploaded": "Asset uploaded.",
    "resetDone": "Asset reset to default.",
    "fileTooLarge": "File exceeds 1 MB limit.",
    "sectionText": "Text & Colors",
    "sectionUrls": "Reference URLs",
    "sectionAssets": "Icons & Assets",
    "productName": "Product name",
    "tagline": "Tagline",
    "primaryColor": "Primary color",
    "urlApp": "App URL",
    "urlDemo": "Demo URL",
    "urlDocs": "Docs URL",
    "urlLanding": "Landing URL",
    "save": "Save changes",
    "upload": "Upload",
    "resetToDefault": "Reset to default",
    "usingDefault": "Using bundled default",
    "assetLogo": "Logo (wordmark)",
    "assetLogoHint": "SVG or transparent PNG, ~40 px tall",
    "assetIconSquare": "Icon (square)",
    "assetIconSquareHint": "512 × 512 PNG",
    "assetFavicon": "Favicon",
    "assetFaviconHint": "32 × 32 PNG",
    "assetAppleTouch": "Apple Touch icon",
    "assetAppleTouchHint": "180 × 180 PNG",
    "assetPwa192": "PWA icon 192",
    "assetPwa192Hint": "192 × 192 PNG",
    "assetPwa512": "PWA icon 512",
    "assetPwa512Hint": "512 × 512 PNG"
  }
```

- [ ] **Step 2: Add branding section to ar.json**

In `/Users/momen/Desktop/REPOS/pointer-dashboard/angular/public/assets/i18n/ar.json`, add the following JSON object as a new top-level key before the closing `}` of the file (after the `"invite"` block):

```json
  "branding": {
    "title": "العلامة التجارية",
    "loading": "جارٍ تحميل إعدادات العلامة التجارية…",
    "loadError": "فشل تحميل إعدادات العلامة التجارية.",
    "saved": "تم حفظ العلامة التجارية.",
    "uploaded": "تم رفع الأصل.",
    "resetDone": "تمت إعادة الأصل إلى الافتراضي.",
    "fileTooLarge": "الملف يتجاوز حد 1 ميغابايت.",
    "sectionText": "النصوص والألوان",
    "sectionUrls": "عناوين URL المرجعية",
    "sectionAssets": "الأيقونات والأصول",
    "productName": "اسم المنتج",
    "tagline": "الشعار",
    "primaryColor": "اللون الرئيسي",
    "urlApp": "رابط التطبيق",
    "urlDemo": "رابط النسخة التجريبية",
    "urlDocs": "رابط التوثيق",
    "urlLanding": "رابط الصفحة الرئيسية",
    "save": "حفظ التغييرات",
    "upload": "رفع",
    "resetToDefault": "إعادة إلى الافتراضي",
    "usingDefault": "يستخدم الافتراضي المدمج",
    "assetLogo": "الشعار (wordmark)",
    "assetLogoHint": "SVG أو PNG شفاف، ارتفاع ~40 بكسل",
    "assetIconSquare": "الأيقونة (مربعة)",
    "assetIconSquareHint": "512 × 512 PNG",
    "assetFavicon": "الفافيكون",
    "assetFaviconHint": "32 × 32 PNG",
    "assetAppleTouch": "أيقونة Apple Touch",
    "assetAppleTouchHint": "180 × 180 PNG",
    "assetPwa192": "أيقونة PWA 192",
    "assetPwa192Hint": "192 × 192 PNG",
    "assetPwa512": "أيقونة PWA 512",
    "assetPwa512Hint": "512 × 512 PNG"
  }
```

- [ ] **Step 3: Validate JSON files are valid**

```bash
cd /Users/momen/Desktop/REPOS/pointer-dashboard/angular
/opt/homebrew/opt/node@26/bin/node -e "JSON.parse(require('fs').readFileSync('public/assets/i18n/en.json','utf8')); console.log('en.json OK')"
/opt/homebrew/opt/node@26/bin/node -e "JSON.parse(require('fs').readFileSync('public/assets/i18n/ar.json','utf8')); console.log('ar.json OK')"
```

Expected: `en.json OK` and `ar.json OK`.

---

## Task 5: Build and fix until clean

**Files:**
- Any files with compile errors found during `npm run build`.

- [ ] **Step 1: Run the build**

```bash
cd /Users/momen/Desktop/REPOS/pointer-dashboard/angular
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run build 2>&1
```

- [ ] **Step 2: Triage and fix any errors**

Read each error in the output. Common issues and fixes:

**"Cannot find module '../../core/branding/branding.service'"** — Verify the file exists at `src/app/core/branding/branding.service.ts`.

**"MatSnackBar is not a standalone component or NgModule"** — `MatSnackBar` must NOT be in the `imports` array of `BrandingComponent`. Remove it from `imports` (it's injected as a service via `inject(MatSnackBar)`, not declared as a module).

**"extractMessage is not exported from '../../core/api/extract-message'"** — Check what the module actually exports:
```bash
cat /Users/momen/Desktop/REPOS/pointer-dashboard/angular/src/app/core/api/extract-message.ts
```
Adjust the import to match the actual export name.

**"Property 'assets' does not exist on type..."** — The HTTP interceptor unwraps `data` from the envelope. The `GET /api/admin/branding` response body goes through the interceptor which unwraps `body.data`. So `BrandingResponse` matches what the server puts in `data`. If the interceptor is stripping the wrapper and returning `BrandingResponse` directly, the type annotation is correct. If you get type errors on `res.assets`, add `as unknown as BrandingResponse` to the cast: `this.http.get<unknown>('/api/admin/branding').subscribe({ next: (raw) => { const res = raw as BrandingResponse; ... } })`.

**"Object is possibly null"** — Add null-guards. E.g., `assetUrl(kind: AssetKind): string | null { return this._serverData()?.assets?.[kind] ?? null; }`.

**"Type 'string | null' is not assignable to type 'string'"** — Use `?? ''` fallback on nullable fields.

**Any template binding error** — Check for typos in template variable names (`snav` must be the `#snav` reference from `mat-sidenav`).

- [ ] **Step 3: Rerun build until it passes with zero errors**

```bash
cd /Users/momen/Desktop/REPOS/pointer-dashboard/angular
PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run build 2>&1
```

Expected final output: `✔ Browser application bundle generation complete.` (or equivalent Angular CLI success message) with zero errors.

- [ ] **Step 4: Confirm dist output exists**

```bash
ls /Users/momen/Desktop/REPOS/pointer-dashboard/angular/dist/
```

Expected: `admin-web/` directory present with bundled files.

---

## Self-Review Checklist

**Spec coverage:**
- [x] `GET /api/branding` public fetch on app init → `BrandingService.refresh()` called in `App` constructor.
- [x] `document.title` set to `"<productName> Admin"` → `BrandingService.applyEffects()`.
- [x] Favicon swap → `BrandingService.applyEffects()` sets `<link rel="icon">` href.
- [x] Shell header renders `productName` + `logo` instead of hardcoded "Pointer Admin" → `ShellComponent` uses `branding.productName()` and `branding.logo()` signals.
- [x] Fallback to bundled defaults on fetch failure → `catchError(() => of(DEFAULTS))` in `BrandingService.refresh()`.
- [x] `/branding` route, super-admin only → `app.routes.ts` + `superAdminGuard`.
- [x] Nav item for Branding under super-admin section → `ShellComponent` template.
- [x] Form fields: `productName`, `tagline`, `primaryColor`, `urlApp`, `urlDemo`, `urlDocs`, `urlLanding` → `BrandingComponent` form + `saveText()` calling `PUT /api/admin/branding`.
- [x] 6 per-kind asset uploaders with expected dimensions, previews, upload + reset buttons → `BrandingComponent` asset section.
- [x] `POST /api/admin/branding/asset/{kind}` multipart → `HttpClient.post()` with `FormData`.
- [x] `DELETE /api/admin/branding/asset/{kind}` → `HttpClient.delete()`.
- [x] Refetch `GET /api/admin/branding` after each change → `loadBranding()` called in `next` of each mutation.
- [x] Refresh live branding after admin save/upload → `brandingService.refresh()` called after each mutation.
- [x] en + ar i18n for all new labels → Task 4.
- [x] `npm run build` must pass → Task 5.

**Deviation notes:**
- The generated client `@moamen-ui/pointer-angular@1.0.17` does not export any `BrandingService` or branding `httpResource` functions (the types file shows no branding exports). All branding API calls use raw `HttpClient` consistently — this matches the spec's explicit allowance for multipart via the app's existing HttpClient.
- `header.brand` transloco key is removed from usage in the shell header (replaced by `branding.productName()` signal). The key remains in the JSON files for backwards compatibility (login page may still use `login.title`). The shell header now reads `{{ branding.productName() }} Admin` directly — this means the "Admin" suffix is hardcoded in the template rather than in i18n, which is simpler and consistent with `document.title = "${productName} Admin"` in the service.
