import { type ReactNode } from 'react';
import { Pin } from 'lucide-react';
import { useBranding } from '@/lib/branding';

/**
 * Shared layout for auth pages (login, signup, forgot password, reset password, join).
 * Renders a centered 400px column with:
 * - Brand mark (16px Pin icon rotated 45°, text-brand) + product name (20px/600)
 * - Slot for children (the form)
 * - White canvas background
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { branding } = useBranding();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        {/* Brand header: 16px icon + 20px/600 name */}
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

        {/* Form slot */}
        {children}
      </div>
    </div>
  );
}
