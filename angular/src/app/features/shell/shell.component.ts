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
        <mat-icon class="rotate-45 text-brand">push_pin</mat-icon>
        {{ 'header.brand' | transloco }}
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
            <a mat-list-item routerLink="/projects" routerLinkActive="active-link">
              <mat-icon matListItemIcon>folder</mat-icon>
              <span matListItemTitle>{{ 'nav.projects' | transloco }}</span>
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
            <a mat-list-item routerLink="/settings" routerLinkActive="active-link">
              <mat-icon matListItemIcon>settings</mat-icon>
              <span matListItemTitle>{{ 'nav.settings' | transloco }}</span>
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
  // Layout host + nav-list styling that reaches into Angular Material's internal
  // DOM (.mat-mdc-list-item) is kept as scoped CSS — Tailwind utilities on the
  // template can't target Material's generated inner elements. Colors still use
  // the shared theme tokens so light/dark stays consistent.
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

  // True below the md breakpoint — drives the off-canvas drawer + hamburger.
  isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767.98px)')
      .pipe(map((r) => r.matches)),
    { initialValue: typeof window !== 'undefined' && window.innerWidth < 768 },
  );

  // On mobile, tapping a nav link closes the drawer (clicks bubble up from the links).
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
