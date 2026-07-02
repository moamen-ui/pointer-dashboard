import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Pin,
  LayoutDashboard,
  UserCog,
  Users,
  Folder,
  Tags,
  Sun,
  Moon,
  LogOut,
  CircleUserRound,
  Building2,
  Settings,
  Menu,
  CreditCard,
  Paintbrush,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { usePreferences } from '@/lib/preferences';
import { useBranding } from '@/lib/branding';
import { DemoPanel } from '@/components/DemoPanel';

const ADMIN_NAV = [
  { to: '/overview', key: 'nav.overview', icon: LayoutDashboard },
  { to: '/roles', key: 'nav.roles', icon: UserCog },
  { to: '/users', key: 'nav.users', icon: Users },
  { to: '/statuses', key: 'nav.statuses', icon: Tags },
];

// Projects is visible to all authenticated users (admin + non-admin)
const ALL_USER_NAV = [
  { to: '/projects', key: 'nav.projects', icon: Folder },
];

const SUPER_ADMIN_NAV = [
  { to: '/tenants', key: 'nav.tenants', icon: Building2 },
  { to: '/plans', key: 'nav.plans', icon: CreditCard },
  { to: '/settings', key: 'nav.settings', icon: Settings },
  { to: '/branding', key: 'nav.branding', icon: Paintbrush },
];

export function Shell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin, isSuperAdmin, logout } = useAuth();
  const { theme, language, toggleTheme, toggleLanguage } = usePreferences();
  const { branding } = useBranding();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function signOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Demo panel — shown when a demo session exists in sessionStorage */}
      <DemoPanel />
      {/* Header */}
      <header className="z-10 flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-header px-4 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t('header.menu')}
          onClick={() => setSidebarOpen(o => !o)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="flex items-center gap-2 font-bold">
          {branding?.assets?.logo ? (
            <img
              src={branding.assets.logo}
              alt={branding.productName}
              className="h-7 max-w-[120px] object-contain"
            />
          ) : (
            <>
              <Pin className="h-5 w-5 rotate-45 text-brand" />
              {branding?.productName ? `${branding.productName} Admin` : t('header.brand')}
            </>
          )}
        </span>
        <span className="flex-1" />
        {user && (
          <span className="me-2 hidden items-center gap-1.5 text-sm text-muted-foreground sm:inline-flex">
            <CircleUserRound className="h-4 w-4" />
            {user.displayName} · {user.roleName}
          </span>
        )}
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleLanguage}>
          {language === 'ar' ? 'EN' : 'ع'}
        </Button>
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{t('header.signOut')}</span>
        </Button>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden bg-app">
        {/* Backdrop — mobile only, visible when drawer is open */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={cn(
            // shared
            'w-[232px] flex-shrink-0 border-e border-border bg-sidebar py-2',
            // mobile: fixed off-canvas drawer below the header
            'fixed top-14 bottom-0 start-0 z-40 transition-transform',
            // desktop: static panel, always visible, reset transforms
            'md:static md:top-auto md:bottom-auto md:z-auto md:translate-x-0',
            // mobile open/closed — direction-aware slide
            sidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full rtl:translate-x-full',
          )}
        >
          <nav className="flex flex-col gap-0.5 px-2.5">
            {/* Admin-only nav items */}
            {isAdmin &&
              ADMIN_NAV.map(({ to, key, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5',
                      isActive && 'bg-brand-tint font-semibold text-brand',
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span>{t(key)}</span>
                </NavLink>
              ))}

            {/* Projects — visible to all authenticated users */}
            {ALL_USER_NAV.map(({ to, key, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5',
                    isActive && 'bg-brand-tint font-semibold text-brand',
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span>{t(key)}</span>
              </NavLink>
            ))}

            {/* Super-admin-only nav items */}
            {isSuperAdmin &&
              SUPER_ADMIN_NAV.map(({ to, key, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5',
                      isActive && 'bg-brand-tint font-semibold text-brand',
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span>{t(key)}</span>
                </NavLink>
              ))}

            {/* My Profile – visible to all authenticated users */}
            <NavLink
              to="/profile"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5',
                  isActive && 'bg-brand-tint font-semibold text-brand',
                )
              }
            >
              <CircleUserRound className="h-5 w-5" />
              <span>{t('nav.myProfile')}</span>
            </NavLink>
          </nav>
        </aside>

        <main className="h-full min-w-0 flex-1 overflow-auto bg-app p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
