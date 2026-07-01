import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
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
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
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
        <div class="flex max-w-2xl flex-col gap-6">

          <!-- Access section -->
          <mat-card class="p-4">
            <h3 class="m-0 mb-4 text-base font-semibold">{{ 'settings.accessSection' | transloco }}</h3>
            <div class="flex items-center justify-between gap-4">
              <div>
                <div class="font-medium">{{ 'settings.signupEnabled' | transloco }}</div>
                <div class="text-xs text-muted-foreground">{{ 'settings.signupEnabledHint' | transloco }}</div>
              </div>
              <mat-slide-toggle
                [checked]="form().scopedAdminSignupEnabled"
                (change)="setField('scopedAdminSignupEnabled', $event.checked)"
              />
            </div>
          </mat-card>

          <!-- Email section -->
          <mat-card class="p-4">
            <h3 class="m-0 mb-4 text-base font-semibold">{{ 'settings.emailSection' | transloco }}</h3>
            <div class="flex flex-col gap-4">

              <!-- emailEnabled -->
              <div class="flex items-center justify-between gap-4">
                <div>
                  <div class="font-medium">{{ 'settings.emailEnabled' | transloco }}</div>
                  <div class="text-xs text-muted-foreground">{{ 'settings.emailEnabledHint' | transloco }}</div>
                </div>
                <mat-slide-toggle
                  [checked]="form().emailEnabled"
                  (change)="setField('emailEnabled', $event.checked)"
                />
              </div>

              <!-- emailFromEmail -->
              <div>
                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>{{ 'settings.emailFrom' | transloco }}</mat-label>
                  <input matInput type="email"
                    [ngModel]="form().emailFromEmail"
                    (ngModelChange)="setField('emailFromEmail', $event)" />
                </mat-form-field>
                <div class="text-xs text-muted-foreground">{{ 'settings.emailFromHint' | transloco }}</div>
              </div>

              <!-- emailFromName -->
              <div>
                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>{{ 'settings.emailFromName' | transloco }}</mat-label>
                  <input matInput
                    [ngModel]="form().emailFromName"
                    (ngModelChange)="setField('emailFromName', $event)" />
                </mat-form-field>
                <div class="text-xs text-muted-foreground">{{ 'settings.emailFromNameHint' | transloco }}</div>
              </div>

              <!-- emailDailyCap -->
              <div>
                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>{{ 'settings.emailDailyCap' | transloco }}</mat-label>
                  <input matInput type="number" min="1"
                    [ngModel]="form().emailDailyCap"
                    (ngModelChange)="setField('emailDailyCap', $event)" />
                </mat-form-field>
                <div class="text-xs text-muted-foreground">{{ 'settings.emailDailyCapHint' | transloco }}</div>
              </div>

              <!-- API key status (read-only) -->
              <div>
                <div class="font-medium">{{ 'settings.emailApiKey' | transloco }}</div>
                <div class="text-xs text-muted-foreground">{{ 'settings.emailApiKeyHint' | transloco }}</div>
                @if (settingsValue()?.emailApiKeyConfigured) {
                  <div class="mt-1 text-sm font-medium text-green-600">
                    ✓ {{ 'settings.emailApiKeyConfigured' | transloco }}
                  </div>
                } @else {
                  <div class="mt-1 text-sm font-medium text-red-600">
                    ✗ {{ 'settings.emailApiKeyMissing' | transloco }}
                  </div>
                }
              </div>

            </div>
          </mat-card>

          <!-- Demo section -->
          <mat-card class="p-4">
            <h3 class="m-0 mb-4 text-base font-semibold">{{ 'settings.demoSection' | transloco }}</h3>
            <div class="flex flex-col gap-4">

              <!-- demoMaxActive -->
              <div>
                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>{{ 'settings.demoMaxActive' | transloco }}</mat-label>
                  <input matInput type="number" min="1"
                    [ngModel]="form().demoMaxActive"
                    (ngModelChange)="setField('demoMaxActive', $event)" />
                </mat-form-field>
                <div class="text-xs text-muted-foreground">{{ 'settings.demoMaxActiveHint' | transloco }}</div>
              </div>

              <!-- demoTtlHours -->
              <div>
                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>{{ 'settings.demoTtlHours' | transloco }}</mat-label>
                  <input matInput type="number" min="1"
                    [ngModel]="form().demoTtlHours"
                    (ngModelChange)="setField('demoTtlHours', $event)" />
                </mat-form-field>
                <div class="text-xs text-muted-foreground">{{ 'settings.demoTtlHoursHint' | transloco }}</div>
              </div>

              <!-- demoPerEmailPerDay -->
              <div>
                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>{{ 'settings.demoPerEmailPerDay' | transloco }}</mat-label>
                  <input matInput type="number" min="1"
                    [ngModel]="form().demoPerEmailPerDay"
                    (ngModelChange)="setField('demoPerEmailPerDay', $event)" />
                </mat-form-field>
                <div class="text-xs text-muted-foreground">{{ 'settings.demoPerEmailPerDayHint' | transloco }}</div>
              </div>

              <!-- demoCommentCap -->
              <div>
                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>{{ 'settings.demoCommentCap' | transloco }}</mat-label>
                  <input matInput type="number" min="1"
                    [ngModel]="form().demoCommentCap"
                    (ngModelChange)="setField('demoCommentCap', $event)" />
                </mat-form-field>
                <div class="text-xs text-muted-foreground">{{ 'settings.demoCommentCapHint' | transloco }}</div>
              </div>

            </div>
          </mat-card>

          <!-- Save button -->
          <div>
            <button mat-flat-button color="primary" (click)="save()">
              {{ 'settings.save' | transloco }}
            </button>
          </div>

        </div>
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

  // Local form state — initialised from the loaded settings, updated by each field change.
  private _form = signal<Partial<SettingsResponse>>({});

  form = computed(() => {
    const loaded = this.settingsValue();
    const overrides = this._form();
    if (!loaded) return overrides;
    // Merge: loaded values are the base, local overrides win.
    return { ...loaded, ...overrides };
  });

  setField<K extends keyof SettingsResponse>(key: K, value: SettingsResponse[K]) {
    this._form.update(prev => ({ ...prev, [key]: value }));
  }

  save() {
    const current = this.form();
    const body = {
      scopedAdminSignupEnabled: current.scopedAdminSignupEnabled,
      emailEnabled: current.emailEnabled,
      emailFromEmail: current.emailFromEmail,
      emailFromName: current.emailFromName,
      emailDailyCap: current.emailDailyCap,
      demoMaxActive: current.demoMaxActive,
      demoTtlHours: current.demoTtlHours,
      demoPerEmailPerDay: current.demoPerEmailPerDay,
      demoCommentCap: current.demoCommentCap,
    };
    this.settingsService.putApiAdminSettings(body as any).subscribe({
      next: () => {
        this._form.set({});
        this.settingsResource.reload();
        this.snack.open(this.transloco.translate('settings.saved'), 'OK', { duration: 3000 });
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }
}
