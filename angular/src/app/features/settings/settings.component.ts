import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  SettingsService,
  PredefinedActionsService,
  getApiAdminSettingsResource,
  getApiAdminPredefinedActionsResource,
} from '@moamen-ui/pointer-angular';
import type { SettingsResponse, PredefinedActionResponse } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';

interface EditableAction {
  id?: number;
  text: string;
  prompt: string;
  isActive: boolean;
  sortOrder: number;
  dirty: boolean;
  saving: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressBarModule,
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

      <!-- Predefined actions section (tenant-wide) -->
      <div class="mt-8 max-w-2xl">
        <mat-card class="p-4">
          <h3 class="m-0 mb-2 text-base font-semibold">{{ 'predefined.section' | transloco }}</h3>
          <p class="mb-4 text-[0.85rem] text-muted">{{ 'predefined.tenantHelp' | transloco }}</p>

          @if (actionsResource.isLoading()) {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          }

          <div class="flex flex-col gap-4">
            @for (action of tenantActions(); track action.id ?? $index) {
              <div class="flex flex-col gap-2 rounded border border-app-border p-3">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'predefined.text' | transloco }}</mat-label>
                  <input matInput [ngModel]="action.text" (ngModelChange)="markDirty(action, 'text', $event)" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'predefined.prompt' | transloco }}</mat-label>
                  <textarea matInput rows="2" [ngModel]="action.prompt" (ngModelChange)="markDirty(action, 'prompt', $event)"></textarea>
                </mat-form-field>
                <div class="flex items-center gap-2">
                  <button mat-flat-button color="primary" [disabled]="!action.dirty || action.saving" (click)="saveAction(action)">
                    {{ 'common.save' | transloco }}
                  </button>
                  <button mat-stroked-button color="warn" [disabled]="action.saving" (click)="deleteAction(action)">
                    <mat-icon>delete</mat-icon> {{ 'common.delete' | transloco }}
                  </button>
                </div>
              </div>
            }

            @if (tenantActions().length === 0 && !actionsResource.isLoading()) {
              <p class="text-[0.85rem] text-muted">{{ 'predefined.empty' | transloco }}</p>
            }
          </div>

          <!-- Add new action inline form -->
          <div class="mt-4 flex flex-col gap-2 rounded border border-dashed border-app-border p-3">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'predefined.text' | transloco }}</mat-label>
              <input matInput [formControl]="newActionText" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'predefined.prompt' | transloco }}</mat-label>
              <textarea matInput rows="2" [formControl]="newActionPrompt"></textarea>
            </mat-form-field>
            <div>
              <button mat-flat-button color="primary" [disabled]="newActionBusy() || !newActionText.value.trim() || !newActionPrompt.value.trim()" (click)="createAction()">
                <mat-icon>add</mat-icon> {{ 'predefined.add' | transloco }}
              </button>
            </div>
          </div>
        </mat-card>
      </div>
    </div>
  `,
})
export class SettingsComponent {
  private settingsService = inject(SettingsService);
  private predefinedService = inject(PredefinedActionsService);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private fb = inject(FormBuilder);

  settingsResource = getApiAdminSettingsResource();
  actionsResource = getApiAdminPredefinedActionsResource();

  // The HTTP interceptor unwraps the API envelope, so the runtime value is SettingsResponse.
  settingsValue = computed(() => this.settingsResource.value() as unknown as SettingsResponse | undefined);

  // Tenant-wide actions: filter to those where projectId == null.
  rawActions = computed(() => (this.actionsResource.value() ?? []) as PredefinedActionResponse[]);
  tenantActions = computed<EditableAction[]>(() =>
    this.rawActions()
      .filter((a) => a.projectId == null)
      .map((a) => ({
        id: a.id,
        text: a.text ?? '',
        prompt: a.prompt ?? '',
        isActive: a.isActive ?? true,
        sortOrder: a.sortOrder ?? 0,
        dirty: false,
        saving: false,
      }))
  );

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

  // --- Predefined actions ---

  newActionText = this.fb.nonNullable.control('');
  newActionPrompt = this.fb.nonNullable.control('');
  newActionBusy = signal(false);

  // Mutable local copy for editing existing actions.
  private _editableActions = signal<EditableAction[]>([]);

  constructor() {
    // Keep local editable list in sync with the loaded resource.
    // We use a computed -> effect pattern: on first load populate _editableActions.
  }

  // The UI binds to localActions which is the mutable editable signal, seeded from resource.
  private _seeded = signal(false);

  // We expose a merged list: prefer _editableActions if seeded, else fall back to computed.
  get localActions(): EditableAction[] {
    return this._seeded() ? this._editableActions() : this.tenantActions();
  }

  markDirty(action: EditableAction, field: 'text' | 'prompt', value: string): void {
    // Mutate in place by reconstructing the signal array.
    // Since tenantActions() is a computed derived from the resource, we maintain
    // a separate _editableActions signal for user edits.
    const current = this._seeded()
      ? this._editableActions()
      : this.tenantActions().map((a) => ({ ...a }));
    const idx = current.findIndex((a) => a.id === action.id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], [field]: value, dirty: true };
      this._editableActions.set([...current]);
      this._seeded.set(true);
    }
  }

  saveAction(action: EditableAction): void {
    if (!action.id) return;
    const current = this._seeded() ? this._editableActions() : this.tenantActions().map((a) => ({ ...a }));
    const idx = current.findIndex((a) => a.id === action.id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], saving: true };
      this._editableActions.set([...current]);
      this._seeded.set(true);
    }
    this.predefinedService.patchApiAdminPredefinedActionsId(action.id, {
      text: action.text,
      prompt: action.prompt,
      isActive: action.isActive,
    }).subscribe({
      next: () => {
        const list = this._editableActions();
        const i = list.findIndex((a) => a.id === action.id);
        if (i !== -1) {
          list[i] = { ...list[i], dirty: false, saving: false };
          this._editableActions.set([...list]);
        }
        this.actionsResource.reload();
      },
      error: (e: unknown) => {
        const list = this._editableActions();
        const i = list.findIndex((a) => a.id === action.id);
        if (i !== -1) {
          list[i] = { ...list[i], saving: false };
          this._editableActions.set([...list]);
        }
        this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
      },
    });
  }

  deleteAction(action: EditableAction): void {
    if (!action.id) return;
    this.predefinedService.deleteApiAdminPredefinedActionsId(action.id).subscribe({
      next: () => {
        this._seeded.set(false);
        this._editableActions.set([]);
        this.actionsResource.reload();
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  createAction(): void {
    if (!this.newActionText.value.trim() || !this.newActionPrompt.value.trim()) return;
    this.newActionBusy.set(true);
    this.predefinedService.postApiAdminPredefinedActions({
      text: this.newActionText.value,
      prompt: this.newActionPrompt.value,
      isActive: true,
      sortOrder: this.tenantActions().length,
    }).subscribe({
      next: () => {
        this.newActionBusy.set(false);
        this.newActionText.reset();
        this.newActionPrompt.reset();
        this._seeded.set(false);
        this._editableActions.set([]);
        this.actionsResource.reload();
      },
      error: (e: unknown) => {
        this.newActionBusy.set(false);
        this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
      },
    });
  }
}
