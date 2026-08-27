import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BidiModule } from '@angular/cdk/bidi';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { PreferencesService } from '../../core/prefs/preferences.service';
import { BrandingService } from '../../core/branding/branding.service';
import { InstallGuideService } from '../../shared/install-guide/install-guide.service';
import { ChangePasswordDialogComponent } from '../../shared/change-password-dialog.component';
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
    MatMenuModule,
    MatDividerModule,
    MatDialogModule,
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

      <!-- One profile menu instead of a row of loose header buttons: identity,
           the install guide, theme, language and sign-out all live in here. The
           install-guide dot rides on the trigger so the nudge is still visible
           while the menu is closed. -->
      <!-- Name with the role beneath it, right on the trigger: who you are signed in
           as is worth seeing without opening the menu (Pointer feedback #136). -->
      <button mat-button class="!h-11 !px-2" [matMenuTriggerFor]="profileMenu"
        [attr.aria-label]="'header.account' | transloco">
        <mat-icon>account_circle</mat-icon>
        @if (firstName()) {
          <span class="ms-1 hidden flex-col items-start leading-tight sm:inline-flex">
            <span class="text-[0.9rem] font-medium">{{ firstName() }}</span>
            @if (auth.user()?.roleName) {
              <span class="text-[0.7rem] font-normal text-muted">{{ auth.user()!.roleName }}</span>
            }
          </span>
        }
      </button>

      <mat-menu #profileMenu="matMenu">
        @if (auth.user()) {
          <div class="px-4 py-2 leading-tight" (click)="$event.stopPropagation()">
            <div class="text-[0.9rem] font-semibold">{{ auth.user()!.displayName }}</div>
            <div class="text-[0.78rem] text-muted">{{ auth.user()!.roleName }}</div>
          </div>
          <mat-divider />
        }

        <a mat-menu-item routerLink="/profile">
          <mat-icon>person</mat-icon> {{ 'nav.myProfile' | transloco }}
        </a>

        <button mat-menu-item (click)="openChangePassword()">
          <mat-icon>lock_reset</mat-icon> {{ 'header.changePassword' | transloco }}
        </button>

        <button mat-menu-item (click)="toggleTheme()">
          <mat-icon>{{ prefs.theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
          {{ 'header.theme' | transloco }}:
          {{ (prefs.theme() === 'dark' ? 'header.themeLight' : 'header.themeDark') | transloco }}
        </button>

        <button mat-menu-item (click)="togglePrefsLang()">
          <mat-icon>translate</mat-icon>
          {{ 'header.language' | transloco }}: {{ prefs.language() === 'ar' ? 'English' : 'العربية' }}
        </button>

        <mat-divider />

        <button mat-menu-item (click)="auth.logout()">
          <mat-icon>logout</mat-icon> {{ 'header.signOut' | transloco }}
        </button>
      </mat-menu>
    </mat-toolbar>

    <mat-sidenav-container class="flex-1 overflow-hidden bg-app" [dir]="prefs.language() === 'ar' ? 'rtl' : 'ltr'">
      <mat-sidenav #snav [mode]="isMobile() ? 'over' : 'side'" [opened]="!isMobile()" class="sidenav flex w-[232px] flex-col border-e border-app-border bg-sidebar pt-2">
        <div class="flex h-full flex-col">
        <mat-nav-list class="flex-1" (click)="onNavClick(snav)">
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

        <!-- Installation steps sit at the foot of the nav rather than in the account
             menu: it is a one-off setup task for the workspace, not a personal
             setting. The hint dot lives here too, so it is visible without opening
             anything. -->
        <mat-nav-list class="mt-auto border-t border-app-border pt-2" (click)="onNavClick(snav)">
          <button mat-list-item type="button" class="w-full cursor-pointer text-start"
            (click)="installGuide.open()">
            <mat-icon matListItemIcon>rocket_launch</mat-icon>
            <span matListItemTitle>
              {{ 'install.title' | transloco }}
              @if (installGuide.nothingCollectedYet()) {
                <span class="ms-1.5 inline-block h-2 w-2 rounded-full bg-brand align-middle"></span>
              }
            </span>
          </button>
        </mat-nav-list>
        </div>
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
  branding = inject(BrandingService);
  installGuide = inject(InstallGuideService);
  private dialog = inject(MatDialog);

  /** First word of the display name — "Ahmed" out of "Ahmed Omran". */
  readonly firstName = computed(() => this.auth.user()?.displayName?.trim().split(/\s+/)[0] ?? '');

  constructor() {
    // A workspace admin who is new here — or whose workspace has collected nothing
    // yet — gets the guide opened for them, once. The effect waits for the project
    // list so commentsCount is real rather than a loading 0.
    effect(() => {
      if (this.installGuide.projectsResource.isLoading()) return;
      const user = this.auth.user();
      if (!user) return;
      const shouldOpen = this.installGuide.shouldAutoOpen({
        isAdmin: this.auth.isAdmin(),
        userId: user.id ?? null,
        commentsCount: this.installGuide.commentsCount(),
      });
      if (shouldOpen) this.installGuide.open();
    });
  }

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

  openChangePassword(): void {
    this.dialog.open(ChangePasswordDialogComponent, { width: '400px' });
  }

  togglePrefsLang(): void {
    this.prefs.setLanguage(this.prefs.language() === 'ar' ? 'en' : 'ar');
  }

  toggleTheme(): void {
    this.prefs.setTheme(this.prefs.theme() === 'dark' ? 'light' : 'dark');
  }
}
