import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { SettingsService, getApiAdminSettingsResource } from '@moamen-ui/pointer-angular';
import type { SettingsResponse } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatSlideToggleModule,
    TranslocoModule,
  ],
  template: `
    <div class="p-6">
      <h2 class="m-0 mb-4 text-[1.5em] font-bold">{{ 'settings.title' | transloco }}</h2>

      @if (settingsResource.error()) {
        <p class="text-red-500">{{ 'settings.loadError' | transloco }}</p>
      } @else if (settingsResource.isLoading()) {
        <p class="text-muted">{{ 'settings.loading' | transloco }}</p>
      } @else {
        <mat-card class="max-w-xl p-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="font-medium">{{ 'settings.signupEnabled' | transloco }}</div>
              <div class="text-[0.85rem] text-muted">{{ 'settings.signupEnabledHint' | transloco }}</div>
            </div>
            <mat-slide-toggle
              [checked]="signupEnabled()"
              (change)="toggleSignup($event.checked)"
            />
          </div>
        </mat-card>
      }
    </div>
  `,
})
export class SettingsComponent {
  private settingsService = inject(SettingsService);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);

  settingsResource = getApiAdminSettingsResource();
  // The HTTP interceptor unwraps the API envelope, so the runtime value is SettingsResponse.
  settingsValue = computed(() => this.settingsResource.value() as unknown as SettingsResponse | undefined);
  signupEnabled = computed(() => this.settingsValue()?.scopedAdminSignupEnabled ?? false);

  toggleSignup(value: boolean) {
    this.settingsService.putApiAdminSettings({ scopedAdminSignupEnabled: value }).subscribe({
      next: () => {
        this.settingsResource.reload();
        this.snack.open(this.transloco.translate('settings.saved'), 'OK', { duration: 3000 });
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }
}
