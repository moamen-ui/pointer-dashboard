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
  ShieldCheck,
  Menu,
  CreditCard,
  Paintbrush,
  Rocket,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useGetApiAuthMe, usePostApiMeVerificationResend } from '@moamen-ui/pointer-react';
import { useAuth } from '@/lib/auth';
import { usePreferences } from '@/lib/preferences';
import { useBranding } from '@/lib/branding';
import { extractMessage } from '@/lib/error';
import { isPlaceholderWorkspaceName } from '@/lib/workspace';
import { DemoPanel } from '@/components/DemoPanel';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { VerificationBanner } from '@/components/VerificationBanner';
import { NotificationsBell } from '@/components/NotificationsBell';
import { InstallGuideProvider, useInstallGuide } from '@/components/InstallGuide';
import { useToast } from '@/components/ui/toast';
import {
  IMPERSONATION_ENDED_EVENT,
  VERIFICATION_REQUIRED_EVENT,
  type ImpersonationEndedReason,
  type VerificationRequiredDetail,
} from '@/lib/api';

const ADMIN_NAV = [
  { to: '/overview', key: 'nav.overview', icon: LayoutDashboard },
  { to: '/roles', key: 'nav.roles', icon: UserCog },
  { to: '/users', key: 'nav.users', icon: Users },
  { to: '/environments', key: 'nav.environments', icon: Globe },
  { to: '/settings', key: 'nav.settings', icon: Settings },
  { to: '/security-log', key: 'nav.securityLog', icon: ShieldCheck },
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
  const { user, isAdmin, isSuperAdmin, isImpersonating, endImpersonation, switchWorkspace, logout } = useAuth();
  const { theme, language, toggleTheme, toggleLanguage } = usePreferences();
  const { branding } = useBranding();
  const { data: me } = useGetApiAuthMe({ query: { staleTime: 5 * 60_000 } });
  const installGuide = useInstallGuide();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // DB-13 §11.2/§11.3: a 401 that reaches here while impersonating is either the scope fence
  // refusing a write (session still live — toast only) or the session having actually ended/
  // expired (restore the operator's token and send them back to Tenants). Dispatched from the
  // axios response interceptor (lib/api.ts), which cannot itself hold auth state or navigate.
  useEffect(() => {
    function onImpersonationEnded(e: Event) {
      const reason = (e as CustomEvent<ImpersonationEndedReason>).detail;
      if (reason === 'readonly') {
        toast(t('impersonation.readOnlyToast'), 'warning');
        return;
      }
      void endImpersonation().finally(() => {
        toast(t('impersonation.endedToast'), 'warning');
        navigate('/tenants', { replace: true });
      });
    }
    window.addEventListener(IMPERSONATION_ENDED_EVENT, onImpersonationEnded);
    return () => window.removeEventListener(IMPERSONATION_ENDED_EVENT, onImpersonationEnded);
  }, [endImpersonation, navigate, t, toast]);

  // DB-14 §11.2: an admin write refused by RequireVerifiedEmailFilter (403 + header) is
  // dispatched here from the axios interceptor (lib/api.ts), which has no toast/mutation
  // access of its own. Show the server's message with a "Resend link" action, reusing the
  // same resend mutation the banner below uses.
  const resendMut = usePostApiMeVerificationResend({
    mutation: {
      onError: (e: unknown) => {
        const status = (e as { response?: { status?: number } })?.response?.status;
        toast(status === 429 ? t('common.tooManyRequests') : extractMessage(e), 'warning');
      },
      onSuccess: () => toast(t('verification.resendSent'), 'success'),
    },
  });
  useEffect(() => {
    function onVerificationRequired(e: Event) {
      const { message } = (e as CustomEvent<VerificationRequiredDetail>).detail;
      toast(message, 'warning', {
        label: t('verification.resendLink'),
        onClick: () => resendMut.mutate(),
      });
    }
    window.addEventListener(VERIFICATION_REQUIRED_EVENT, onVerificationRequired);
    return () => window.removeEventListener(VERIFICATION_REQUIRED_EVENT, onVerificationRequired);
  }, [resendMut, t, toast]);

  const tenantName = me?.tenantName ?? user?.tenantName ?? null;

  // DB-11b: several active memberships → a workspace switcher next to the tenant name.
  // Hidden for super admins (`workspaces` is empty for them) and for single-membership
  // users, for whom there is nothing to switch between.
  const memberships = me?.workspaces ?? [];
  const showWorkspaceSwitcher = memberships.length > 1;
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  async function onSwitchWorkspace(workspaceId: string | undefined) {
    if (!workspaceId || workspaceId === me?.workspaceId || switchingId) return;
    setSwitchingId(workspaceId);
    setSwitchError(null);
    try {
      // No selectionToken: this call rides the already-stored session token via the
      // request interceptor, unlike the login picker's one-off override.
      await switchWorkspace(workspaceId);
      navigate('/', { replace: true });
    } catch (err) {
      setSwitchError(extractMessage(err) || t('login.failed'));
    } finally {
      setSwitchingId(null);
    }
  }

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
      {/* Impersonation banner (DB-13) — above the demo panel; the two are mutually exclusive in
          practice (a super admin's own account never runs a demo session) but nothing enforces
          that, so stacking order is just "most-privileged-state-first". */}
      <ImpersonationBanner />

      {/* Verification banner (DB-14) — loud only for the identities the gate actually blocks
          (`emailVerificationRequired`); hidden for super admins, verified/demo/passwordless
          identities and non-admin stakeholders (server-computed, §3.5). */}
      <VerificationBanner me={me} />

      {/* Demo panel — DB-17: countdown source of truth is `me.demoExpiresAt` (survives
          reloads/other tabs), same `me` query VerificationBanner reads above. */}
      <DemoPanel me={me} />

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
          {tenantName && !showWorkspaceSwitcher && (
            <span className="hidden min-w-0 truncate text-[14px] text-muted-foreground sm:inline" title={tenantName}>
              <span aria-hidden="true" className="me-2">·</span>
              {tenantName}
            </span>
          )}

          {tenantName && showWorkspaceSwitcher && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="hidden min-w-0 items-center gap-1 truncate text-[14px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
                  aria-label={`${t('header.switchWorkspace')}: ${tenantName}`}
                >
                  <span aria-hidden="true" className="me-1">·</span>
                  <span className="truncate" title={tenantName}>
                    {tenantName}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[220px]">
                <DropdownMenuLabel>{t('header.switchWorkspace')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {switchError && (
                  <p className="px-2 py-1 text-[12px] text-state-danger">{switchError}</p>
                )}
                {switchingId && (
                  <p className="px-2 py-1 text-[12px] text-muted-foreground" aria-live="polite">
                    {t('login.switching')}
                  </p>
                )}
                {memberships.map((w) => {
                  const name = isPlaceholderWorkspaceName(w.name)
                    ? t('login.unnamedWorkspace')
                    : w.name;
                  const isCurrent = w.workspaceId === me?.workspaceId;
                  return (
                    <DropdownMenuItem
                      key={w.workspaceId}
                      disabled={switchingId !== null || isCurrent}
                      onSelect={() => onSwitchWorkspace(w.workspaceId)}
                      className="justify-between gap-2"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{name}</span>
                        {w.roleName && (
                          <span className="truncate text-[12px] text-muted-foreground">
                            {w.roleName}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {w.isHome && (
                          <Badge variant="neutral" hideGlyph>
                            {t('login.homeBadge')}
                          </Badge>
                        )}
                        {isCurrent && <Check className="h-4 w-4 text-brand" aria-hidden="true" />}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <span className="flex-1" />

        {/* End side: Notifications, Install steps button or ghost icon, Account menu */}
        <NotificationsBell />

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

            {/* Super-admin nav - with separator. Hidden while impersonating: the active token is
                scoped to the target workspace, not the platform, so every one of these routes
                would 403 — `isSuperAdmin` here still reflects the operator's own real profile
                (deliberately left untouched by beginImpersonation), so it alone can't gate this. */}
            {isSuperAdmin && !isImpersonating && (
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
