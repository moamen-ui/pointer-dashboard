import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  SettingsService,
  PredefinedActionsService,
  SuggestionsService,
  SuggestionStatus,
  AiRulesService,
  getApiAdminSettingsResource,
  getApiAdminPredefinedActionsResource,
  getApiAdminPredefinedActionSuggestionsResource,
  getApiAdminAiRulesTenantResource,
} from '@moamen-ui/pointer-angular';
import type { SettingsResponse, PredefinedActionResponse, SuggestionResponse, AiRuleResponse } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { AuthService } from '../../core/auth/auth.service';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppSwitchComponent } from '../../shared/ui/app-switch.component';
import { AppFormFieldComponent } from '../../shared/ui/app-form-field.component';
import { AppAccordionSectionComponent } from '../../shared/ui/app-accordion-section.component';
import { AppToastService } from '../../shared/ui/app-toast.service';
import { AppIconComponent } from '../../shared/ui/app-icon.component';

type EditableAction = {
  id?: number;
  text: string;
  prompt: string;
  isActive: boolean;
  sortOrder: number;
  dirty: boolean;
  saving: boolean;
};

type EditableRule = {
  id?: number;
  title: string;
  prompt: string;
  isActive: boolean;
  sortOrder: number;
  dirty: boolean;
  saving: boolean;
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslocoModule,
    AppButtonDirective,
    AppInputDirective,
    AppSwitchComponent,
    AppFormFieldComponent,
    AppAccordionSectionComponent,
    AppIconComponent,
  ],
  template: `
    <div class="flex-1 min-w-0 overflow-auto bg-background">
      <div class="mx-auto w-full max-w-[1120px]">
        <div class="flex items-center justify-between gap-4 mb-6">
          <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">{{ 'settings.title' | transloco }}</h1>
        </div>

        <!-- Instance-wide settings (super-admin only) -->
        @if (auth.isSuperAdmin()) {
          @if (settingsResource?.error()) {
            <p class="text-[14px] text-state-danger mb-4">{{ 'settings.loadError' | transloco }}</p>
          } @else if (settingsResource?.isLoading()) {
            <p class="text-[14px] text-muted-foreground mb-4">{{ 'settings.loading' | transloco }}</p>
          } @else {
            <div class="flex flex-col gap-4">
              <!-- Access section -->
              <app-accordion-section [defaultOpen]="true" title="{{ 'settings.accessSection' | transloco }}">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <div class="text-[14px] font-medium text-foreground">{{ 'settings.signupEnabled' | transloco }}</div>
                    <div class="text-[13px] text-muted-foreground mt-1.5">{{ 'settings.signupEnabledHint' | transloco }}</div>
                  </div>
                  <app-switch
                    [checked]="form().scopedAdminSignupEnabled ?? false"
                    (checkedChange)="setField('scopedAdminSignupEnabled', $event)"
                  />
                </div>
                <div class="flex justify-end pt-4 border-t border-border-muted">
                  <button appButton variant="primary" (click)="save()">
                    {{ 'settings.save' | transloco }}
                  </button>
                </div>
              </app-accordion-section>

              <!-- Email section -->
              <app-accordion-section title="{{ 'settings.emailSection' | transloco }}">
                <div class="space-y-4">
                  <div class="flex items-center justify-between gap-4">
                    <div>
                      <div class="text-[14px] font-medium text-foreground">{{ 'settings.emailEnabled' | transloco }}</div>
                      <div class="text-[13px] text-muted-foreground mt-1.5">{{ 'settings.emailEnabledHint' | transloco }}</div>
                    </div>
                    <app-switch
                      [checked]="form().emailEnabled ?? false"
                      (checkedChange)="setField('emailEnabled', $event)"
                    />
                  </div>

                  <app-form-field label="{{ 'settings.emailFrom' | transloco }}" hint="{{ 'settings.emailFromHint' | transloco }}">
                    <input
                      appInput
                      type="email"
                      [ngModel]="form().emailFromEmail"
                      (ngModelChange)="setField('emailFromEmail', $event)"
                    />
                  </app-form-field>

                  <app-form-field label="{{ 'settings.emailFromName' | transloco }}" hint="{{ 'settings.emailFromNameHint' | transloco }}">
                    <input
                      appInput
                      [ngModel]="form().emailFromName"
                      (ngModelChange)="setField('emailFromName', $event)"
                    />
                  </app-form-field>

                  <app-form-field label="{{ 'settings.emailDailyCap' | transloco }}" hint="{{ 'settings.emailDailyCapHint' | transloco }}">
                    <input
                      appInput
                      type="number"
                      min="1"
                      [ngModel]="form().emailDailyCap"
                      (ngModelChange)="setField('emailDailyCap', $event)"
                    />
                  </app-form-field>

                  <div>
                    <div class="text-[14px] font-medium text-foreground">{{ 'settings.emailApiKey' | transloco }}</div>
                    <div class="text-[13px] text-muted-foreground mt-1.5">{{ 'settings.emailApiKeyHint' | transloco }}</div>
                    @if (settingsValue()?.emailApiKeyConfigured) {
                      <div class="mt-2 text-[13px] text-state-completed font-medium">
                        ✓ {{ 'settings.emailApiKeyConfigured' | transloco }}
                      </div>
                    } @else {
                      <div class="mt-2 text-[13px] text-state-danger font-medium">
                        ✗ {{ 'settings.emailApiKeyMissing' | transloco }}
                      </div>
                    }
                  </div>
                </div>
                <div class="flex justify-end pt-4 border-t border-border-muted">
                  <button appButton variant="primary" (click)="save()">
                    {{ 'settings.save' | transloco }}
                  </button>
                </div>
              </app-accordion-section>

              <!-- Demo section -->
              <app-accordion-section title="{{ 'settings.demoSection' | transloco }}">
                <div class="space-y-4">
                  <app-form-field label="{{ 'settings.demoMaxActive' | transloco }}" hint="{{ 'settings.demoMaxActiveHint' | transloco }}">
                    <input
                      appInput
                      type="number"
                      min="1"
                      [ngModel]="form().demoMaxActive"
                      (ngModelChange)="setField('demoMaxActive', $event)"
                    />
                  </app-form-field>

                  <app-form-field label="{{ 'settings.demoTtlHours' | transloco }}" hint="{{ 'settings.demoTtlHoursHint' | transloco }}">
                    <input
                      appInput
                      type="number"
                      min="1"
                      [ngModel]="form().demoTtlHours"
                      (ngModelChange)="setField('demoTtlHours', $event)"
                    />
                  </app-form-field>

                  <app-form-field label="{{ 'settings.demoPerEmailPerDay' | transloco }}" hint="{{ 'settings.demoPerEmailPerDayHint' | transloco }}">
                    <input
                      appInput
                      type="number"
                      min="1"
                      [ngModel]="form().demoPerEmailPerDay"
                      (ngModelChange)="setField('demoPerEmailPerDay', $event)"
                    />
                  </app-form-field>

                  <app-form-field label="{{ 'settings.demoCommentCap' | transloco }}" hint="{{ 'settings.demoCommentCapHint' | transloco }}">
                    <input
                      appInput
                      type="number"
                      min="1"
                      [ngModel]="form().demoCommentCap"
                      (ngModelChange)="setField('demoCommentCap', $event)"
                    />
                  </app-form-field>
                </div>
                <div class="flex justify-end pt-4 border-t border-border-muted">
                  <button appButton variant="primary" (click)="save()">
                    {{ 'settings.save' | transloco }}
                  </button>
                </div>
              </app-accordion-section>

              <!-- Extension section -->
              <app-accordion-section title="{{ 'settings.extensionSection' | transloco }}">
                <div class="space-y-4">
                  <app-form-field label="{{ 'settings.extensionStoreUrl' | transloco }}" hint="{{ 'settings.extensionStoreUrlHint' | transloco }}">
                    <input
                      appInput
                      [ngModel]="form().extensionStoreUrl ?? ''"
                      (ngModelChange)="setField('extensionStoreUrl', $event)"
                    />
                  </app-form-field>

                  <app-form-field label="{{ 'settings.extensionZipUrl' | transloco }}" hint="{{ 'settings.extensionZipUrlHint' | transloco }}">
                    <input
                      appInput
                      [ngModel]="form().extensionZipUrl ?? ''"
                      (ngModelChange)="setField('extensionZipUrl', $event)"
                    />
                  </app-form-field>
                </div>
                <div class="flex justify-end pt-4 border-t border-border-muted">
                  <button appButton variant="primary" (click)="save()">
                    {{ 'settings.save' | transloco }}
                  </button>
                </div>
              </app-accordion-section>
            </div>
          }
        }

        <!-- Predefined actions section (tenant-wide) -->
        <div class="mt-12">
          <app-accordion-section title="{{ 'predefined.section' | transloco }}">
            <p class="text-[14px] text-muted-foreground mb-4 max-w-[72ch]">{{ 'predefined.tenantHelp' | transloco }}</p>

            <div class="space-y-4">
              @for (action of tenantActions(); track action.id ?? $index) {
                <div class="rounded-md border border-border p-3">
                  <div class="space-y-3">
                    <app-form-field label="{{ 'predefined.text' | transloco }}">
                      <input
                        appInput
                        [ngModel]="action.text"
                        (ngModelChange)="markDirty(action, 'text', $event)"
                      />
                    </app-form-field>

                    <app-form-field label="{{ 'predefined.prompt' | transloco }}">
                      <textarea
                        appInput
                        rows="3"
                        [ngModel]="action.prompt"
                        (ngModelChange)="markDirty(action, 'prompt', $event)"
                      ></textarea>
                    </app-form-field>

                    <div class="flex gap-2 pt-2">
                      <button
                        appButton
                        variant="primary"
                        size="sm"
                        [disabled]="!action.dirty || action.saving"
                        (click)="saveAction(action)"
                      >
                        {{ 'common.save' | transloco }}
                      </button>
                      <button
                        appButton
                        variant="secondary"
                        size="sm"
                        [disabled]="action.saving"
                        (click)="deleteAction(action)"
                      >
                        <app-icon icon="trash2" />
                        {{ 'common.delete' | transloco }}
                      </button>
                    </div>
                  </div>
                </div>
              }

              @if (tenantActions().length === 0 && !actionsResource.isLoading()) {
                <p class="text-[14px] text-muted-foreground">{{ 'predefined.empty' | transloco }}</p>
              }
            </div>

            <!-- Add new action -->
            <div class="mt-4 rounded-md border border-dashed border-border p-3">
              <div class="space-y-3">
                <app-form-field label="{{ 'predefined.text' | transloco }}">
                  <input appInput [formControl]="newActionText" />
                </app-form-field>

                <app-form-field label="{{ 'predefined.prompt' | transloco }}">
                  <textarea appInput rows="3" [formControl]="newActionPrompt"></textarea>
                </app-form-field>

                <button
                  appButton
                  variant="primary"
                  size="sm"
                  [disabled]="newActionBusy() || !newActionText.value.trim() || !newActionPrompt.value.trim()"
                  (click)="createAction()"
                >
                  <app-icon icon="plus" />
                  {{ 'predefined.add' | transloco }}
                </button>
              </div>
            </div>
          </app-accordion-section>
        </div>

        <!-- Suggestions review (admins only) -->
        @if (auth.isAdmin()) {
          <div class="mt-12">
            <app-accordion-section title="{{ 'suggestions.section' | transloco }}">
              @if (suggestionsResource.isLoading()) {
                <div class="h-2 bg-gutter rounded-md w-1/3"></div>
              }

              @if (!suggestionsResource.isLoading() && pendingSuggestions().length === 0) {
                <p class="text-[14px] text-muted-foreground">{{ 'suggestions.empty' | transloco }}</p>
              }

              <div class="space-y-3">
                @for (s of pendingSuggestions(); track s.id) {
                  <div class="rounded-md border border-border p-3">
                    <div class="flex-1 min-w-0">
                      <div class="text-[14px] font-medium text-foreground">{{ s.projectName ?? '—' }}</div>
                      <div class="text-[13px] text-muted-foreground mt-0.5">{{ s.suggestedByName ?? '—' }}</div>
                      <div class="text-[14px] text-foreground mt-2">{{ s.text ?? '—' }}</div>
                      <div class="text-[13px] text-muted-foreground mt-2 max-w-[72ch] break-words whitespace-pre-wrap">{{ s.prompt ?? '—' }}</div>
                      <div class="flex gap-2 pt-3 mt-3 border-t border-border-muted">
                        <button
                          appButton
                          variant="secondary"
                          size="sm"
                          (click)="approveSuggestion(s)"
                          [disabled]="suggestionBusy()"
                        >
                          <app-icon icon="check-circle" />
                          {{ 'suggestions.approve' | transloco }}
                        </button>
                        <button
                          appButton
                          variant="secondary"
                          size="sm"
                          (click)="rejectSuggestion(s)"
                          [disabled]="suggestionBusy()"
                        >
                          <app-icon icon="x-circle" />
                          {{ 'suggestions.reject' | transloco }}
                        </button>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </app-accordion-section>
          </div>
        }

        <!-- AI Rules section (admins only) -->
        @if (auth.isAdmin()) {
          <div class="mt-12">
            <app-accordion-section title="{{ 'aiRules.section' | transloco }}">
              <p class="text-[14px] text-muted-foreground mb-4 max-w-[72ch]">{{ 'aiRules.tenantHelp' | transloco }}</p>

              <div class="space-y-4">
                @for (rule of localRules; track rule.id ?? $index) {
                  <div class="rounded-md border border-border p-3">
                    <div class="space-y-3">
                      <div class="flex items-start gap-3">
                        <div class="flex-1 min-w-0">
                          <app-form-field label="{{ 'aiRules.titleLabel' | transloco }}">
                            <input
                              appInput
                              [ngModel]="rule.title"
                              (ngModelChange)="markRuleDirty(rule, 'title', $event)"
                            />
                          </app-form-field>
                        </div>
                        <app-switch
                          [checked]="rule.isActive ?? true"
                          (checkedChange)="markRuleDirty(rule, 'isActive', $event)"
                          class="mt-6"
                        />
                      </div>

                      <app-form-field label="{{ 'aiRules.promptLabel' | transloco }}">
                        <textarea
                          appInput
                          rows="3"
                          [ngModel]="rule.prompt"
                          (ngModelChange)="markRuleDirty(rule, 'prompt', $event)"
                        ></textarea>
                      </app-form-field>

                      <div class="flex gap-2 pt-2">
                        <button
                          appButton
                          variant="primary"
                          size="sm"
                          [disabled]="!rule.dirty || rule.saving"
                          (click)="saveRule(rule)"
                        >
                          {{ 'common.save' | transloco }}
                        </button>
                        <button
                          appButton
                          variant="secondary"
                          size="sm"
                          [disabled]="rule.saving"
                          (click)="deleteRule(rule)"
                        >
                          <app-icon icon="trash2" />
                          {{ 'common.delete' | transloco }}
                        </button>
                      </div>
                    </div>
                  </div>
                }

                @if (tenantRules().length === 0 && !tenantRulesResource.isLoading()) {
                  <p class="text-[14px] text-muted-foreground">{{ 'aiRules.empty' | transloco }}</p>
                }
              </div>

              <!-- Add new rule -->
              <div class="mt-4 rounded-md border border-dashed border-border p-3">
                <div class="space-y-3">
                  <app-form-field label="{{ 'aiRules.titleLabel' | transloco }}">
                    <input appInput [formControl]="newRuleTitle" />
                  </app-form-field>

                  <app-form-field label="{{ 'aiRules.promptLabel' | transloco }}">
                    <textarea appInput rows="3" [formControl]="newRulePrompt"></textarea>
                  </app-form-field>

                  <button
                    appButton
                    variant="primary"
                    size="sm"
                    [disabled]="newRuleBusy() || !newRuleTitle.value.trim() || !newRulePrompt.value.trim()"
                    (click)="createRule()"
                  >
                    <app-icon icon="plus" />
                    {{ 'aiRules.addRule' | transloco }}
                  </button>
                </div>
              </div>
            </app-accordion-section>
          </div>
        }
      </div>
    </div>
  `,
})
export class SettingsComponent {
  private settingsService = inject(SettingsService);
  private predefinedService = inject(PredefinedActionsService);
  private suggestionsService = inject(SuggestionsService);
  private aiRulesService = inject(AiRulesService);
  private toast = inject(AppToastService);
  private transloco = inject(TranslocoService);
  private fb = inject(FormBuilder);
  auth = inject(AuthService);

