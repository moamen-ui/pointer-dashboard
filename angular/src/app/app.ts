import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { PreferencesService } from './core/prefs/preferences.service';
import { BrandingService } from './core/branding/branding.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {
  constructor() {
    const auth = inject(AuthService);
    const prefs = inject(PreferencesService);
    const branding = inject(BrandingService);
    prefs.init(auth.user() ?? undefined);
    branding.refresh();
  }
}
