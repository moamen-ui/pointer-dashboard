import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { BidiModule } from '@angular/cdk/bidi';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { PreferencesService } from '../../core/prefs/preferences.service';
import { BrandingService } from '../../core/branding/branding.service';
import { InstallGuideService } from '../../shared/install-guide/install-guide.service';
import { ChangePasswordDialogComponent } from '../../shared/change-password-dialog.component';
import { AppDialogService } from '../../shared/ui/app-dialog.service';
import { DemoPanelComponent } from './demo-panel.component';
import { TourService } from '../../core/tour/tour.service';
import { TourSpotlightComponent } from '../../shared/tour/tour-spotlight.component';
import { AppIconComponent } from '../../shared/ui/app-icon.component';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    BidiModule,
    TranslocoModule,
    DemoPanelComponent,
    TourSpotlightComponent,
    AppIconComponent,
    AppButtonDirective,
  ],
  template: `
    <!-- Header: 48px -->
    <header class="h-12 border-b border-border bg-background px-4 flex items-center gap-3 shrink-0 z-20">
      <!-- Mobile menu button -->
      @if (isMobile()) {
        <button
          appButton
          variant="ghost"
          size="icon"
          (click)="toggleMobileNav()"
          [attr.aria-label]="'header.menu' | transloco"
        >
          <app-icon name="menu" [size]="16"></app-icon>
        </button>
      }

      <!-- Brand -->
      <div class="flex items-center gap-2 text-[14px] font-semibold text-foreground">
        @if (branding.logo()) {
          <img [src]="branding.logo()!" alt="" class="h-[20px] max-w-[120px] object-contain" />
        } @else {
          <app-icon name="pin" [size]="16" class="text-brand rotate-45"></app-icon>
        }
        <span>{{ branding.productName() }} Admin</span>
      </div>

      <span class="flex-1"></span>

      <!-- End side: Install button + Account menu -->
      @if (installGuide.nothingCollectedYet()) {
        <button
          class="hidden sm:inline-flex h-7 px-2.5 rounded-md text-[13px] font-medium inline-flex items-center gap-1.5 bg-brand text-brand-foreground hover:bg-brand-hover transition-colors duration-150"
          (click)="installGuide.open()"
          [attr.aria-label]="'install.title' | transloco"
        >
          <app-icon name="rocket" [size]="16"></app-icon>
          {{ 'install.title' | transloco }}
        </button>
      } @else {
        <button
          appButton
          variant="ghost"
          size="icon"
          type="button"
          class="hidden sm:inline-flex"
          (click)="installGuide.open()"
          [attr.aria-label]="'install.title' | transloco"
          [attr.title]="'install.title' | transloco"
        >
          <app-icon name="rocket" [size]="16"></app-icon>
        </button>
      }

      <!-- Account menu button -->
      <button
        class="flex items-center gap-2 px-2 rounded-md text-[14px] font-medium text-foreground hover:bg-gutter transition-colors h-8"
        (click)="accountMenuOpen.set(!accountMenuOpen())"
        [attr.aria-label]="'header.account' | transloco"
      >
        <app-icon name="circle-user-round" [size]="20"></app-icon>
        @if (firstName()) {
          <span class="hidden sm:inline-flex flex-col items-start leading-tight text-start">
            <span class="text-[14px] font-medium">{{ firstName() }}</span>
            @if (auth.user()?.roleName) {
              <span class="text-[12px] font-normal text-muted-foreground">{{ auth.user()!.roleName }}</span>
            }
          </span>
        }
        <app-icon name="chevron-down" [size]="16" class="text-muted-foreground"></app-icon>
      </button>

      <!-- Account menu dropdown -->
      @if (accountMenuOpen()) {
        <div
          class="absolute top-12 end-4 mt-0 rounded-md border border-border bg-background shadow-menu p-1 z-50 min-w-[180px]"
          (click)="$event.stopPropagation()"
          (document:click)="accountMenuOpen.set(false)"
        >
          @if (auth.user()) {
            <div class="px-3 py-2 text-[14px]">
              <div class="font-semibold text-foreground">{{ auth.user()!.displayName }}</div>
              @if (auth.user()?.roleName) {
                <div class="text-[12px] text-muted-foreground">{{ auth.user()!.roleName }}</div>
              }
            </div>
            <div class="border-t border-border-muted my-1"></div>
          }
          <a
            routerLink="/profile"
            class="flex items-center gap-2 h-8 px-2 rounded-md text-[14px] text-foreground hover:bg-gutter text-start"
            (click)="closeMenus()"
          >
            <app-icon name="user-round" [size]="16"></app-icon>
            {{ 'nav.myProfile' | transloco }}
          </a>
          <button
            type="button"
            class="w-full flex items-center gap-2 h-8 px-2 rounded-md text-[14px] text-foreground hover:bg-gutter text-start"
            (click)="openChangePassword(); closeMenus()"
          >
            <app-icon name="lock" [size]="16"></app-icon>
            {{ 'header.changePassword' | transloco }}
          </button>
          <button
            type="button"
            class="w-full flex items-center gap-2 h-8 px-2 rounded-md text-[14px] text-foreground hover:bg-gutter text-start"
            (click)="toggleTheme(); closeMenus()"
          >
            <app-icon [name]="prefs.theme() === 'dark' ? 'sun' : 'moon'" [size]="16"></app-icon>
            {{ 'header.theme' | transloco }}: {{ (prefs.theme() === 'dark' ? 'header.themeLight' : 'header.themeDark') | transloco }}
          </button>
          <button
            type="button"
            class="w-full flex items-center gap-2 h-8 px-2 rounded-md text-[14px] text-foreground hover:bg-gutter text-start"
            (click)="togglePrefsLang(); closeMenus()"
          >
            <app-icon name="languages" [size]="16"></app-icon>
            {{ 'header.language' | transloco }}: {{ prefs.language() === 'ar' ? 'English' : 'العربية' }}
          </button>
          <div class="border-t border-border-muted my-1"></div>
          <button
            type="button"
            class="w-full flex items-center gap-2 h-8 px-2 rounded-md text-[14px] text-state-danger hover:bg-state-danger-tint text-start"
            (click)="auth.logout()"
          >
            <app-icon name="log-out" [size]="16"></app-icon>
            {{ 'header.signOut' | transloco }}
          </button>
        </div>
      }
    </header>

    <!-- Main layout: rail + content -->
    <div class="flex flex-1 overflow-hidden" [dir]="prefs.language() === 'ar' ? 'rtl' : 'ltr'">
      <!-- Sidebar rail -->
      <nav
        class="w-[240px] shrink-0 border-e border-border bg-gutter flex flex-col py-3 overflow-y-auto"
        [class.hidden]="isMobile() && !mobileNavOpen()"
        [class.fixed]="isMobile()"
        [class.inset-12]="isMobile()"
        [class.w-screen]="isMobile()"
        [class.max-w-xs]="isMobile()"
        [class.z-40]="isMobile()"
      >
        <!-- Navigation items (same order and icons as the React and Vue shells) -->
        <div class="flex-1 flex flex-col gap-0.5 px-2">
          @if (auth.isAdmin() && !auth.isQuickAccess()) {
            <a
              routerLink="/overview"
              routerLinkActive="active-nav"
              class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground hover:bg-gutter-strong hover:text-foreground transition-colors"
              (click)="isMobile() && closeMobileNav()"
            >
              <app-icon name="layout-dashboard" [size]="16"></app-icon>
              <span>{{ 'nav.overview' | transloco }}</span>
            </a>
            <a
              routerLink="/roles"
              routerLinkActive="active-nav"
              class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground hover:bg-gutter-strong hover:text-foreground transition-colors"
              (click)="isMobile() && closeMobileNav()"
            >
              <app-icon name="user-cog" [size]="16"></app-icon>
              <span>{{ 'nav.roles' | transloco }}</span>
            </a>
            <a
              routerLink="/users"
              routerLinkActive="active-nav"
              class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground hover:bg-gutter-strong hover:text-foreground transition-colors"
              (click)="isMobile() && closeMobileNav()"
            >
              <app-icon name="users" [size]="16"></app-icon>
              <span>{{ 'nav.users' | transloco }}</span>
            </a>
            <a
              routerLink="/statuses"
              routerLinkActive="active-nav"
              class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground hover:bg-gutter-strong hover:text-foreground transition-colors"
              (click)="isMobile() && closeMobileNav()"
            >
              <app-icon name="tags" [size]="16"></app-icon>
              <span>{{ 'nav.statuses' | transloco }}</span>
            </a>
            <a
              routerLink="/environments"
              routerLinkActive="active-nav"
              class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground hover:bg-gutter-strong hover:text-foreground transition-colors"
              data-tour="nav-environments"
              (click)="isMobile() && closeMobileNav()"
            >
              <app-icon name="globe" [size]="16"></app-icon>
              <span>{{ 'nav.environments' | transloco }}</span>
            </a>
            <a
              routerLink="/settings"
              routerLinkActive="active-nav"
              class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground hover:bg-gutter-strong hover:text-foreground transition-colors"
              (click)="isMobile() && closeMobileNav()"
            >
              <app-icon name="settings" [size]="16"></app-icon>
              <span>{{ 'nav.settings' | transloco }}</span>
            </a>
            <div class="my-2 border-t border-border-muted"></div>
          }
            <a
              routerLink="/projects"
              routerLinkActive="active-nav"
              class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground hover:bg-gutter-strong hover:text-foreground transition-colors"
              data-tour="nav-projects"
              (click)="isMobile() && closeMobileNav()"
            >
              <app-icon name="folder" [size]="16"></app-icon>
              <span>{{ 'nav.projects' | transloco }}</span>
            </a>
          @if (auth.isSuperAdmin()) {
            <div class="my-2 border-t border-border-muted"></div>
            <a
              routerLink="/tenants"
              routerLinkActive="active-nav"
              class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground hover:bg-gutter-strong hover:text-foreground transition-colors"
              (click)="isMobile() && closeMobileNav()"
            >
              <app-icon name="building-2" [size]="16"></app-icon>
              <span>{{ 'nav.tenants' | transloco }}</span>
            </a>
            <a
              routerLink="/plans"
              routerLinkActive="active-nav"
              class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground hover:bg-gutter-strong hover:text-foreground transition-colors"
              (click)="isMobile() && closeMobileNav()"
            >
              <app-icon name="credit-card" [size]="16"></app-icon>
              <span>{{ 'nav.plans' | transloco }}</span>
            </a>
            <a
              routerLink="/branding"
              routerLinkActive="active-nav"
              class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground hover:bg-gutter-strong hover:text-foreground transition-colors"
              (click)="isMobile() && closeMobileNav()"
            >
              <app-icon name="paintbrush" [size]="16"></app-icon>
              <span>{{ 'nav.branding' | transloco }}</span>
            </a>
          }
          <div class="my-2 border-t border-border-muted"></div>
            <a
              routerLink="/profile"
              routerLinkActive="active-nav"
              class="h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground hover:bg-gutter-strong hover:text-foreground transition-colors"
              data-tour="nav-profile"
              (click)="isMobile() && closeMobileNav()"
            >
              <app-icon name="circle-user-round" [size]="16"></app-icon>
              <span>{{ 'nav.myProfile' | transloco }}</span>
            </a>
        </div>

        <!-- Footer -->
        <div class="border-t border-border-muted pt-2 space-y-1 px-2">
          <button
            type="button"
            class="w-full h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground hover:bg-gutter-strong hover:text-foreground transition-colors text-start"
            (click)="tour.startTour(); closeMenus()"
            data-tour="tour-trigger"
          >
            <app-icon name="compass" [size]="16"></app-icon>
            <span>{{ 'tour.quickTour' | transloco }}</span>
          </button>
          <button
            type="button"
            class="w-full h-8 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground hover:bg-gutter-strong hover:text-foreground transition-colors text-start relative"
            (click)="installGuide.open(); closeMenus()"
            data-tour="nav-install-guide"
          >
            <app-icon name="rocket" [size]="16"></app-icon>
            <span>{{ 'install.title' | transloco }}</span>
            @if (installGuide.nothingCollectedYet()) {
              <span class="h-1.5 w-1.5 rounded-full bg-brand absolute end-3"></span>
            }
          </button>
        </div>
      </nav>

      <!-- Mobile nav overlay -->
      @if (isMobile() && mobileNavOpen()) {
        <div
          class="fixed inset-0 bg-overlay/50 z-30"
          (click)="closeMobileNav()"
        ></div>
      }

      <!-- Main content area -->
      <main class="flex-1 min-w-0 overflow-auto bg-background p-6">
        <div class="mx-auto w-full max-w-[1120px]">
          <app-demo-panel />
          <router-outlet />
          <app-tour-spotlight />
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    :host ::ng-deep .active-nav {
      background-color: var(--brand-tint);
      color: var(--brand);
      font-weight: 600;
    }

    @media (max-width: 768px) {
      nav {
        left: 0;
        right: 0;
        top: 48px;
        bottom: 0;
      }
    }
  `],
})
export class ShellComponent {
  auth = inject(AuthService);
  prefs = inject(PreferencesService);
  branding = inject(BrandingService);
  installGuide = inject(InstallGuideService);
  tour = inject(TourService);
  private appDialog = inject(AppDialogService);

