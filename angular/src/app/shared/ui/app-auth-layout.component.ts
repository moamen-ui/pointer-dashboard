import { Component, inject } from '@angular/core';
import { BrandingService } from '../../core/branding/branding.service';
import { AppIconComponent } from './app-icon.component';

/**
 * Shared layout for auth pages (login, signup, forgot password, reset password, join).
 * Renders a centered 400px column with:
 * - Brand mark (16px Pin icon rotated 45°, text-brand) + product name (20px/600)
 * - Slot for children (the form)
 * - White canvas background
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [AppIconComponent],
  template: `
    <div class="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div class="flex w-full max-w-[400px] flex-col gap-6">
        <!-- Brand header: 16px icon + 20px/600 name -->
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

        <!-- Form slot -->
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class AppAuthLayoutComponent {
  branding = inject(BrandingService).data;
}
