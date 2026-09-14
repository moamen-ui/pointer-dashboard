import { Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { BrandingService } from '../../core/branding/branding.service';
import { PreferencesService } from '../../core/prefs/preferences.service';
import { AppIconComponent } from './app-icon.component';
import { AppButtonDirective } from './app-button.directive';

/**
 * Shared layout for auth pages (login, signup, forgot password, reset password, join).
 * Renders a centered 400px column with:
 * - Brand mark (16px Pin icon rotated 45°, text-brand) + product name (20px/600)
 * - Theme + language toggles (only account-level controls reachable before sign-in)
 * - Slot for children (the form)
 * - White canvas background
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [AppIconComponent, AppButtonDirective, TranslocoModule],
  template: `
    <div class="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div class="flex w-full max-w-[400px] flex-col gap-6">
        <!-- Brand header: 16px icon + 20px/600 name, toggles at the end -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            @if (branding().assets?.logo) {
              <img
                [src]="branding().assets.logo"
                [alt]="branding().productName"
                class="h-6 max-w-[120px] object-contain"
              />
            } @else {
              <app-icon
                name="pin"
                [size]="16"
                class="text-brand"
                style="transform: rotate(45deg);"
              ></app-icon>
              <span class="text-[20px] font-semibold text-foreground">
                {{ branding().productName ? branding().productName + ' Admin' : 'Pointer Admin' }}
              </span>
            }
          </div>

          <div class="flex items-center gap-1">
            <button
              appButton
              variant="ghost"
              size="icon"
              type="button"
              [attr.aria-label]="'header.theme' | transloco"
              (click)="toggleTheme()"
            >
              <app-icon [name]="prefs.theme() === 'dark' ? 'sun' : 'moon'" [size]="16"></app-icon>
            </button>
            <button
              appButton
              variant="ghost"
              size="icon"
              type="button"
              [attr.aria-label]="'header.language' | transloco"
              (click)="toggleLanguage()"
            >
              <app-icon name="languages" [size]="16"></app-icon>
            </button>
          </div>
        </div>

        <!-- Form slot -->
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class AppAuthLayoutComponent {
  branding = inject(BrandingService).data;
  prefs = inject(PreferencesService);

  toggleTheme(): void {
    this.prefs.setTheme(this.prefs.theme() === 'dark' ? 'light' : 'dark');
  }

  toggleLanguage(): void {
    this.prefs.setLanguage(this.prefs.language() === 'ar' ? 'en' : 'ar');
  }
}
