import { Component, inject, signal, TemplateRef, viewChild, computed } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { BidiModule } from '@angular/cdk/bidi';
import {
  ProjectsService,
  ExportImportService,
  SuggestionsService,
  ProjectActivationState,
  AiRulesService,
  getApiAdminProjectsResource,
  getApiAdminEnvironmentsResource,
  getApiAdminProjectsIdAppUrlsResource,
  getApiAdminRolesResource,
  getApiAiRulesProjectKeyResource,
  ImportResultDto,
} from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ConfirmService } from '../../core/confirm.service';
import { AuthService } from '../../core/auth/auth.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppIconComponent } from '../../shared/ui/app-icon.component';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppSelectComponent, type SelectOption } from '../../shared/ui/app-select.component';
import { AppSwitchComponent } from '../../shared/ui/app-switch.component';
import { AppFormFieldComponent } from '../../shared/ui/app-form-field.component';
import { AppToastService } from '../../shared/ui/app-toast.service';
import { AppDialogService } from '../../shared/ui/app-dialog.service';
import type { Severity } from '../../shared/severity';
import { DataTableCellDirective } from '../../shared/data-table/data-table-cell.directive';
import { AppDataTableComponent, type DataTableColumn } from '../../shared/ui/app-data-table.component';
import type { RowActionItem } from '../../shared/row-actions-menu/row-actions-menu.component';
import type {
  ProjectResponse,
  ExportFileDto,
  AiRuleResponse,
  ProjectAiRulesResponse,
} from '@moamen-ui/pointer-angular';

type EditableAiRule = {
  id?: number;
  projectId?: number | null;
  title: string;
  prompt: string;
  isActive: boolean;
  isInherited?: boolean;
  isPersonal?: boolean;
  dirty: boolean;
  saving: boolean;
};

import {
  KEY_PATTERN,
  KEY_MAX_LENGTH,
  ARABIC_MAP,
  asciiDigits,
  slugifyKey,
} from '../../shared/project-utils';

export { KEY_PATTERN, KEY_MAX_LENGTH, ARABIC_MAP, asciiDigits, slugifyKey };


