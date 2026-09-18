import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Pin,
  LayoutDashboard,
  UserCog,
  Users,
  Folder,
  MessageSquare,
  Tags,
  Globe,
  Sun,
  Moon,
  LogOut,
  CircleUserRound,
  UserRound,
  Languages,
  Building2,
  Settings,
  Menu,
  CreditCard,
  Paintbrush,
  Rocket,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { usePreferences } from '@/lib/preferences';
import { useBranding } from '@/lib/branding';
import { DemoPanel } from '@/components/DemoPanel';
import { NotificationsBell } from '@/components/NotificationsBell';
import { InstallGuideProvider, useInstallGuide } from '@/components/InstallGuide';

const ADMIN_NAV = [
  { to: '/overview', key: 'nav.overview', icon: LayoutDashboard },
  { to: '/roles', key: 'nav.roles', icon: UserCog },
  { to: '/users', key: 'nav.users', icon: Users },
  { to: '/environments', key: 'nav.environments', icon: Globe },
  { to: '/settings', key: 'nav.settings', icon: Settings },
];

// Projects and Comments are visible to all authenticated users (admin + non-admin) —
// comments are project-scoped feedback a stakeholder can also read/reply to, same tier
// as Projects, so it renders right after it. Note: the ADMIN_NAV group (including
// Environments) still renders above this group for admins, so the on-screen order for
// them is …Environments, Settings, Projects, Comments — not strictly Projects-then-
// -Environments; see the work order's "between Projects and Environments" note.
const ALL_USER_NAV = [
  { to: '/projects', key: 'nav.projects', icon: Folder },
  { to: '/comments', key: 'nav.comments', icon: MessageSquare },
];

const SUPER_ADMIN_NAV = [
  { to: '/tenants', key: 'nav.tenants', icon: Building2 },
  { to: '/plans', key: 'nav.plans', icon: CreditCard },
  { to: '/branding', key: 'nav.branding', icon: Paintbrush },
  { to: '/statuses', key: 'nav.statuses', icon: Tags },
];

export function Shell() {
  return (
    <InstallGuideProvider>
      <ShellLayout />
    </InstallGuideProvider>
  );
}

function ShellLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, isSuperAdmin, logout } = useAuth();
  const { theme, language, toggleTheme, toggleLanguage } = usePreferences();
  const { branding } = useBranding();
  const installGuide = useInstallGuide();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Belt-and-braces: the drawer already closes on an explicit nav-link click, but
  // this also covers programmatic navigation (redirects).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const firstName = user?.displayName?.trim().split(/\s+/)[0] ?? '';

  function signOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Demo panel */}
      <DemoPanel />

      {/* Header: h-12, no shadow, hairline bottom */}
      <header className="h-12 border-b border-border bg-background px-4 flex items-center gap-3 z-10 flex-shrink-0">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t('header.menu')}
          onClick={() => setSidebarOpen(o => !o)}
        >
          <Menu className="h-4 w-4" />
        </Button>

        {/* Brand: 16px pin icon + product name 14px/600 — truncates so a long
            white-label product name never pushes the end-side controls off a
            360px header (DESIGN.md target: "header items fit at 360px"). */}
        <div className="flex min-w-0 items-center gap-2">
          {branding?.assets?.logo ? (
            <img
              src={branding.assets.logo}
              alt={branding.productName}
              className="h-6 max-w-[120px] shrink-0 object-contain"
            />
          ) : (
            <>
              <Pin className="h-4 w-4 shrink-0 rotate-45 text-brand" />
              <span className="truncate text-[14px] font-semibold text-foreground">
                {branding?.productName ? `${branding.productName} Admin` : t('header.brand')}
              </span>
            </>
          )}
        </div>

        <span className="flex-1" />

        {/* End side: Notifications, Install steps button or ghost icon, Account menu */}
        {isAdmin && <NotificationsBell />}

        {installGuide.nothingCollectedYet ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => installGuide.open()}
            className="flex items-center gap-1.5"
          >
            <Rocket className="h-4 w-4" />
            <span>{t('install.title')}</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => installGuide.open()}
          >
            <Rocket className="h-4 w-4" />
          </Button>
        )}

        {/* Account menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-1.5 px-2"
              aria-label={t('header.account')}
            >
              <CircleUserRound className="h-5 w-5" />
              {firstName && (
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-[14px] font-medium leading-none">{firstName}</span>
                  {user?.roleName && (
                    <span className="text-[12px] text-muted-foreground leading-none">
                      {user.roleName}
                    </span>
                  )}
                </div>
              )}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {user && (
              <>
                <div className="px-2 py-1.5">
                  <div className="text-[14px] font-medium">{user.displayName}</div>
                  <div className="text-[12px] text-muted-foreground">{user.roleName}</div>
                </div>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem onSelect={() => navigate('/profile')}>
              <UserRound className="h-4 w-4" />
              {t('nav.myProfile')}
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {t('header.theme')}: {theme === 'dark' ? t('header.themeLight') : t('header.themeDark')}
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={toggleLanguage}>
              <Languages className="h-4 w-4" />
              {t('header.language')}: {language === 'ar' ? 'English' : 'العربية'}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={signOut}>
              <LogOut className="h-4 w-4" />
              {t('header.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Body: rail + main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-overlay md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Rail: w-[240px], bg-gutter, hairline end edge, flex-col py-3 */}
        <aside
          className={cn(
            'w-[240px] shrink-0 border-e border-border bg-gutter flex flex-col py-3',
            // Below md the rail becomes an off-canvas drawer over the overlay backdrop — a
            // floating layer in the same family as a dialog (they share the overlay token), so
            // it earns the dialog shadow here. At rest on desktop it stays flat, per the rail's
            // own no-shadow rule.
            'max-md:fixed max-md:top-12 max-md:bottom-0 max-md:start-0 max-md:z-40 max-md:shadow-dialog max-md:transition-transform',
            'md:static md:top-auto md:z-auto md:translate-x-0',
            sidebarOpen
              ? 'max-md:translate-x-0'
              : 'max-md:-translate-x-full max-md:rtl:translate-x-full',
          )}
        >
          <nav className="flex-1 flex flex-col">
            {/* Admin nav */}
            {isAdmin && (
              <div className="space-y-0">
                {ADMIN_NAV.map(({ to, key, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'h-8 max-md:h-11 mx-2 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground',
                        isActive && 'bg-brand-tint text-brand font-semibold',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t(key)}</span>
                  </NavLink>
                ))}
              </div>
            )}

            {/* Projects (visible to all) - with separator */}
            <div className={cn('space-y-0', isAdmin && 'my-2 border-t border-border-muted pt-2')}>
              {ALL_USER_NAV.map(({ to, key, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'h-8 max-md:h-11 mx-2 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground',
                      isActive && 'bg-brand-tint text-brand font-semibold',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(key)}</span>
                </NavLink>
              ))}
            </div>

            {/* Super-admin nav - with separator */}
            {isSuperAdmin && (
              <div className="my-2 border-t border-border-muted pt-2 space-y-0">
                {SUPER_ADMIN_NAV.map(({ to, key, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'h-8 max-md:h-11 mx-2 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground',
                        isActive && 'bg-brand-tint text-brand font-semibold',
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t(key)}</span>
                  </NavLink>
                ))}
              </div>
            )}

            {/* My Profile - with separator */}
            <div className={cn('my-2 border-t border-border-muted pt-2 space-y-0', (!isAdmin && !isSuperAdmin) && 'my-0 border-t-0 pt-0')}>
              <NavLink
                to="/profile"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'h-8 max-md:h-11 mx-2 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground',
                    isActive && 'bg-brand-tint text-brand font-semibold',
                  )
                }
              >
                <CircleUserRound className="h-4 w-4" />
                <span>{t('nav.myProfile')}</span>
              </NavLink>
            </div>
          </nav>

          {/* Footer: border-t, Installation steps */}
          <div className="mt-auto border-t border-border-muted pt-2 px-2 flex flex-col gap-0">
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                installGuide.open();
              }}
              className="h-8 max-md:h-11 px-3 rounded-md flex items-center gap-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-gutter-strong hover:text-foreground"
            >
              <Rocket className="h-4 w-4" />
              <span>{t('install.title')}</span>
              {installGuide.nothingCollectedYet && (
                <span className="h-1.5 w-1.5 rounded-full bg-brand ms-auto" />
              )}
            </button>
          </div>
        </aside>

        {/* Main: flex-1, overflow-auto, bg-background, p-6, inner max-w-[1120px].
            overflow-x-clip is a belt-and-braces guard: the page itself should
            never need to scroll horizontally (DESIGN.md), this just makes sure a
            stray wide child can't force it to. */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-clip bg-background p-6">
          <div className="mx-auto w-full min-w-0 max-w-[1120px] ms-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