  settingsResource = this.auth.isSuperAdmin() ? getApiAdminSettingsResource() : undefined;
  actionsResource = getApiAdminPredefinedActionsResource();
  suggestionsResource = getApiAdminPredefinedActionSuggestionsResource();
  tenantRulesResource = getApiAdminAiRulesTenantResource();

  // Pending suggestions
  pendingSuggestions = computed(() =>
    ((this.suggestionsResource.value() ?? []) as SuggestionResponse[]).filter(
      (s) => s.status === SuggestionStatus.NUMBER_1
    )
  );
  suggestionBusy = signal(false);

  settingsValue = computed(() => this.settingsResource?.value() as unknown as SettingsResponse | undefined);

  // Tenant-wide actions
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

  private _form = signal<Partial<SettingsResponse>>({});

  form = computed(() => {
    const loaded = this.settingsValue();
    const overrides = this._form();
    if (!loaded) return overrides;
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
      extensionStoreUrl: current.extensionStoreUrl,
      extensionZipUrl: current.extensionZipUrl,
    };
    this.settingsService.putApiAdminSettings(body as any).subscribe({
      next: () => {
        this._form.set({});
        this.settingsResource?.reload();
        this.toast.show(this.transloco.translate('settings.saved'), 'success');
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }

  // --- Predefined actions ---

  newActionText = this.fb.nonNullable.control('');
  newActionPrompt = this.fb.nonNullable.control('');
  newActionBusy = signal(false);

  private _editableActions = signal<EditableAction[]>([]);
  private _seeded = signal(false);

  get localActions(): EditableAction[] {
    return this._seeded() ? this._editableActions() : this.tenantActions();
  }

  markDirty(action: EditableAction, field: 'text' | 'prompt', value: string): void {
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
        this.toast.show(extractMessage(e), 'danger');
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
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
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
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  // --- Suggestions ---

  approveSuggestion(s: SuggestionResponse): void {
    if (!s.id) return;
    this.suggestionBusy.set(true);
    this.suggestionsService.postApiAdminPredefinedActionSuggestionsIdApprove(s.id).subscribe({
      next: () => {
        this.suggestionBusy.set(false);
        this.suggestionsResource.reload();
        this.toast.show(this.transloco.translate('suggestions.approved'), 'success');
      },
      error: (e: unknown) => {
        this.suggestionBusy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  rejectSuggestion(s: SuggestionResponse): void {
    if (!s.id) return;
    this.suggestionBusy.set(true);
    this.suggestionsService.postApiAdminPredefinedActionSuggestionsIdReject(s.id).subscribe({
      next: () => {
        this.suggestionBusy.set(false);
        this.suggestionsResource.reload();
        this.toast.show(this.transloco.translate('suggestions.rejected'), 'success');
      },
      error: (e: unknown) => {
        this.suggestionBusy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  // --- AI Rules ---

  rawTenantRules = computed(() => (this.tenantRulesResource.value() ?? []) as AiRuleResponse[]);
  tenantRules = computed<EditableRule[]>(() =>
    this.rawTenantRules().map((r) => ({
      id: r.id,
      title: r.title ?? '',
      prompt: r.prompt ?? '',
      isActive: r.isActive ?? true,
      sortOrder: r.sortOrder ?? 0,
      dirty: false,
      saving: false,
    }))
  );

  newRuleTitle = this.fb.nonNullable.control('');
  newRulePrompt = this.fb.nonNullable.control('');
  newRuleBusy = signal(false);

  private _editableRules = signal<EditableRule[]>([]);
  private _rulesSeeded = signal(false);

  get localRules(): EditableRule[] {
    return this._rulesSeeded() ? this._editableRules() : this.tenantRules();
  }

  markRuleDirty(rule: EditableRule, field: 'title' | 'prompt' | 'isActive', value: any): void {
    const current = this._rulesSeeded()
      ? this._editableRules()
      : this.tenantRules().map((r) => ({ ...r }));
    const idx = current.findIndex((r) => r.id === rule.id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], [field]: value, dirty: true };
      this._editableRules.set([...current]);
      this._rulesSeeded.set(true);
    }
  }

  saveRule(rule: EditableRule): void {
    if (!rule.id) return;
    const current = this._rulesSeeded() ? this._editableRules() : this.tenantRules().map((r) => ({ ...r }));
    const idx = current.findIndex((r) => r.id === rule.id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], saving: true };
      this._editableRules.set([...current]);
      this._rulesSeeded.set(true);
    }
    this.aiRulesService.putApiAdminAiRulesId(rule.id, {
      title: rule.title,
      prompt: rule.prompt,
      isActive: rule.isActive,
    }).subscribe({
      next: () => {
        const list = this._editableRules();
        const i = list.findIndex((r) => r.id === rule.id);
        if (i !== -1) {
          list[i] = { ...list[i], dirty: false, saving: false };
          this._editableRules.set([...list]);
        }
        this.tenantRulesResource.reload();
      },
      error: (e: unknown) => {
        const list = this._editableRules();
        const i = list.findIndex((r) => r.id === rule.id);
        if (i !== -1) {
          list[i] = { ...list[i], saving: false };
          this._editableRules.set([...list]);
        }
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  deleteRule(rule: EditableRule): void {
    if (!rule.id) return;
    this.aiRulesService.deleteApiAdminAiRulesId(rule.id).subscribe({
      next: () => {
        this._rulesSeeded.set(false);
        this._editableRules.set([]);
        this.tenantRulesResource.reload();
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }

  createRule(): void {
    if (!this.newRuleTitle.value.trim() || !this.newRulePrompt.value.trim()) return;
    this.newRuleBusy.set(true);
    this.aiRulesService.postApiAdminAiRules({
      title: this.newRuleTitle.value.trim(),
      prompt: this.newRulePrompt.value.trim(),
      sortOrder: this.tenantRules().length,
    }).subscribe({
      next: () => {
        this.newRuleBusy.set(false);
        this.newRuleTitle.reset();
        this.newRulePrompt.reset();
        this._rulesSeeded.set(false);
        this._editableRules.set([]);
        this.tenantRulesResource.reload();
      },
      error: (e: unknown) => {
        this.newRuleBusy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }
}
