import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Pin,
  LayoutDashboard,
  UserCog,
  Users,
  Folder,
  Sun,
  Moon,
  LogOut,
  CircleUserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { usePreferences } from '@/lib/preferences';

const ADMIN_NAV = [
  { to: '/overview', key: 'nav.overview', icon: LayoutDashboard },
  { to: '/roles', key: 'nav.roles', icon: UserCog },
  { to: '/users', key: 'nav.users', icon: Users },
  { to: '/projects', key: 'nav.projects', icon: Folder },
];

export function Shell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const { theme, language, toggleTheme, toggleLanguage } = usePreferences();

  function signOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="z-10 flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-header px-4 shadow-sm">
        <span className="flex items-center gap-2 font-bold">
          <Pin className="h-5 w-5 rotate-45 text-brand" />
          {t('header.brand')}
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
          {t('header.signOut')}
        </Button>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden bg-app">
        <aside className="w-[232px] flex-shrink-0 border-e border-border bg-sidebar py-2">
          <nav className="flex flex-col gap-0.5 px-2.5">
            {/* Admin-only nav items */}
            {isAdmin &&
              ADMIN_NAV.map(({ to, key, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
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

        <main className="h-full flex-1 overflow-y-auto bg-app p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