@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    BidiModule,
    FormsModule,
    ReactiveFormsModule,
    TranslocoModule,
    AppDataTableComponent,
    DataTableCellDirective,
    BadgeComponent,
    AppButtonDirective,
    AppIconComponent,
    AppInputDirective,
    AppSelectComponent,
    AppSwitchComponent,
    AppFormFieldComponent,
  ],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between gap-4">
        <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">{{ 'projects.title' | transloco }}</h1>
        @if (!auth.isSuperAdmin()) {
          <button appButton variant="primary" data-tour="add-project-btn" (click)="openAdd()">
            <app-icon name="plus" [size]="16"></app-icon>
            {{ 'projects.addProject' | transloco }}
          </button>
        }
      </div>

      @if (auth.isSuperAdmin()) {
        <p class="text-[14px] text-muted-foreground">{{ 'projects.superAdminNote' | transloco }}</p>
      }

      <app-data-table
          [gutter]="true"
        [rows]="projects()"
        [columns]="columns()"
        [actions]="actionsFor"
        [actionsAriaLabel]="'projects.actions' | transloco"
        [actionsHeader]="'projects.actions' | transloco"
        [emptyMessage]="'projects.empty' | transloco"
        [emptyHint]="(auth.isSuperAdmin() ? 'projects.superAdminEmptyHint' : 'projects.emptyHint') | transloco"
      >
        @if (!auth.isSuperAdmin()) {
          <button emptyAction appButton variant="primary" (click)="openAdd()">
            <app-icon name="plus" [size]="16"></app-icon>
            {{ 'projects.addProject' | transloco }}
          </button>
        }
        <ng-template appDataTableCell="name" let-project>
          <span class="whitespace-nowrap">{{ project.name }}</span>
        </ng-template>
        <ng-template appDataTableCell="key" let-project>
          <code class="whitespace-nowrap rounded bg-gutter px-1.5 py-0.5 font-mono text-[13px]">{{ project.key }}</code>
        </ng-template>
        <ng-template appDataTableCell="status" let-project>
          <app-badge [severity]="activationSeverity(project.activationState)">
            {{ activationLabelKey(project.activationState) | transloco }}
          </app-badge>
        </ng-template>
        <ng-template appDataTableCell="createdBy" let-project>
          <span class="text-[14px] text-muted-foreground">{{ project.createdByName }}</span>
        </ng-template>
        <ng-template appDataTableCell="comments" let-project>
          <span class="font-mono text-[14px]">{{ project.commentsCount ?? 0 }}</span>
        </ng-template>
      </app-data-table>
    </div>

    <!-- Add project dialog (distilled: Name, Key, Page Context Capture only) -->
    <ng-template #addDialog>
      <div class="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog flex flex-col max-h-[90vh]">
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-[16px] font-semibold leading-6">{{ 'projects.addProject' | transloco }}</h2>
        </div>
        <div class="px-5 py-2 pb-3 space-y-4 overflow-y-auto">
          <form [formGroup]="addForm" class="space-y-4">
            <!-- Name -->
            <app-form-field [label]="'projects.name' | transloco">
              <input
                appInput
                formControlName="name"
                (input)="syncKeyFromName($event)"
              />
            </app-form-field>

            <!-- Key -->
            <app-form-field
              [label]="'projects.key' | transloco"
              [hint]="keyControl.hasError('required') || keyControl.hasError('pattern') || keyControl.hasError('maxlength') || keyControl.hasError('keyTaken') ? '' : (keyEdited() ? 'projects.keyHint' : 'projects.keyAutoHint') | transloco"
              [error]="keyControl.hasError('required') ? ('projects.keyRequired' | transloco) : keyControl.hasError('pattern') ? ('projects.keyPattern' | transloco) : keyControl.hasError('maxlength') ? ('projects.keyMaxLength' | transloco: { max: KEY_MAX_LENGTH }) : keyControl.hasError('keyTaken') ? ('projects.keyTaken' | transloco) : ''">
              <input
                appInput
                formControlName="key"
                maxlength="64"
                autocapitalize="none"
                spellcheck="false"
                (input)="onKeyEdited($event)"
              />
            </app-form-field>

            <!-- Page Context Capture switch -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-[14px] font-medium text-foreground">{{ 'projects.pageContextCapture' | transloco }}</div>
                  <div class="text-[12px] text-muted-foreground">{{ 'projects.pageContextCaptureHint' | transloco }}</div>
                </div>
                <app-switch [checked]="addForm.get('pageContextCaptureEnabled')?.value ?? false" (checkedChange)="addForm.get('pageContextCaptureEnabled')?.setValue($event)" />
              </div>
            </div>
          </form>
        </div>
        <div class="px-5 pb-5 pt-3 flex justify-end gap-2 border-t border-border">
          <button appButton variant="secondary" size="sm" (click)="dialogRef?.close()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button appButton variant="primary" size="sm" (click)="addProject()" [disabled]="addForm.invalid || loading()">
            <app-icon name="plus" [size]="16"></app-icon>
            {{ 'projects.addProject' | transloco }}
          </button>
        </div>
      </div>
    </ng-template>

    <!-- Edit project dialog -->
    <ng-template #editDialog>
      <div class="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog flex flex-col max-h-[90vh]">
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-[16px] font-semibold leading-6">{{ 'projects.editTitle' | transloco }}</h2>
        </div>
        <div class="px-5 py-2 overflow-y-auto flex-1">
          <form [formGroup]="editForm" (ngSubmit)="saveEdit()" class="space-y-4">
            <!-- Name -->
            <app-form-field [label]="'projects.name' | transloco">
              <input appInput formControlName="name" />
            </app-form-field>

            <!-- Page Context Capture -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-[14px] font-medium text-foreground">{{ 'projects.pageContextCapture' | transloco }}</div>
                  <div class="text-[12px] text-muted-foreground">{{ 'projects.pageContextCaptureHint' | transloco }}</div>
                </div>
                <app-switch formControlName="pageContextCaptureEnabled" />
              </div>
            </div>

            <!-- Other Environments -->
            <div class="border-t border-border-muted pt-4 mt-4">
              <h3 class="text-[14px] font-medium text-foreground mb-1">{{ 'projects.otherEnvironments' | transloco }}</h3>
              <p class="text-[12px] text-muted-foreground mb-3">{{ 'projects.otherEnvironmentsHint' | transloco }}</p>
              @if (configuredEnvironments().length > 0 || showAddEnvRow()) {
                <div class="border border-border rounded-md overflow-hidden">
                  <table class="w-full">
                    <thead class="bg-gutter border-b border-border-muted">
                      <tr class="h-10">
                        <th class="px-3 text-start text-[13px] font-medium text-muted-foreground w-32">{{ 'environments.name' | transloco }}</th>
                        <th class="px-3 text-start text-[13px] font-medium text-muted-foreground flex-1">{{ 'projects.appUrl' | transloco }}</th>
                        <th class="px-3 text-center text-[13px] font-medium text-muted-foreground w-20">{{ 'common.active' | transloco }}</th>
                        <th class="w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (env of configuredEnvironments(); track env.appEnvironmentId) {
                        <tr class="h-11 border-t border-border-muted hover:bg-gutter/60">
                          <td class="px-3 text-[14px] font-medium text-foreground">{{ env.environmentName }}</td>
                          <td class="px-3">
                            <input
                              appInput
                              type="text"
                              placeholder="https://..."
                              [ngModel]="envDrafts()[env.appEnvironmentId!]?.url ?? ''"
                              [ngModelOptions]="{ standalone: true }"
                              (ngModelChange)="setEnvUrlDraft(env.appEnvironmentId!, $event)"
                              class="w-full h-8"
                            />
                          </td>
                          <td class="px-3 text-center">
                            <app-switch
                              [checked]="envDrafts()[env.appEnvironmentId!]?.isActive ?? true"
                              (checkedChange)="setEnvActiveDraft(env.appEnvironmentId!, $event)"
                            />
                          </td>
                          <td class="px-3 text-end">
                            <button appButton variant="ghost" size="icon" type="button" (click)="clearEnvironmentUrl(env.appEnvironmentId!)" [attr.aria-label]="'common.delete' | transloco">
                              <app-icon name="trash-2" [size]="16"></app-icon>
                            </button>
                          </td>
                        </tr>
                      }
                      @if (showAddEnvRow()) {
                        <tr class="h-11 border-t border-border-muted hover:bg-gutter/60">
                          <td class="px-3">
                            <app-select
                              [options]="availableEnvironmentsToAdd().map(e => ({ label: e.name ?? '', value: e.id ?? 0 }))"
                              [value]="newEnvId() ?? 0"
                              (valueChange)="newEnvId.set($event)"
                              [disabled]="isAddingEnv()"
                              class="w-full"
                            />
                          </td>
                          <td class="px-3">
                            <input
                              appInput
                              type="text"
                              placeholder="https://..."
                              [ngModel]="newEnvUrl()"
                              [ngModelOptions]="{ standalone: true }"
                              (ngModelChange)="newEnvUrl.set($event)"
                              class="w-full h-8"
                            />
                          </td>
                          <td class="px-3 text-center">
                            <app-switch [checked]="newEnvActive()" (checkedChange)="newEnvActive.set($event)" />
                          </td>
                          <td class="px-3 flex items-center justify-end gap-1">
                            <button appButton variant="ghost" size="icon" type="button" (click)="confirmAddEnvironment()" [disabled]="isAddingEnv() || !newEnvId() || !newEnvUrl().trim()" [attr.aria-label]="'common.add' | transloco">
                              <app-icon name="check" [size]="16"></app-icon>
                            </button>
                            <button appButton variant="ghost" size="icon" type="button" (click)="cancelAddEnvironment()" [disabled]="isAddingEnv()" [attr.aria-label]="'common.cancel' | transloco">
                              <app-icon name="x" [size]="16"></app-icon>
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
              @if (!showAddEnvRow()) {
                <div class="mt-3 flex flex-col gap-1 items-start">
                  <button
                    appButton
                    variant="secondary"
                    size="sm"
                    type="button"
                    [disabled]="availableEnvironmentsToAdd().length === 0"
                    (click)="startAddEnvironment()"
                  >
                    <app-icon name="plus" [size]="16"></app-icon>
                    {{ 'projects.addEnvironment' | transloco }}
                  </button>
                  @if (availableEnvironmentsToAdd().length === 0) {
                    <p class="text-[12px] text-muted-foreground">
                      {{ 'projects.allEnvironmentsConfigured' | transloco }}
                    </p>
                  }
                </div>
              }
            </div>

            <!-- Environment Selector Roles -->
            <div class="border-t border-border-muted pt-4 mt-4">
              <h3 class="text-[14px] font-medium text-foreground mb-1">{{ 'projects.envSelectorRoles' | transloco }}</h3>
              <p class="text-[12px] text-muted-foreground mb-3">{{ 'projects.envSelectorRolesHint' | transloco }}</p>
              <app-select
                [options]="roles().map(r => ({ label: r.name ?? '', value: r.id ?? 0 }))"
                [value]="editForm.get('environmentSelectorRoleIds')?.value?.[0]"
                (valueChange)="onRoleSelect($event)"
                [disabled]="loading()"
              />
            </div>

            <!-- AI Rules button -->
            <div class="border-t border-border-muted pt-4 mt-4">
              <div class="rounded-md border border-border p-3 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <app-icon name="brain" [size]="16" class="text-brand"></app-icon>
                  <div>
                    <div class="text-[14px] font-medium text-foreground">{{ 'aiRules.section' | transloco }}</div>
                    <div class="text-[12px] text-muted-foreground">{{ 'aiRules.projectHelp' | transloco }}</div>
                  </div>
                </div>
                <button appButton variant="secondary" size="sm" type="button" class="shrink-0 whitespace-nowrap" (click)="openAiRulesFromEdit()">
                  {{ 'aiRules.section' | transloco }}
                </button>
              </div>
            </div>
          </form>
        </div>
        <div class="px-5 pb-5 pt-3 flex justify-end gap-2 border-t border-border">
          <button appButton variant="secondary" size="sm" (click)="dialogRef?.close()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button appButton variant="primary" size="sm" (click)="saveEdit()" [disabled]="editForm.invalid || loading()">
            <app-icon name="save" [size]="16"></app-icon>
            {{ 'common.save' | transloco }}
          </button>
        </div>
      </div>
    </ng-template>

    <!-- View predefined prompts dialog -->
    <ng-template #viewPromptsDialog>
      <div class="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog flex flex-col max-h-[90vh]">
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-[16px] font-semibold leading-6">{{ 'projects.viewPrompts' | transloco }}</h2>
        </div>
        <div class="px-5 py-2 overflow-y-auto flex-1 space-y-3">
          @if ((viewingProject()?.predefinedActions ?? []).length === 0) {
            <p class="text-[14px] text-muted-foreground">{{ 'predefined.empty' | transloco }}</p>
          } @else {
            @for (action of viewingProject()?.predefinedActions ?? []; track $index) {
              <div class="rounded-md border border-border p-3">
                <div class="text-[14px] font-medium text-foreground mb-2">{{ action.text }}</div>
                <div class="text-[13px] text-muted-foreground whitespace-pre-wrap font-mono">{{ action.prompt }}</div>
              </div>
            }
          }
        </div>
        <div class="px-5 pb-5 pt-3 flex justify-between border-t border-border">
          @if (viewingProject(); as p) {
            <button appButton variant="secondary" size="sm" (click)="openAiRules(p)">
              <app-icon name="brain" [size]="16"></app-icon>
              {{ 'aiRules.section' | transloco }}
            </button>
          }
          <button appButton variant="secondary" size="sm" (click)="dialogRef?.close()">
            {{ 'common.cancel' | transloco }}
          </button>
        </div>
      </div>
    </ng-template>

    <!-- Suggest prompt dialog -->
    <ng-template #suggestDialog>
      <div class="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog flex flex-col max-h-[90vh]">
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-[16px] font-semibold leading-6">{{ 'projects.suggest' | transloco }}</h2>
        </div>
        <form [formGroup]="suggestForm" class="px-5 py-2 overflow-y-auto flex-1 space-y-4">
          <app-form-field [label]="'predefined.text' | transloco">
            <input appInput formControlName="text" />
          </app-form-field>
          <app-form-field [label]="'predefined.prompt' | transloco">
            <textarea formControlName="prompt" class="h-20 resize-none"></textarea>
          </app-form-field>
        </form>
        <div class="px-5 pb-5 pt-3 flex justify-end gap-2 border-t border-border">
          <button appButton variant="secondary" size="sm" (click)="dialogRef?.close()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button appButton variant="primary" size="sm" (click)="submitSuggest()" [disabled]="suggestForm.invalid || suggestBusy()">
            <app-icon name="send" [size]="16"></app-icon>
            {{ 'projects.suggest' | transloco }}
          </button>
        </div>
      </div>
    </ng-template>

    <!-- Import dialog -->
    <ng-template #importDialog>
      <div class="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog flex flex-col max-h-[90vh]">
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-[16px] font-semibold leading-6">{{ 'exportImport.importTitle' | transloco }}</h2>
        </div>
        <div class="px-5 py-2 overflow-y-auto flex-1">
          <p class="text-[14px] text-muted-foreground mb-4">{{ 'exportImport.importHint' | transloco }}</p>
          <input #fileInput type="file" accept=".json" class="block w-full text-[14px]" (change)="onFileSelected($event)" />
        </div>
        <div class="px-5 pb-5 pt-3 flex justify-end gap-2 border-t border-border">
          <button appButton variant="secondary" size="sm" (click)="dialogRef?.close()" [disabled]="importBusy()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button appButton variant="primary" size="sm" (click)="submitImport()" [disabled]="!importFile() || importBusy()">
            <app-icon name="upload" [size]="16"></app-icon>
            {{ 'exportImport.import' | transloco }}
          </button>
        </div>
      </div>
    </ng-template>

    <!-- AI Rules dialog -->
    <ng-template #aiRulesDialog>
      <div class="w-[min(520px,calc(100vw-32px))] rounded-lg border border-border bg-background shadow-dialog flex flex-col max-h-[90vh]">
        <div class="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 class="text-[16px] font-semibold leading-6 flex items-center gap-2">
            <app-icon name="brain" [size]="16" class="text-brand"></app-icon>
            {{ 'aiRules.section' | transloco }}: {{ selectedAiProject()?.name }}
          </h2>
        </div>
        <div class="px-5 py-2 overflow-y-auto flex-1 space-y-6">
          <p class="text-[13px] text-muted-foreground">{{ 'aiRules.projectHelp' | transloco }}</p>

          <!-- Admin Rules section -->
          <div>
            <h3 class="text-[14px] font-medium text-foreground mb-1">{{ 'aiRules.adminRulesTitle' | transloco }}</h3>
            <p class="text-[12px] text-muted-foreground mb-3">{{ 'aiRules.adminRulesSubtitle' | transloco }}</p>
            <div class="space-y-2">
              @for (rule of localAdminRules; track rule.id ?? $index) {
                <div class="rounded-md border border-border p-3 space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="rounded px-1.5 py-0.5 text-[12px] font-medium" [class.text-state-archived]="rule.isInherited" [class.bg-state-archived-tint]="rule.isInherited" [class.text-brand]="!rule.isInherited" [class.bg-brand-tint]="!rule.isInherited">
                      {{ (rule.isInherited ? 'aiRules.inheritedBadge' : 'aiRules.projectBadge') | transloco }}
                    </span>
                    @if (!rule.isInherited && (selectedAiProject()?.canEdit || auth.isAdmin())) {
                      <app-switch [checked]="rule.isActive" (checkedChange)="markAdminRuleDirty(rule, 'isActive', $event)" />
                    }
                  </div>
                  @if (!rule.isInherited && (selectedAiProject()?.canEdit || auth.isAdmin())) {
                    <input appInput [ngModel]="rule.title" (ngModelChange)="markAdminRuleDirty(rule, 'title', $event)" class="w-full" />
                    <textarea class="w-full h-16 px-3 py-2 rounded-md border border-border bg-background text-[13px] font-mono resize-none" [ngModel]="rule.prompt" (ngModelChange)="markAdminRuleDirty(rule, 'prompt', $event)"></textarea>
                    <div class="flex items-center gap-2">
                      <button appButton variant="primary" size="sm" [disabled]="!rule.dirty || rule.saving" (click)="saveProjectAdminRule(rule)">
                        {{ 'common.save' | transloco }}
                      </button>
                      <button appButton variant="destructive" size="sm" [disabled]="rule.saving" (click)="deleteProjectAdminRule(rule)">
                        <app-icon name="trash-2" [size]="16"></app-icon>
                        {{ 'common.delete' | transloco }}
                      </button>
                    </div>
                  } @else {
                    <div class="text-[14px] font-medium text-foreground">{{ rule.title }}</div>
                    <div class="text-[13px] font-mono text-muted-foreground whitespace-pre-wrap">{{ rule.prompt }}</div>
                  }
                </div>
              }
              @if (localAdminRules.length === 0) {
                <p class="text-[13px] text-muted-foreground">{{ 'aiRules.empty' | transloco }}</p>
              }
              @if (selectedAiProject()?.canEdit || auth.isAdmin()) {
                <div class="rounded-md border border-dashed border-border p-3 space-y-2">
                  <div class="text-[12px] font-medium text-muted-foreground">{{ 'aiRules.addRule' | transloco }}</div>
                  <input appInput [formControl]="newProjectRuleTitle" [placeholder]="'aiRules.titlePlaceholder' | transloco" class="w-full" />
                  <textarea class="w-full h-16 px-3 py-2 rounded-md border border-border bg-background text-[13px] font-mono resize-none" [formControl]="newProjectRulePrompt" [placeholder]="'aiRules.promptPlaceholder' | transloco"></textarea>
                  <button appButton variant="primary" size="sm" [disabled]="newProjectRuleBusy() || !newProjectRuleTitle.value.trim() || !newProjectRulePrompt.value.trim()" (click)="createProjectAdminRule()">
                    <app-icon name="plus" [size]="16"></app-icon>
                    {{ 'aiRules.addRule' | transloco }}
                  </button>
                </div>
              }
            </div>
          </div>

          <!-- Personal Rules section -->
          <div class="border-t border-border-muted pt-4">
            <h3 class="text-[14px] font-medium text-foreground mb-1">{{ 'aiRules.myRulesTitle' | transloco }}</h3>
            <p class="text-[12px] text-muted-foreground mb-3">{{ 'aiRules.myRulesSubtitle' | transloco }}</p>
            <div class="space-y-2">
              @for (rule of localMyRules; track rule.id ?? $index) {
                <div class="rounded-md border border-border p-3 space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="rounded px-1.5 py-0.5 text-[12px] font-medium text-state-ready bg-state-ready-tint">
                      {{ 'aiRules.personalBadge' | transloco }}
                    </span>
                    <app-switch [checked]="rule.isActive" (checkedChange)="markMyRuleDirty(rule, 'isActive', $event)" />
                  </div>
                  <input appInput [ngModel]="rule.title" (ngModelChange)="markMyRuleDirty(rule, 'title', $event)" class="w-full" />
                  <textarea class="w-full h-16 px-3 py-2 rounded-md border border-border bg-background text-[13px] font-mono resize-none" [ngModel]="rule.prompt" (ngModelChange)="markMyRuleDirty(rule, 'prompt', $event)"></textarea>
                  <div class="flex items-center gap-2">
                    <button appButton variant="primary" size="sm" [disabled]="!rule.dirty || rule.saving" (click)="savePersonalRule(rule)">
                      {{ 'common.save' | transloco }}
                    </button>
                    <button appButton variant="destructive" size="sm" [disabled]="rule.saving" (click)="deletePersonalRule(rule)">
                      <app-icon name="trash-2" [size]="16"></app-icon>
                      {{ 'common.delete' | transloco }}
                    </button>
                  </div>
                </div>
              }
              @if (localMyRules.length === 0) {
                <p class="text-[13px] text-muted-foreground">{{ 'aiRules.noPersonalRules' | transloco }}</p>
              }
              <div class="rounded-md border border-dashed border-border p-3 space-y-2">
                <div class="text-[12px] font-medium text-muted-foreground">{{ 'aiRules.addPersonalRule' | transloco }}</div>
                <input appInput [formControl]="newPersonalRuleTitle" [placeholder]="'aiRules.titlePlaceholder' | transloco" class="w-full" />
                <textarea class="w-full h-16 px-3 py-2 rounded-md border border-border bg-background text-[13px] font-mono resize-none" [formControl]="newPersonalRulePrompt" [placeholder]="'aiRules.promptPlaceholder' | transloco"></textarea>
                <button appButton variant="primary" size="sm" [disabled]="newPersonalRuleBusy() || !newPersonalRuleTitle.value.trim() || !newPersonalRulePrompt.value.trim()" (click)="createPersonalRule()">
                  <app-icon name="plus" [size]="16"></app-icon>
                  {{ 'aiRules.addPersonalRule' | transloco }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="px-5 pb-5 pt-3 flex justify-end gap-2 border-t border-border">
          <button appButton variant="secondary" size="sm" (click)="aiRulesDialogRef?.close()">
            {{ 'common.cancel' | transloco }}
          </button>
        </div>
      </div>
    </ng-template>
  `,
})
export class ProjectsComponent {
  private projectsService = inject(ProjectsService);
  private exportImportService = inject(ExportImportService);
  private suggestionsService = inject(SuggestionsService);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private transloco = inject(TranslocoService);
  private toast = inject(AppToastService);
  private confirm = inject(ConfirmService);
  private aiRulesService = inject(AiRulesService);
  auth = inject(AuthService);
  private appDialog = inject(AppDialogService);

  readonly addDialog = viewChild.required<TemplateRef<unknown>>('addDialog');
  readonly editDialog = viewChild.required<TemplateRef<unknown>>('editDialog');
  readonly viewPromptsDialog = viewChild.required<TemplateRef<unknown>>('viewPromptsDialog');
  readonly suggestDialog = viewChild.required<TemplateRef<unknown>>('suggestDialog');
  readonly importDialog = viewChild.required<TemplateRef<unknown>>('importDialog');
  readonly aiRulesDialog = viewChild.required<TemplateRef<unknown>>('aiRulesDialog');
  dialogRef?: any;
  aiRulesDialogRef?: any;

  projectsResource = getApiAdminProjectsResource();
  projects = computed(() => this.projectsResource.value() ?? []);
  busy = signal(false);
  loading = computed(() => this.projectsResource.isLoading() || this.busy());

  selectedAiProject = signal<ProjectResponse | null>(null);
  private selectedAiProjectKeyForRules = computed(() => this.selectedAiProject()?.key ?? '');
  projectAiRulesResource = getApiAiRulesProjectKeyResource(this.selectedAiProjectKeyForRules);

  projectAiRules = computed<ProjectAiRulesResponse | undefined>(
    () => this.projectAiRulesResource.value() as unknown as ProjectAiRulesResponse | undefined
  );

  rawAdminRules = computed<AiRuleResponse[]>(() => this.projectAiRules()?.adminRules ?? []);
  rawMyRules = computed<AiRuleResponse[]>(() => this.projectAiRules()?.myRules ?? []);

  newProjectRuleTitle = this.fb.nonNullable.control('');
  newProjectRulePrompt = this.fb.nonNullable.control('');
  newProjectRuleBusy = signal(false);

  newPersonalRuleTitle = this.fb.nonNullable.control('');
  newPersonalRulePrompt = this.fb.nonNullable.control('');
  newPersonalRuleBusy = signal(false);

  private _editableAdminRules = signal<EditableAiRule[]>([]);
  private _adminRulesSeeded = signal(false);
  private _editableMyRules = signal<EditableAiRule[]>([]);
  private _myRulesSeeded = signal(false);

  importBusy = signal(false);
  importFile = signal<File | null>(null);
  private importProjectKey = signal<string>('');

  private editingProjectId = signal<number | null>(null);

  environmentsResource = getApiAdminEnvironmentsResource();
  private editingProjectIdForUrls = computed(() => this.editingProjectId() ?? 0);
  projectAppUrlsResource = getApiAdminProjectsIdAppUrlsResource(this.editingProjectIdForUrls);

  rolesResource = getApiAdminRolesResource();
  roles = computed(() => this.rolesResource.value() ?? []);

  configuredEnvironments = computed(() => this.projectAppUrlsResource.value() ?? []);

  availableEnvironmentsToAdd = computed(() => {
    const configuredIds = new Set(this.configuredEnvironments().map((u) => u.appEnvironmentId));
    return (this.environmentsResource.value() ?? []).filter((e) => !configuredIds.has(e.id!));
  });

  private envLoaded = computed(() => {
    const loaded: Record<number, { url: string; isActive: boolean }> = {};
    for (const u of this.configuredEnvironments()) {
      if (u.appEnvironmentId != null) loaded[u.appEnvironmentId] = { url: u.url ?? '', isActive: u.isActive ?? true };
    }
    return loaded;
  });
  private envOverrides = signal<Record<number, { url: string; isActive: boolean }>>({});
  envDrafts = computed(() => ({ ...this.envLoaded(), ...this.envOverrides() }));

  setEnvUrlDraft(environmentId: number, value: string): void {
    const current = this.envDrafts()[environmentId] ?? { url: '', isActive: true };
    this.envOverrides.update((o) => ({ ...o, [environmentId]: { ...current, url: value } }));
  }

  setEnvActiveDraft(environmentId: number, value: boolean): void {
    const current = this.envDrafts()[environmentId] ?? { url: '', isActive: true };
    this.envOverrides.update((o) => ({ ...o, [environmentId]: { ...current, isActive: value } }));
  }

  clearEnvironmentUrl(environmentId: number): void {
    const projectId = this.editingProjectId();
    if (!projectId) return;
    this.projectsService.deleteApiAdminProjectsIdAppUrlsEnvironmentId(projectId, environmentId).subscribe({
      next: () => {
        this.envOverrides.update((o) => { const { [environmentId]: _, ...rest } = o; return rest; });
        this.projectAppUrlsResource.reload();
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }

  showAddEnvRow = signal(false);
  newEnvId = signal<number | null>(null);
  newEnvUrl = signal('');
  newEnvActive = signal(true);
  isAddingEnv = signal(false);

  startAddEnvironment(): void {
    this.newEnvId.set(null);
    this.newEnvUrl.set('');
    this.newEnvActive.set(true);
    this.showAddEnvRow.set(true);
  }

  cancelAddEnvironment(): void {
    if (this.isAddingEnv()) return;
    this.showAddEnvRow.set(false);
    this.newEnvId.set(null);
    this.newEnvUrl.set('');
    this.newEnvActive.set(true);
  }

  confirmAddEnvironment(): void {
    const projectId = this.editingProjectId();
    const envId = this.newEnvId();
    const url = this.newEnvUrl().trim();
    if (!projectId || envId === null || envId === 0 || !url) return;

    this.isAddingEnv.set(true);
    this.projectsService.putApiAdminProjectsIdAppUrlsEnvironmentId(projectId, envId, {
      url,
      isActive: this.newEnvActive(),
    } as any).subscribe({
      next: () => {
        this.isAddingEnv.set(false);
        this.showAddEnvRow.set(false);
        this.newEnvId.set(null);
        this.newEnvUrl.set('');
        this.newEnvActive.set(true);
        this.projectAppUrlsResource.reload();
      },
      error: (e: unknown) => {
        this.isAddingEnv.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  private dirtyEnvironmentIds(): number[] {
    const loaded = this.envLoaded();
    return Object.entries(this.envOverrides())
      .filter(([id, draft]) => {
        const base = loaded[Number(id)];
        return !base || base.url !== draft.url || base.isActive !== draft.isActive;
      })
      .map(([id]) => Number(id));
  }

  private saveEnvironmentChangesIfPending(onDone: () => void): void {
    const projectId = this.editingProjectId();
    if (!projectId) {
      onDone();
      return;
    }

    const drafts = this.envDrafts();
    const requests: Observable<{ environmentId: number; ok: boolean }>[] = this.dirtyEnvironmentIds()
      .filter((envId) => (drafts[envId]?.url ?? '').trim() !== '')
      .map((envId) =>
        this.projectsService.putApiAdminProjectsIdAppUrlsEnvironmentId(projectId, envId, {
          url: drafts[envId].url.trim(),
          isActive: drafts[envId].isActive,
        } as any).pipe(
          map(() => ({ environmentId: envId, ok: true })),
          catchError((e: unknown) => {
            this.toast.show(extractMessage(e), 'danger');
            return of({ environmentId: envId, ok: false });
          }),
        ),
      );

    const newEnvId = this.newEnvId();
    const newUrl = this.newEnvUrl().trim();
    if (this.showAddEnvRow() && newEnvId && newUrl) {
      requests.push(
        this.projectsService.putApiAdminProjectsIdAppUrlsEnvironmentId(projectId, newEnvId, {
          url: newUrl,
          isActive: this.newEnvActive(),
        } as any).pipe(
          map(() => ({ environmentId: newEnvId, ok: true })),
          catchError((e: unknown) => {
            this.toast.show(extractMessage(e), 'danger');
            return of({ environmentId: newEnvId, ok: false });
          }),
        ),
      );
    }

    if (requests.length === 0) {
      onDone();
      return;
    }

    forkJoin(requests).subscribe((results) => {
      const saved = new Set(results.filter((r) => r.ok).map((r) => r.environmentId));
      this.envOverrides.update((o) => {
        const rest = { ...o };
        for (const id of saved) delete rest[id];
        return rest;
      });
      if (saved.has(newEnvId ?? -1)) this.showAddEnvRow.set(false);
      this.projectAppUrlsResource.reload();
      onDone();
    });
  }

  viewingProject = signal<ProjectResponse | null>(null);
  private suggestingProjectId = signal<number | null>(null);
  suggestBusy = signal(false);

  columns(): DataTableColumn<ProjectResponse>[] {
    return [
      { key: 'key', header: this.transloco.translate('projects.key'), sortable: true },
      { key: 'name', header: this.transloco.translate('projects.name'), sortable: true },
      { key: 'createdBy', header: this.transloco.translate('projects.createdBy'), sortable: true },
      { key: 'comments', header: this.transloco.translate('projects.comments'), sortable: true },
      { key: 'status', header: this.transloco.translate('projects.status') },
    ];
  }

  activationSeverity(state: ProjectActivationState | undefined): Severity {
    if (state === ProjectActivationState.NUMBER_2) return 'success';
    if (state === ProjectActivationState.NUMBER_1) return 'warning';
    return 'danger';
  }

  activationLabelKey(state: ProjectActivationState | undefined): string {
    if (state === ProjectActivationState.NUMBER_2) return 'common.active';
    if (state === ProjectActivationState.NUMBER_1) return 'common.partial';
    return 'common.disabled';
  }

  readonly actionsFor = (project: ProjectResponse): RowActionItem[] => {
    const busy = this.loading();
    const items: RowActionItem[] = [];
    items.push({
      label: this.transloco.translate('aiRules.section'),
      icon: 'brain',
      disabled: busy,
      onClick: () => this.openAiRules(project),
    });
    if (project.canEdit) {
      items.push({ label: this.transloco.translate('projects.edit'), icon: 'edit', disabled: busy, onClick: () => this.openEdit(project) });
    } else {
      items.push({ label: this.transloco.translate('projects.viewPrompts'), icon: 'eye', disabled: busy, onClick: () => this.openViewPrompts(project) });
      items.push({ label: this.transloco.translate('projects.suggest'), icon: 'lightbulb', disabled: busy, onClick: () => this.openSuggest(project) });
    }
    if (project.canEdit) {
      const anyActive = project.activationState !== ProjectActivationState.NUMBER_0;
      items.push({
        label: this.transloco.translate(anyActive ? 'common.disable' : 'common.enable'),
        icon: anyActive ? 'circle-off' : 'check-circle',
        severity: anyActive ? 'danger' : 'neutral',
        disabled: busy,
        onClick: () => this.toggleActive(project),
      });
      items.push({ label: this.transloco.translate('exportImport.export'), icon: 'download', disabled: busy, onClick: () => this.exportProject(project) });
      if (this.auth.isSuperAdmin()) {
        items.push({ label: this.transloco.translate('exportImport.import'), icon: 'upload', disabled: busy, onClick: () => this.openImport(project) });
      }
    }
    items.push({
      label: this.transloco.translate('projects.delete'),
      icon: 'trash-2',
      severity: 'danger',
      disabled: busy || !project.canDelete,
      tooltip: project.canDelete ? undefined : this.transloco.translate('projects.deleteBlockedComments'),
      onClick: () => this.deleteProject(project),
    });
    return items;
  };

  readonly KEY_MAX_LENGTH = KEY_MAX_LENGTH;

  addForm = this.fb.nonNullable.group({
    key: [
      '',
      [
        Validators.required,
        Validators.maxLength(KEY_MAX_LENGTH),
        Validators.pattern(KEY_PATTERN),
        this.uniqueKeyValidator(),
      ],
    ],
    name: ['', Validators.required],
    pageContextCaptureEnabled: [false],
  });

  get keyControl() {
    return this.addForm.controls.key;
  }

  readonly keyEdited = signal(false);

  normalizeKey(event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalized = input.value.toLowerCase().trim();
    if (normalized === input.value) return;
    input.value = normalized;
    this.keyControl.setValue(normalized);
  }

  onKeyEdited(event: Event): void {
    this.keyEdited.set(true);
    this.normalizeKey(event);
  }

  syncKeyFromName(event: Event): void {
    if (this.keyEdited()) return;
    const name = (event.target as HTMLInputElement).value;
    this.keyControl.setValue(slugifyKey(name));
  }

  private uniqueKeyValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '').toLowerCase().trim();
      if (!value) return null;
      const taken = this.projects().some((p) => (p.key ?? '').toLowerCase() === value);
      return taken ? { keyTaken: true } : null;
    };
  }

  editForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    pageContextCaptureEnabled: [false],
    isActiveLocal: [false],
    isActiveStaging: [false],
    isActiveProduction: [false],
    environmentSelectorRoleIds: this.fb.nonNullable.control<number[]>([]),
  });

  suggestForm = this.fb.nonNullable.group({
    text: ['', Validators.required],
    prompt: ['', Validators.required],
  });

  openAdd() {
    this.keyEdited.set(false);
    this.addForm.reset({ key: '', name: '', pageContextCaptureEnabled: false });
    this.dialogRef = this.appDialog.openRef(this.addDialog());
  }

  openEdit(project: ProjectResponse): void {
    this.editingProjectId.set(project.id ?? null);
    this.envOverrides.set({});
    this.showAddEnvRow.set(false);
    this.editForm.reset({
      name: project.name ?? '',
      pageContextCaptureEnabled: !!project.pageContextCaptureEnabled,
      isActiveLocal: !!project.isActiveLocal,
      isActiveStaging: !!project.isActiveStaging,
      isActiveProduction: !!project.isActiveProduction,
      environmentSelectorRoleIds: project.environmentSelectorRoleIds ?? [],
    });
    this.dialogRef = this.appDialog.openRef(this.editDialog());
  }

  openViewPrompts(project: ProjectResponse): void {
    this.viewingProject.set(project);
    this.dialogRef = this.appDialog.openRef(this.viewPromptsDialog());
  }

  openSuggest(project: ProjectResponse): void {
    this.suggestingProjectId.set(project.id ?? null);
    this.suggestForm.reset({ text: '', prompt: '' });
    this.dialogRef = this.appDialog.openRef(this.suggestDialog());
  }

  submitSuggest(): void {
    if (this.suggestForm.invalid) return;
    const id = this.suggestingProjectId();
    if (id == null) return;
    this.suggestBusy.set(true);
    const val = this.suggestForm.getRawValue();
    this.suggestionsService.postApiProjectsIdPredefinedActionSuggestions(id, { text: val.text, prompt: val.prompt }).subscribe({
      next: () => {
        this.suggestBusy.set(false);
        this.dialogRef?.close();
        this.toast.show(this.transloco.translate('suggestions.sent'), 'success');
      },
      error: (e: unknown) => {
        this.suggestBusy.set(false);
        const msg = (e as any)?.status === 403
          ? this.transloco.translate('suggestions.canEditDirectly')
          : extractMessage(e);
        this.toast.show(msg, 'danger');
      },
    });
  }

  deleteProject(project: ProjectResponse): void {
    this.confirm
      .confirm({
        message: this.transloco.translate('projects.deleteConfirm'),
        confirmLabel: this.transloco.translate('projects.delete'),
        confirmColor: 'danger',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.busy.set(true);
        this.projectsService.deleteApiAdminProjectsId(project.id!).subscribe({
          next: () => {
            this.busy.set(false);
            this.projectsResource.reload();
            this.toast.show(this.transloco.translate('projects.deleted'), 'success');
          },
          error: (e: unknown) => {
            this.busy.set(false);
            this.toast.show(extractMessage(e), 'danger');
          },
        });
      });
  }

  addProject() {
    if (this.addForm.invalid) return;
    this.busy.set(true);
    const val = this.addForm.getRawValue();
    this.projectsService.postApiAdminProjects({
      key: val.key,
      name: val.name,
      pageContextCaptureEnabled: val.pageContextCaptureEnabled,
      predefinedActions: [],
    } as any).subscribe({
      next: () => {
        this.busy.set(false);
        this.dialogRef?.close();
        this.addForm.reset();
        this.projectsResource.reload();
        this.toast.show(this.transloco.translate('projects.createdHint'), 'success');
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  saveEdit(): void {
    if (this.editForm.invalid) return;
    const id = this.editingProjectId();
    if (id == null) return;
    this.busy.set(true);
    const val = this.editForm.getRawValue();
    this.projectsService.patchApiAdminProjectsId(id, {
      name: val.name,
      pageContextCaptureEnabled: val.pageContextCaptureEnabled,
      isActiveLocal: val.isActiveLocal,
      isActiveStaging: val.isActiveStaging,
      isActiveProduction: val.isActiveProduction,
      environmentSelectorRoleIds: val.environmentSelectorRoleIds,
      predefinedActions: [],
    } as any).subscribe({
      next: () => {
        this.saveEnvironmentChangesIfPending(() => {
          this.busy.set(false);
          this.dialogRef?.close();
          this.projectsResource.reload();
          this.toast.show(this.transloco.translate('projects.saved'), 'success');
        });
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  toggleActive(project: ProjectResponse) {
    if (project.activationState === ProjectActivationState.NUMBER_0) {
      this.patchActive(project, true);
      return;
    }
    this.confirm
      .confirm({
        message: this.transloco.translate('common.confirmDisable', { name: project.key }),
        confirmLabel: this.transloco.translate('common.disable'),
        confirmColor: 'danger',
      })
      .subscribe((ok: boolean) => {
        if (ok) this.patchActive(project, false);
      });
  }

  private patchActive(project: ProjectResponse, isActive: boolean) {
    this.busy.set(true);
    this.projectsService.patchApiAdminProjectsId(project.id!, {
      isActiveLocal: isActive,
      isActiveStaging: isActive,
      isActiveProduction: isActive,
    }).subscribe({
      next: () => { this.busy.set(false); this.projectsResource.reload(); },
      error: (e: unknown) => {
        this.busy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  exportProject(project: ProjectResponse): void {
    this.busy.set(true);
    this.http.get<ExportFileDto>(`/api/projects/${project.key}/export`).subscribe({
      next: (data) => {
        this.busy.set(false);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `pointer-comments-${project.key}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        this.toast.show(this.transloco.translate('exportImport.exported'), 'success');
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  openImport(project: ProjectResponse): void {
    this.importProjectKey.set(project.key ?? '');
    this.importFile.set(null);
    this.dialogRef = this.appDialog.openRef(this.importDialog());
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFile.set(input.files?.[0] ?? null);
  }

  submitImport(): void {
    const file = this.importFile();
    if (!file) return;
    this.importBusy.set(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const key = this.importProjectKey();
        this.exportImportService.postApiProjectsKeyImport(key, parsed).subscribe({
          next: (result) => {
            this.importBusy.set(false);
            this.dialogRef?.close();
            const countMsg = this.transloco.translate('exportImport.importCounts', {
              comments: result.importedComments ?? 0,
              replies: result.importedReplies ?? 0,
            });
            this.toast.show(`${this.transloco.translate('exportImport.imported')} ${countMsg}`, 'success');
            if ((result.warnings ?? []).length > 0) {
              result.warnings!.forEach((w) => this.toast.show(w, 'warning'));
            }
            this.projectsResource.reload();
          },
          error: (e: unknown) => {
            this.importBusy.set(false);
            this.toast.show(extractMessage(e), 'danger');
          },
        });
      } catch {
        this.importBusy.set(false);
        this.toast.show('Invalid JSON file', 'danger');
      }
    };
    reader.readAsText(file);
  }

  get localAdminRules(): EditableAiRule[] {
    if (this._adminRulesSeeded()) return this._editableAdminRules();
    return this.rawAdminRules().map((r) => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title ?? '',
      prompt: r.prompt ?? '',
      isActive: r.isActive ?? true,
      isInherited: r.isTenantWide ?? false,
      dirty: false,
      saving: false,
    }));
  }

  get localMyRules(): EditableAiRule[] {
    if (this._myRulesSeeded()) return this._editableMyRules();
    return this.rawMyRules().map((r) => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title ?? '',
      prompt: r.prompt ?? '',
      isActive: r.isActive ?? true,
      isPersonal: true,
      dirty: false,
      saving: false,
    }));
  }

  markAdminRuleDirty(rule: EditableAiRule, field: 'title' | 'prompt' | 'isActive', value: any): void {
    const current = this._adminRulesSeeded()
      ? this._editableAdminRules()
      : this.localAdminRules.map((r) => ({ ...r }));
    const idx = current.findIndex((r) => r.id === rule.id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], [field]: value, dirty: true };
      this._editableAdminRules.set([...current]);
      this._adminRulesSeeded.set(true);
    }
  }

  markMyRuleDirty(rule: EditableAiRule, field: 'title' | 'prompt' | 'isActive', value: any): void {
    const current = this._myRulesSeeded()
      ? this._editableMyRules()
      : this.localMyRules.map((r) => ({ ...r }));
    const idx = current.findIndex((r) => r.id === rule.id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], [field]: value, dirty: true };
      this._editableMyRules.set([...current]);
      this._myRulesSeeded.set(true);
    }
  }

  saveProjectAdminRule(rule: EditableAiRule): void {
    if (!rule.id) return;
    const current = this.localAdminRules.map((r) => ({ ...r }));
    const idx = current.findIndex((r) => r.id === rule.id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], saving: true };
      this._editableAdminRules.set([...current]);
      this._adminRulesSeeded.set(true);
    }
    this.aiRulesService.putApiAdminAiRulesId(rule.id, {
      title: rule.title,
      prompt: rule.prompt,
      isActive: rule.isActive,
    }).subscribe({
      next: () => {
        this.resetAiRuleDrafts();
        this.projectAiRulesResource.reload();
      },
      error: (e: unknown) => {
        const list = this._editableAdminRules();
        const i = list.findIndex((r) => r.id === rule.id);
        if (i !== -1) {
          list[i] = { ...list[i], saving: false };
          this._editableAdminRules.set([...list]);
        }
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  deleteProjectAdminRule(rule: EditableAiRule): void {
    if (!rule.id) return;
    this.aiRulesService.deleteApiAdminAiRulesId(rule.id).subscribe({
      next: () => {
        this.resetAiRuleDrafts();
        this.projectAiRulesResource.reload();
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }

  createProjectAdminRule(): void {
    const project = this.selectedAiProject();
    if (!project?.id || !this.newProjectRuleTitle.value.trim() || !this.newProjectRulePrompt.value.trim()) return;
    this.newProjectRuleBusy.set(true);
    this.aiRulesService.postApiAdminAiRules({
      projectId: project.id,
      title: this.newProjectRuleTitle.value.trim(),
      prompt: this.newProjectRulePrompt.value.trim(),
      sortOrder: this.rawAdminRules().length,
    }).subscribe({
      next: () => {
        this.newProjectRuleBusy.set(false);
        this.newProjectRuleTitle.reset();
        this.newProjectRulePrompt.reset();
        this.resetAiRuleDrafts();
        this.projectAiRulesResource.reload();
      },
      error: (e: unknown) => {
        this.newProjectRuleBusy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  savePersonalRule(rule: EditableAiRule): void {
    if (!rule.id) return;
    const current = this.localMyRules.map((r) => ({ ...r }));
    const idx = current.findIndex((r) => r.id === rule.id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], saving: true };
      this._editableMyRules.set([...current]);
      this._myRulesSeeded.set(true);
    }
    this.aiRulesService.putApiAiRulesMyId(rule.id, {
      title: rule.title,
      prompt: rule.prompt,
      isActive: rule.isActive,
    }).subscribe({
      next: () => {
        this.resetAiRuleDrafts();
        this.projectAiRulesResource.reload();
      },
      error: (e: unknown) => {
        const list = this._editableMyRules();
        const i = list.findIndex((r) => r.id === rule.id);
        if (i !== -1) {
          list[i] = { ...list[i], saving: false };
          this._editableMyRules.set([...list]);
        }
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  deletePersonalRule(rule: EditableAiRule): void {
    if (!rule.id) return;
    this.aiRulesService.deleteApiAiRulesMyId(rule.id).subscribe({
      next: () => {
        this.resetAiRuleDrafts();
        this.projectAiRulesResource.reload();
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }

  createPersonalRule(): void {
    const project = this.selectedAiProject();
    if (!project?.id || !this.newPersonalRuleTitle.value.trim() || !this.newPersonalRulePrompt.value.trim()) return;
    this.newPersonalRuleBusy.set(true);
    this.aiRulesService.postApiAiRulesMy({
      projectId: project.id,
      title: this.newPersonalRuleTitle.value.trim(),
      prompt: this.newPersonalRulePrompt.value.trim(),
      sortOrder: this.rawMyRules().length,
    }).subscribe({
      next: () => {
        this.newPersonalRuleBusy.set(false);
        this.newPersonalRuleTitle.reset();
        this.newPersonalRulePrompt.reset();
        this.resetAiRuleDrafts();
        this.projectAiRulesResource.reload();
      },
      error: (e: unknown) => {
        this.newPersonalRuleBusy.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  private resetAiRuleDrafts(): void {
    this._adminRulesSeeded.set(false);
    this._editableAdminRules.set([]);
    this._myRulesSeeded.set(false);
    this._editableMyRules.set([]);
  }

  openAiRules(project: ProjectResponse | null): void {
    if (!project) return;
    this.selectedAiProject.set(project);
    this.resetAiRuleDrafts();
    this.projectAiRulesResource.reload();
    this.aiRulesDialogRef = this.appDialog.openRef(this.aiRulesDialog(), {
      width: 'w-[min(560px,calc(100vw-32px))] max-h-[90vh] overflow-y-auto',
    });
    this.aiRulesDialogRef.closed.subscribe(() => {
      this.selectedAiProject.set(null);
      this.resetAiRuleDrafts();
    });
  }

  openAiRulesFromEdit(): void {
    const p = this.projects().find((proj) => proj.id === this.editingProjectId());
    if (p) this.openAiRules(p);
  }

  onRoleSelect(roleId: number): void {
    this.editForm.patchValue({ environmentSelectorRoleIds: [roleId] });
  }
}