  accountMenuOpen = signal(false);
  mobileNavOpen = signal(false);

  readonly firstName = computed(() => this.auth.user()?.displayName?.trim().split(/\s+/)[0] ?? '');

  isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767.98px)')
      .pipe(map((r) => r.matches)),
    { initialValue: typeof window !== 'undefined' && window.innerWidth < 768 },
  );

  constructor() {
    effect(() => {
      if (this.installGuide.projectsResource.isLoading()) return;
      const user = this.auth.user();
      if (!user) return;
      const shouldOpen = this.installGuide.shouldAutoOpen({
        isAdmin: this.auth.isAdmin(),
        isSuperAdmin: this.auth.isSuperAdmin(),
        userId: user.id ?? null,
        commentsCount: this.installGuide.commentsCount(),
      });
      if (shouldOpen) this.installGuide.open();
    });
  }

  toggleMobileNav(): void {
    this.mobileNavOpen.update(v => !v);
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  closeMenus(): void {
    this.accountMenuOpen.set(false);
    this.mobileNavOpen.set(false);
  }

  openChangePassword(): void {
    this.appDialog.openRef(ChangePasswordDialogComponent, { width: 'w-[min(440px,calc(100vw-32px))]' });
  }

  togglePrefsLang(): void {
    this.prefs.setLanguage(this.prefs.language() === 'ar' ? 'en' : 'ar');
  }

  toggleTheme(): void {
    this.prefs.setTheme(this.prefs.theme() === 'dark' ? 'light' : 'dark');
  }
}
