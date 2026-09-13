import { type ReactNode } from 'react';
import { Pin, Sun, Moon, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBranding } from '@/lib/branding';
import { usePreferences } from '@/lib/preferences';
import { Button } from '@/components/ui/button';

/**
 * Shared layout for auth pages (login, signup, forgot password, reset password, join).
 * Renders a centered 400px column with:
 * - Brand mark (16px Pin icon rotated 45°, text-brand) + product name (20px/600)
 * - Theme + language toggles (only account-level controls reachable before sign-in)
 * - Slot for children (the form)
 * - White canvas background
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { branding } = useBranding();
  const { t } = useTranslation();
  const { theme, toggleTheme, toggleLanguage } = usePreferences();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        {/* Brand header: 16px icon + 20px/600 name, toggles at the end */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {branding?.assets?.logo ? (
              <img
                src={branding.assets.logo}
                alt={branding.productName}
                className="h-6 max-w-[120px] object-contain"
              />
            ) : (
              <>
                <Pin className="h-4 w-4 rotate-45 text-brand" />
                <span className="text-[20px] font-semibold text-foreground">
                  {branding?.productName ? `${branding.productName} Admin` : 'Pointer Admin'}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('header.theme')}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('header.language')}
              onClick={toggleLanguage}
            >
              <Languages className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Form slot */}
        {children}
      </div>
    </div>
  );
}
