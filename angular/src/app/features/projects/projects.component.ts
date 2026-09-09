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
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
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
import { AuthService } from '../../core/auth/auth.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import type { Severity } from '../../shared/severity';
import { DataTableCellDirective } from '../../shared/data-table/data-table-cell.directive';
import { DataTableComponent, type DataTableColumn } from '../../shared/data-table/data-table.component';
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
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatIconModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatSelectModule,
    TranslocoModule,
    DataTableComponent,
    DataTableCellDirective,
    BadgeComponent,
  ],
  template: `
    <div class="p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="m-0 text-[1.5em] font-bold">{{ 'projects.title' | transloco }}</h2>
        @if (!auth.isSuperAdmin()) {
          <button mat-flat-button color="primary" data-tour="add-project-btn" (click)="openAdd()">
            <mat-icon>add</mat-icon> {{ 'projects.addProject' | transloco }}
          </button>
        }
      </div>

      <!-- Super admins are platform-management only — they can't own a project (backend:
           ProjectService.CreateAsync forbids it). Point them at a real tenant account instead of
           showing an Add-Project affordance that would only 403. -->
      @if (auth.isSuperAdmin()) {
        <p class="mb-4 text-sm text-muted-foreground">{{ 'projects.superAdminNote' | transloco }}</p>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <app-data-table
        [rows]="projects()"
        [columns]="columns()"
        [actionsColumn]="{
          items: actionsFor,
          ariaLabel: 'projects.actions' | transloco,
          header: 'projects.actions' | transloco,
        }"
        [emptyIcon]="'folder_open'"
        [emptyMessage]="'projects.empty' | transloco"
        [emptyHint]="(auth.isSuperAdmin() ? 'projects.superAdminEmptyHint' : 'projects.emptyHint') | transloco"
      >
        @if (!auth.isSuperAdmin()) {
          <button emptyAction mat-flat-button color="primary" (click)="openAdd()">
            <mat-icon>add</mat-icon> {{ 'projects.addProject' | transloco }}
          </button>
        }
        <ng-template appDataTableCell="key" let-project><code>{{ project.key }}</code></ng-template>
        <ng-template appDataTableCell="status" let-project>
          <app-badge [severity]="activationSeverity(project.activationState)">
            {{ activationLabelKey(project.activationState) | transloco }}
          </app-badge>
        </ng-template>
        <ng-template appDataTableCell="createdBy" let-project>
          <span class="text-[0.85rem] text-muted">{{ project.createdByName }}</span>
        </ng-template>
        <ng-template appDataTableCell="comments" let-project>
          <span class="text-[0.85rem]">{{ project.commentsCount ?? 0 }}</span>
        </ng-template>
      </app-data-table>
    </div>

    <!-- Add project dialog -->
    <ng-template #addDialog>
      <h2 mat-dialog-title>{{ 'projects.addProject' | transloco }}</h2>
      <mat-dialog-content data-tour="project-modal-sections">
        <form [formGroup]="addForm" (ngSubmit)="addProject()" class="flex min-w-80 flex-col gap-3 pt-2">
          <!-- Name first: the key is derived from it (Pointer feedback #138). -->
          <mat-form-field appearance="outline">
            <mat-label>{{ 'projects.name' | transloco }}</mat-label>
            <input matInput formControlName="name" (input)="syncKeyFromName($event)" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'projects.key' | transloco }}</mat-label>
            <input
              matInput
              formControlName="key"
              maxlength="64"
              autocapitalize="none"
              spellcheck="false"
              (input)="onKeyEdited($event)"
            />
            <mat-hint>{{ (keyEdited() ? 'projects.keyHint' : 'projects.keyAutoHint') | transloco }}</mat-hint>
            @if (keyControl.hasError('required')) {
              <mat-error>{{ 'projects.keyRequired' | transloco }}</mat-error>
            } @else if (keyControl.hasError('pattern')) {
              <mat-error>{{ 'projects.keyPattern' | transloco }}</mat-error>
            } @else if (keyControl.hasError('maxlength')) {
              <mat-error>{{ 'projects.keyMaxLength' | transloco: { max: KEY_MAX_LENGTH } }}</mat-error>
            } @else if (keyControl.hasError('keyTaken')) {
              <mat-error>{{ 'projects.keyTaken' | transloco }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="mb-2">
            <mat-label>{{ 'projects.appUrl' | transloco }}</mat-label>
            <input matInput formControlName="appUrl" placeholder="https://staging.example.com" />
            <mat-hint>{{ 'projects.appUrlHint' | transloco }}</mat-hint>
          </mat-form-field>

          <!-- Predefined actions section -->
          <div class="mt-2">
            <div class="mb-1 text-[0.95rem] font-semibold">{{ 'predefined.section' | transloco }}</div>
            <p class="mb-2 text-[0.8rem] text-muted">{{ 'predefined.projectHelp' | transloco }}</p>
            <div formArrayName="predefinedActions" class="flex flex-col gap-3">
              @for (action of predefinedActionsArray.controls; track $index) {
                <div [formGroupName]="$index" class="rounded border border-app-border p-3 flex flex-col gap-2">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>{{ 'predefined.text' | transloco }}</mat-label>
                    <input matInput formControlName="text" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>{{ 'predefined.prompt' | transloco }}</mat-label>
                    <textarea matInput formControlName="prompt" rows="2"></textarea>
                  </mat-form-field>
                  <button mat-stroked-button color="warn" type="button" (click)="removeAction($index)">
                    <mat-icon>remove</mat-icon>
                  </button>
                </div>
              }
            </div>
            @if (predefinedActionsArray.length === 0) {
              <p class="text-[0.8rem] text-muted">{{ 'predefined.empty' | transloco }}</p>
            }
            <button mat-stroked-button type="button" class="mt-2 border-app-border" (click)="addAction()">
              <mat-icon>add</mat-icon> {{ 'predefined.add' | transloco }}
            </button>
          </div>
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary" (click)="addProject()" [disabled]="addForm.invalid || loading()">
          <mat-icon>add</mat-icon> {{ 'projects.addProject' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>

    <!-- Edit project dialog -->
    <ng-template #editDialog>
      <h2 mat-dialog-title>{{ 'projects.editTitle' | transloco }}</h2>
      <mat-dialog-content>
        <form [formGroup]="editForm" (ngSubmit)="saveEdit()" class="flex min-w-80 sm:min-w-[36rem] flex-col gap-3 pt-2">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'projects.name' | transloco }}</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="mb-2">
            <mat-label>{{ 'projects.appUrl' | transloco }}</mat-label>
            <input matInput formControlName="appUrl" placeholder="https://staging.example.com" />
            <mat-hint>{{ 'projects.appUrlHint' | transloco }}</mat-hint>
          </mat-form-field>

          <div class="mb-2">
            <div class="mb-1 text-[0.95rem] font-semibold">{{ 'projects.otherEnvironments' | transloco }}</div>
            <p class="mb-2 text-[0.8rem] text-muted">{{ 'projects.otherEnvironmentsHint' | transloco }}</p>
            @if (configuredEnvironments().length > 0 || showAddEnvRow()) {
              <table class="w-full border-collapse text-sm">
                <thead>
                  <tr class="text-start text-muted">
                    <th class="w-32 pb-1 ps-0 text-start font-medium">{{ 'environments.name' | transloco }}</th>
                    <th class="pb-1 ps-2 text-start font-medium">{{ 'projects.appUrl' | transloco }}</th>
                    <th class="w-20 pb-1 text-center font-medium">{{ 'common.active' | transloco }}</th>
                    <th class="w-14 pb-1"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (env of configuredEnvironments(); track env.appEnvironmentId) {
                    <tr>
                      <td class="py-1 pe-2 align-middle font-medium">{{ env.environmentName }}</td>
                      <td class="py-1 pe-2 align-middle">
                        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                          <input matInput placeholder="https://..."
                            [ngModel]="envDrafts()[env.appEnvironmentId!]?.url ?? ''"
                            [ngModelOptions]="{ standalone: true }"
                            (ngModelChange)="setEnvUrlDraft(env.appEnvironmentId!, $event)" />
                        </mat-form-field>
                      </td>
                      <td class="py-1 align-middle text-center">
                        <mat-slide-toggle
                          [checked]="envDrafts()[env.appEnvironmentId!]?.isActive ?? true"
                          (change)="setEnvActiveDraft(env.appEnvironmentId!, $event.checked)" />
                      </td>
                      <td class="py-1 align-middle whitespace-nowrap text-end">
                        <button mat-icon-button type="button" class="!text-red-600"
                          [attr.aria-label]="'common.delete' | transloco"
                          (click)="clearEnvironmentUrl(env.appEnvironmentId!)">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </td>
                    </tr>
                  }
                  @if (showAddEnvRow()) {
                    <tr>
                      <td class="py-1 pe-2 align-middle">
                        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                          <mat-select [value]="newEnvId()" (valueChange)="newEnvId.set($event)"
                            [placeholder]="'environments.name' | transloco">
                            @for (env of availableEnvironmentsToAdd(); track env.id) {
                              <mat-option [value]="env.id">{{ env.name }}</mat-option>
                            }
                          </mat-select>
                        </mat-form-field>
                      </td>
                      <td class="py-1 pe-2 align-middle">
                        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-full">
                          <input matInput placeholder="https://..."
                            [ngModel]="newEnvUrl()" [ngModelOptions]="{ standalone: true }"
                            (ngModelChange)="newEnvUrl.set($event)" />
                        </mat-form-field>
                      </td>
                      <td class="py-1 align-middle text-center">
                        <mat-slide-toggle [checked]="newEnvActive()"
                          (change)="newEnvActive.set($event.checked)" />
                      </td>
                      <td class="py-1 align-middle whitespace-nowrap">
                        <button mat-icon-button type="button" color="primary"
                          [disabled]="isAddingEnv() || !newEnvId() || !newEnvUrl().trim()"
                          [attr.aria-label]="'common.add' | transloco"
                          (click)="confirmAddEnvironment()">
                          <mat-icon>check</mat-icon>
                        </button>
                        <button mat-icon-button type="button"
                          [disabled]="isAddingEnv()"
                          [attr.aria-label]="'common.cancel' | transloco"
                          (click)="cancelAddEnvironment()">
                          <mat-icon>close</mat-icon>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
            @if (!showAddEnvRow() && availableEnvironmentsToAdd().length > 0) {
              <button mat-stroked-button type="button" class="mt-2 border-app-border" (click)="startAddEnvironment()">
                <mat-icon>add</mat-icon> {{ 'projects.addEnvironment' | transloco }}
              </button>
            }
          </div>

          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="font-medium">{{ 'projects.pageContextCapture' | transloco }}</div>
              <div class="text-xs text-muted-foreground">{{ 'projects.pageContextCaptureHint' | transloco }}</div>
            </div>
            <mat-slide-toggle formControlName="pageContextCaptureEnabled" />
          </div>

          <div class="mb-2">
            <div class="mb-1 text-[0.95rem] font-semibold">{{ 'projects.envSelectorRoles' | transloco }}</div>
            <p class="mb-2 text-[0.8rem] text-muted">{{ 'projects.envSelectorRolesHint' | transloco }}</p>
            <mat-form-field appearance="outline" class="w-full" subscriptSizing="dynamic">
              <mat-select formControlName="environmentSelectorRoleIds" multiple
                [placeholder]="'projects.envSelectorRolesPlaceholder' | transloco">
                @for (role of roles(); track role.id) {
                  <mat-option [value]="role.id">{{ role.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Predefined actions section (reused group) -->
          <div class="mt-2">
            <div class="mb-1 text-[0.95rem] font-semibold">{{ 'predefined.section' | transloco }}</div>
            <p class="mb-2 text-[0.8rem] text-muted">{{ 'predefined.projectHelp' | transloco }}</p>
            <div formArrayName="predefinedActions" class="flex flex-col gap-3">
              @for (action of editPredefinedActionsArray.controls; track $index) {
                <div [formGroupName]="$index" class="rounded border border-app-border p-3 flex flex-col gap-2">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>{{ 'predefined.text' | transloco }}</mat-label>
                    <input matInput formControlName="text" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>{{ 'predefined.prompt' | transloco }}</mat-label>
                    <textarea matInput formControlName="prompt" rows="2"></textarea>
                  </mat-form-field>
                  <button mat-stroked-button color="warn" type="button" (click)="removeEditAction($index)">
                    <mat-icon>remove</mat-icon>
                  </button>
                </div>
              }
            </div>
            @if (editPredefinedActionsArray.length === 0) {
              <p class="text-[0.8rem] text-muted">{{ 'predefined.empty' | transloco }}</p>
            }
            <button mat-stroked-button type="button" class="mt-2 border-app-border" (click)="addEditAction()">
              <mat-icon>add</mat-icon> {{ 'predefined.add' | transloco }}
            </button>
          </div>

          <!-- AI Roles & Rules button in edit dialog -->
          <div class="mt-4 flex items-center justify-between rounded border border-app-border p-3">
            <div>
              <div class="font-medium flex items-center gap-2">
                <mat-icon class="text-primary">psychology</mat-icon>
                {{ 'aiRules.section' | transloco }}
              </div>
              <div class="text-xs text-muted-foreground">{{ 'aiRules.projectHelp' | transloco }}</div>
            </div>
            <button mat-stroked-button type="button" (click)="openAiRulesFromEdit()">
              {{ 'aiRules.section' | transloco }}
            </button>
          </div>
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary" (click)="saveEdit()" [disabled]="editForm.invalid || loading()">
          <mat-icon>save</mat-icon> {{ 'common.save' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>

    <!-- View predefined prompts (read-only) dialog -->
    <ng-template #viewPromptsDialog>
      <h2 mat-dialog-title>{{ 'projects.viewPrompts' | transloco }}</h2>
      <mat-dialog-content>
        <div class="flex min-w-80 flex-col gap-3 pt-2">
          @if ((viewingProject()?.predefinedActions ?? []).length === 0) {
            <p class="text-[0.85rem] text-muted">{{ 'predefined.empty' | transloco }}</p>
          }
          @for (action of viewingProject()?.predefinedActions ?? []; track $index) {
            <div class="rounded border border-app-border p-3 flex flex-col gap-1">
              <div class="text-[0.85rem] font-semibold">{{ action.text }}</div>
              <div class="text-[0.8rem] text-muted whitespace-pre-wrap">{{ action.prompt }}</div>
            </div>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        @if (viewingProject(); as p) {
          <button mat-button color="primary" (click)="openAiRules(p)">
            <mat-icon>psychology</mat-icon> {{ 'aiRules.section' | transloco }}
          </button>
        }
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
      </mat-dialog-actions>
    </ng-template>

    <!-- Suggest prompt dialog -->
    <ng-template #suggestDialog>
      <h2 mat-dialog-title>{{ 'projects.suggest' | transloco }}</h2>
      <mat-dialog-content>
        <form [formGroup]="suggestForm" class="flex min-w-80 flex-col gap-3 pt-2">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'predefined.text' | transloco }}</mat-label>
            <input matInput formControlName="text" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'predefined.prompt' | transloco }}</mat-label>
            <textarea matInput formControlName="prompt" rows="3"></textarea>
          </mat-form-field>
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary" (click)="submitSuggest()" [disabled]="suggestForm.invalid || suggestBusy()">
          <mat-icon>send</mat-icon> {{ 'projects.suggest' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>

    <!-- Import dialog -->
    <ng-template #importDialog>
      <h2 mat-dialog-title>{{ 'exportImport.importTitle' | transloco }}</h2>
      <mat-dialog-content>
        <p class="mb-4 mt-1 text-[0.9rem] text-muted">{{ 'exportImport.importHint' | transloco }}</p>
        <div class="flex flex-col gap-3 min-w-80">
          <input #fileInput type="file" accept=".json" class="block w-full text-[0.9rem]"
            (change)="onFileSelected($event)" />
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close [disabled]="importBusy()">{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary" (click)="submitImport()" [disabled]="!importFile() || importBusy()">
          <mat-icon>upload</mat-icon> {{ 'exportImport.import' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>

    <!-- AI Roles & Rules dialog -->
    <ng-template #aiRulesDialog>
      <div class="flex items-center justify-between gap-3 pe-2">
        <h2 mat-dialog-title class="!m-0 flex items-center gap-2">
          <mat-icon class="text-primary">psychology</mat-icon>
          {{ 'aiRules.section' | transloco }}: {{ selectedAiProject()?.name }}
        </h2>
      </div>
      <mat-dialog-content>
        <p class="mb-4 text-[0.85rem] text-muted">{{ 'aiRules.projectHelp' | transloco }}</p>

        @if (projectAiRulesResource.isLoading()) {
          <mat-progress-bar mode="indeterminate" class="mb-4"></mat-progress-bar>
        }

        <div class="flex min-w-80 sm:min-w-[38rem] flex-col gap-6 pt-1">
          <!-- Section 1: Workspace & Project Admin Rules -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-[0.95rem] font-semibold">{{ 'aiRules.adminRulesTitle' | transloco }}</div>
                <div class="text-xs text-muted">{{ 'aiRules.adminRulesSubtitle' | transloco }}</div>
              </div>
            </div>

            <div class="mt-2 flex flex-col gap-3">
              @for (rule of localAdminRules; track rule.id ?? $index) {
                <div class="flex flex-col gap-2 rounded border border-app-border p-3">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 flex-1">
                      <span class="rounded px-1.5 py-0.5 text-xs font-semibold"
                        [class.bg-stat-slate-bg]="rule.isInherited"
                        [class.text-stat-slate]="rule.isInherited"
                        [class.bg-stat-blue-bg]="!rule.isInherited"
                        [class.text-primary]="!rule.isInherited">
                        {{ (rule.isInherited ? 'aiRules.inheritedBadge' : 'aiRules.projectBadge') | transloco }}
                      </span>
                      @if (!rule.isInherited && (selectedAiProject()?.canEdit || auth.isAdmin())) {
                        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="flex-1">
                          <input matInput [ngModel]="rule.title" (ngModelChange)="markAdminRuleDirty(rule, 'title', $event)" />
                        </mat-form-field>
                      } @else {
                        <span class="font-medium text-sm text-ink">{{ rule.title }}</span>
                      }
                    </div>
                    @if (!rule.isInherited && (selectedAiProject()?.canEdit || auth.isAdmin())) {
                      <mat-slide-toggle
                        [checked]="rule.isActive"
                        (change)="markAdminRuleDirty(rule, 'isActive', $event.checked)"
                      />
                    }
                  </div>

                  @if (!rule.isInherited && (selectedAiProject()?.canEdit || auth.isAdmin())) {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <textarea matInput rows="2" [ngModel]="rule.prompt" (ngModelChange)="markAdminRuleDirty(rule, 'prompt', $event)"></textarea>
                    </mat-form-field>
                    <div class="flex items-center gap-2">
                      <button mat-flat-button color="primary" [disabled]="!rule.dirty || rule.saving" (click)="saveProjectAdminRule(rule)">
                        {{ 'common.save' | transloco }}
                      </button>
                      <button mat-stroked-button color="warn" [disabled]="rule.saving" (click)="deleteProjectAdminRule(rule)">
                        <mat-icon>delete</mat-icon> {{ 'common.delete' | transloco }}
                      </button>
                    </div>
                  } @else {
                    <div class="text-xs text-muted whitespace-pre-wrap rounded bg-black/5 dark:bg-white/5 p-2 font-mono">{{ rule.prompt }}</div>
                  }
                </div>
              }

              @if (localAdminRules.length === 0 && !projectAiRulesResource.isLoading()) {
                <p class="text-[0.8rem] text-muted">{{ 'aiRules.empty' | transloco }}</p>
              }

              <!-- Add Project Rule Form (Admins / Project Editors only) -->
              @if (selectedAiProject()?.canEdit || auth.isAdmin()) {
                <div class="mt-2 flex flex-col gap-2 rounded border border-dashed border-app-border p-3">
                  <div class="text-xs font-semibold text-muted">{{ 'aiRules.addRule' | transloco }}</div>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>{{ 'aiRules.titleLabel' | transloco }}</mat-label>
                    <input matInput [formControl]="newProjectRuleTitle" [placeholder]="'aiRules.titlePlaceholder' | transloco" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>{{ 'aiRules.promptLabel' | transloco }}</mat-label>
                    <textarea matInput rows="2" [formControl]="newProjectRulePrompt" [placeholder]="'aiRules.promptPlaceholder' | transloco"></textarea>
                  </mat-form-field>
                  <div>
                    <button mat-flat-button color="primary"
                      [disabled]="newProjectRuleBusy() || !newProjectRuleTitle.value.trim() || !newProjectRulePrompt.value.trim()"
                      (click)="createProjectAdminRule()">
                      <mat-icon>add</mat-icon> {{ 'aiRules.addRule' | transloco }}
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Section 2: My Personal Rules -->
          <div class="flex flex-col gap-2 border-t border-app-border pt-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-[0.95rem] font-semibold">{{ 'aiRules.myRulesTitle' | transloco }}</div>
                <div class="text-xs text-muted">{{ 'aiRules.myRulesSubtitle' | transloco }}</div>
              </div>
            </div>

            <div class="mt-2 flex flex-col gap-3">
              @for (rule of localMyRules; track rule.id ?? $index) {
                <div class="flex flex-col gap-2 rounded border border-app-border p-3">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 flex-1">
                      <span class="rounded px-1.5 py-0.5 text-xs font-semibold bg-stat-amber-bg text-stat-amber">
                        {{ 'aiRules.personalBadge' | transloco }}
                      </span>
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="flex-1">
                        <input matInput [ngModel]="rule.title" (ngModelChange)="markMyRuleDirty(rule, 'title', $event)" />
                      </mat-form-field>
                    </div>
                    <mat-slide-toggle
                      [checked]="rule.isActive"
                      (change)="markMyRuleDirty(rule, 'isActive', $event.checked)"
                    />
                  </div>

                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <textarea matInput rows="2" [ngModel]="rule.prompt" (ngModelChange)="markMyRuleDirty(rule, 'prompt', $event)"></textarea>
                  </mat-form-field>
                  <div class="flex items-center gap-2">
                    <button mat-flat-button color="primary" [disabled]="!rule.dirty || rule.saving" (click)="savePersonalRule(rule)">
                      {{ 'common.save' | transloco }}
                    </button>
                    <button mat-stroked-button color="warn" [disabled]="rule.saving" (click)="deletePersonalRule(rule)">
                      <mat-icon>delete</mat-icon> {{ 'common.delete' | transloco }}
                    </button>
                  </div>
                </div>
              }

              @if (localMyRules.length === 0 && !projectAiRulesResource.isLoading()) {
                <p class="text-[0.8rem] text-muted">{{ 'aiRules.noPersonalRules' | transloco }}</p>
              }

              <!-- Add Personal Rule Form -->
              <div class="mt-2 flex flex-col gap-2 rounded border border-dashed border-app-border p-3">
                <div class="text-xs font-semibold text-muted">{{ 'aiRules.addPersonalRule' | transloco }}</div>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'aiRules.titleLabel' | transloco }}</mat-label>
                  <input matInput [formControl]="newPersonalRuleTitle" [placeholder]="'aiRules.titlePlaceholder' | transloco" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'aiRules.promptLabel' | transloco }}</mat-label>
                  <textarea matInput rows="2" [formControl]="newPersonalRulePrompt" [placeholder]="'aiRules.promptPlaceholder' | transloco"></textarea>
                </mat-form-field>
                <div>
                  <button mat-flat-button color="primary"
                    [disabled]="newPersonalRuleBusy() || !newPersonalRuleTitle.value.trim() || !newPersonalRulePrompt.value.trim()"
                    (click)="createPersonalRule()">
                    <mat-icon>add</mat-icon> {{ 'aiRules.addPersonalRule' | transloco }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
      </mat-dialog-actions>
    </ng-template>
  `,
})
export class ProjectsComponent {
  private projectsService = inject(ProjectsService);
  private exportImportService = inject(ExportImportService);
  private suggestionsService = inject(SuggestionsService);
  // Export uses HttpClient because the generated client only exposes a Signal-based
  // getApiProjectsKeyExportResource — no imperative variant exists.
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private transloco = inject(TranslocoService);
  private dialog = inject(MatDialog);
  private aiRulesService = inject(AiRulesService);
  auth = inject(AuthService);

  readonly addDialog = viewChild.required<TemplateRef<unknown>>('addDialog');
  readonly editDialog = viewChild.required<TemplateRef<unknown>>('editDialog');
  readonly viewPromptsDialog = viewChild.required<TemplateRef<unknown>>('viewPromptsDialog');
  readonly suggestDialog = viewChild.required<TemplateRef<unknown>>('suggestDialog');
  readonly importDialog = viewChild.required<TemplateRef<unknown>>('importDialog');
  readonly aiRulesDialog = viewChild.required<TemplateRef<unknown>>('aiRulesDialog');
  private dialogRef?: MatDialogRef<unknown>;
  private aiRulesDialogRef?: MatDialogRef<unknown>;

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

  // Per-environment App URLs (edit dialog only — a project must exist first). "default" is
  // covered by the ordinary "App URL" field above (ProjectService.SyncDefaultAppUrlAsync keeps
  // them in sync server-side), so it's excluded here to avoid showing the same value twice.
  environmentsResource = getApiAdminEnvironmentsResource();
  private editingProjectIdForUrls = computed(() => this.editingProjectId() ?? 0);
  projectAppUrlsResource = getApiAdminProjectsIdAppUrlsResource(this.editingProjectIdForUrls);

  // For the "show environment switcher for" multiselect below — every role this tenant can assign.
  rolesResource = getApiAdminRolesResource();
  roles = computed(() => this.rolesResource.value() ?? []);

  // Only rows that ALREADY have a saved URL for this project — not every environment the tenant
  // has ever defined. Each carries its own name/url/isActive straight from the response, so no
  // cross-referencing against environmentsResource is needed for existing rows.
  configuredEnvironments = computed(() =>
    (this.projectAppUrlsResource.value() ?? []).filter((u) => u.environmentName !== 'default'));

  // Environments not yet configured for this project — the "add new" row's dropdown options.
  availableEnvironmentsToAdd = computed(() => {
    const configuredIds = new Set(this.configuredEnvironments().map((u) => u.appEnvironmentId));
    return (this.environmentsResource.value() ?? []).filter((e) => e.name !== 'default' && !configuredIds.has(e.id!));
  });

  // Draft state per EXISTING row (url + isActive together) — overlays the loaded value with
  // whatever the user is actively editing. Rows have no save button of their own: the dialog's
  // single Save persists every dirty row (see saveEnvironmentChangesIfPending) together with the
  // reactive `editForm`. Delete stays immediate.
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
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  // ---- Add a new environment row ----
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
    if (!projectId || !envId || !url) return;

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
        this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
      },
    });
  }

  // Rows whose draft differs from what is loaded — the ones the dialog's Save must persist.
  private dirtyEnvironmentIds(): number[] {
    const loaded = this.envLoaded();
    return Object.entries(this.envOverrides())
      .filter(([id, draft]) => {
        const base = loaded[Number(id)];
        return !base || base.url !== draft.url || base.isActive !== draft.isActive;
      })
      .map(([id]) => Number(id));
  }

  // Persists every pending environment change — edited existing rows plus the "add environment"
  // row, if one is filled in — called from saveEdit() after the project's own fields are patched,
  // so the dialog's single Save button covers all of it. Rows with a blank URL are skipped, not
  // errors (same rule the per-row save used). Failures are surfaced individually; the rest go on.
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
            this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
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
            this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
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
      // Drop the drafts that landed; keep a failed row's edit so the user can retry it.
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

  // A method (not a stored field) so column headers stay live if the app language changes.
  columns(): DataTableColumn<ProjectResponse>[] {
    return [
      { key: 'key', header: this.transloco.translate('projects.key'), sortable: true },
      { key: 'name', header: this.transloco.translate('projects.name'), sortable: true },
      { key: 'status', header: this.transloco.translate('projects.status') },
      { key: 'createdBy', header: this.transloco.translate('projects.createdBy'), sortable: true },
      { key: 'comments', header: this.transloco.translate('projects.comments'), sortable: true },
    ];
  }

  /** Badge color for a project's per-environment activation rollup. */
  activationSeverity(state: ProjectActivationState | undefined): Severity {
    if (state === ProjectActivationState.NUMBER_2) return 'success';
    if (state === ProjectActivationState.NUMBER_1) return 'warning';
    return 'danger';
  }

  /** Transloco key for a project's per-environment activation rollup. */
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
      icon: 'psychology',
      disabled: busy,
      onClick: () => this.openAiRules(project),
    });
    if (project.canEdit) {
      items.push({ label: this.transloco.translate('projects.edit'), icon: 'edit', disabled: busy, onClick: () => this.openEdit(project) });
    } else {
      items.push({ label: this.transloco.translate('projects.viewPrompts'), icon: 'visibility', disabled: busy, onClick: () => this.openViewPrompts(project) });
      items.push({ label: this.transloco.translate('projects.suggest'), icon: 'lightbulb', disabled: busy, onClick: () => this.openSuggest(project) });
    }
    if (project.canEdit) {
      const anyActive = project.activationState !== ProjectActivationState.NUMBER_0;
      items.push({
        label: this.transloco.translate(anyActive ? 'common.disable' : 'common.enable'),
        icon: anyActive ? 'block' : 'check_circle',
        severity: anyActive ? 'danger' : 'neutral',
        disabled: busy,
        onClick: () => this.toggleActive(project),
      });
      items.push({ label: this.transloco.translate('exportImport.export'), icon: 'download', disabled: busy, onClick: () => this.exportProject(project) });
      if (this.auth.isSuperAdmin()) {
        items.push({ label: this.transloco.translate('exportImport.import'), icon: 'upload', disabled: busy, onClick: () => this.openImport(project) });
      }
    }
    // Delete stays last in every menu (Pointer feedback #137).
    items.push({
      label: this.transloco.translate('projects.delete'),
      icon: 'delete',
      severity: 'danger',
      disabled: busy || !project.canDelete,
      tooltip: project.canDelete ? undefined : this.transloco.translate('projects.deleteBlockedComments'),
      onClick: () => this.deleteProject(project),
    });
    return items;
  };

  // The key must match what the API accepts, or the request comes back as a raw
  // 400: FluentValidation checks the *unmodified* value (^[a-z0-9-]+$, max 64)
  // and only ProjectService lowercases it afterwards — so an uppercase key would
  // be rejected even though it would have been stored fine. normalizeKey() below
  // keeps the input in that shape while the user types.
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
    appUrl: [''],
    predefinedActions: this.fb.array([]),
  });

  get keyControl() {
    return this.addForm.controls.key;
  }

  /** True once the user edits the key by hand — auto-fill stops deferring to the name. */
  readonly keyEdited = signal(false);

  /**
   * Keeps the typed key in the shape the API accepts: lowercased and without
   * surrounding whitespace. Lowercasing does not change the length, so the caret
   * stays where the user left it.
   */
  normalizeKey(event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalized = input.value.toLowerCase().trim();
    if (normalized === input.value) return;
    input.value = normalized;
    this.keyControl.setValue(normalized);
  }

  /** Typing in the key takes ownership of it: the name stops driving it. */
  onKeyEdited(event: Event): void {
    this.keyEdited.set(true);
    this.normalizeKey(event);
  }

  /**
   * Derives the key from the project name while the user hasn't touched the key
   * themselves — "My New App" → "my-new-app". Stops the moment they edit the key,
   * and never fights a key they cleared back to empty on purpose.
   */
  syncKeyFromName(event: Event): void {
    if (this.keyEdited()) return;
    const name = (event.target as HTMLInputElement).value;
    this.keyControl.setValue(slugifyKey(name));
  }

  /** Flags a key that one of the caller's existing projects already uses (the API
   *  answers 409 for this; catching it here saves the round-trip). */
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
    appUrl: [''],
    pageContextCaptureEnabled: [false],
    isActiveLocal: [false],
    isActiveStaging: [false],
    isActiveProduction: [false],
    environmentSelectorRoleIds: this.fb.nonNullable.control<number[]>([]),
    predefinedActions: this.fb.array([]),
  });

  suggestForm = this.fb.nonNullable.group({
    text: ['', Validators.required],
    prompt: ['', Validators.required],
  });

  get predefinedActionsArray(): FormArray {
    return this.addForm.get('predefinedActions') as FormArray;
  }

  get editPredefinedActionsArray(): FormArray {
    return this.editForm.get('predefinedActions') as FormArray;
  }

  addAction(): void {
    this.predefinedActionsArray.push(
      this.fb.nonNullable.group({
        text: ['', Validators.required],
        prompt: ['', Validators.required],
      })
    );
  }

  removeAction(index: number): void {
    this.predefinedActionsArray.removeAt(index);
  }

  addEditAction(): void {
    this.editPredefinedActionsArray.push(
      this.fb.nonNullable.group({
        id: [null as number | null],
        text: ['', Validators.required],
        prompt: ['', Validators.required],
      })
    );
  }

  removeEditAction(index: number): void {
    this.editPredefinedActionsArray.removeAt(index);
  }

  openAdd() {
    this.keyEdited.set(false);
    this.addForm.reset({ key: '', name: '', appUrl: '' });
    while (this.predefinedActionsArray.length) {
      this.predefinedActionsArray.removeAt(0);
    }
    this.dialogRef = this.dialog.open(this.addDialog(), { width: '540px' });
  }

  openEdit(project: ProjectResponse): void {
    this.editingProjectId.set(project.id ?? null);
    this.envOverrides.set({}); // discard any unsaved per-environment draft from a prior project
    this.showAddEnvRow.set(false);
    this.editForm.reset({
      name: project.name ?? '',
      appUrl: project.appUrl ?? '',
      pageContextCaptureEnabled: !!project.pageContextCaptureEnabled,
      isActiveLocal: !!project.isActiveLocal,
      isActiveStaging: !!project.isActiveStaging,
      isActiveProduction: !!project.isActiveProduction,
      environmentSelectorRoleIds: project.environmentSelectorRoleIds ?? [],
    });
    while (this.editPredefinedActionsArray.length) {
      this.editPredefinedActionsArray.removeAt(0);
    }
    for (const action of project.predefinedActions ?? []) {
      this.editPredefinedActionsArray.push(
        this.fb.nonNullable.group({
          id: [action.id ?? null],
          text: [action.text ?? '', Validators.required],
          prompt: [action.prompt ?? '', Validators.required],
        })
      );
    }
    this.dialogRef = this.dialog.open(this.editDialog(), { width: '680px', maxWidth: '680px' });
  }

  openViewPrompts(project: ProjectResponse): void {
    this.viewingProject.set(project);
    this.dialogRef = this.dialog.open(this.viewPromptsDialog(), { width: '540px' });
  }

  openSuggest(project: ProjectResponse): void {
    this.suggestingProjectId.set(project.id ?? null);
    this.suggestForm.reset({ text: '', prompt: '' });
    this.dialogRef = this.dialog.open(this.suggestDialog(), { width: '480px' });
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
        this.snack.open(this.transloco.translate('suggestions.sent'), 'OK', { duration: 3000 });
      },
      error: (e: unknown) => {
        this.suggestBusy.set(false);
        const msg = (e as any)?.status === 403
          ? this.transloco.translate('suggestions.canEditDirectly')
          : extractMessage(e);
        this.snack.open(msg, 'OK', { duration: 4000 });
      },
    });
  }

  deleteProject(project: ProjectResponse): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          message: this.transloco.translate('projects.deleteConfirm'),
          confirmLabel: this.transloco.translate('projects.delete'),
          confirmColor: 'danger',
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.busy.set(true);
        this.projectsService.deleteApiAdminProjectsId(project.id!).subscribe({
          next: () => {
            this.busy.set(false);
            this.projectsResource.reload();
            this.snack.open(this.transloco.translate('projects.deleted'), 'OK', { duration: 3000 });
          },
          error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
        });
      });
  }

  addProject() {
    if (this.addForm.invalid) return;
    this.busy.set(true);
    const val = this.addForm.getRawValue();
    const predefinedActions = (val.predefinedActions as { text: string; prompt: string }[]).map((a, i) => ({
      text: a.text,
      prompt: a.prompt,
      sortOrder: i,
      isActive: true,
    }));
    this.projectsService.postApiAdminProjects({
      key: val.key,
      name: val.name,
      appUrl: val.appUrl?.trim() || undefined,
      predefinedActions,
    } as any).subscribe({
      next: () => {
        this.busy.set(false);
        this.dialogRef?.close();
        this.addForm.reset();
        this.projectsResource.reload();
      },
      error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
    });
  }

  saveEdit(): void {
    if (this.editForm.invalid) return;
    const id = this.editingProjectId();
    if (id == null) return;
    this.busy.set(true);
    const val = this.editForm.getRawValue();
    const predefinedActions = (val.predefinedActions as { id: number | null; text: string; prompt: string }[]).map(
      (a, i) => ({
        ...(a.id != null ? { id: a.id } : {}),
        text: a.text,
        prompt: a.prompt,
        sortOrder: i,
        isActive: true,
      })
    );
    this.projectsService.patchApiAdminProjectsId(id, {
      name: val.name,
      appUrl: val.appUrl?.trim() ?? '',
      pageContextCaptureEnabled: val.pageContextCaptureEnabled,
      isActiveLocal: val.isActiveLocal,
      isActiveStaging: val.isActiveStaging,
      isActiveProduction: val.isActiveProduction,
      environmentSelectorRoleIds: val.environmentSelectorRoleIds,
      predefinedActions,
    } as any).subscribe({
      next: () => {
        this.saveEnvironmentChangesIfPending(() => {
          this.busy.set(false);
          this.dialogRef?.close();
          this.projectsResource.reload();
          this.snack.open(this.transloco.translate('projects.saved'), 'OK', { duration: 3000 });
        });
      },
      error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
    });
  }

  // Quick bulk shortcut: active in ANY environment → turns ALL three off (with the
  // same confirm dialog as before); fully inactive (NUMBER_0) → turns ALL three on.
  toggleActive(project: ProjectResponse) {
    if (project.activationState === ProjectActivationState.NUMBER_0) {
      this.patchActive(project, true);
      return;
    }
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          message: this.transloco.translate('common.confirmDisable', { name: project.key }),
          confirmLabel: this.transloco.translate('common.disable'),
          confirmColor: 'danger',
        },
      })
      .afterClosed()
      .subscribe((ok) => {
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
      error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
    });
  }

  // --- Export ---
  // NOTE: The generated client only exposes getApiProjectsKeyExportResource (Signal-based httpResource)
  // for the export endpoint — no imperative method exists in ExportImportService for GET /api/projects/{key}/export.
  // Keeping HttpClient for this one-shot download call.
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
        this.snack.open(this.transloco.translate('exportImport.exported'), 'OK', { duration: 3000 });
      },
      error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
    });
  }

  // --- Import ---
  openImport(project: ProjectResponse): void {
    this.importProjectKey.set(project.key ?? '');
    this.importFile.set(null);
    this.dialogRef = this.dialog.open(this.importDialog(), { width: '480px' });
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
            this.snack.open(
              `${this.transloco.translate('exportImport.imported')} ${countMsg}`,
              'OK',
              { duration: 6000 }
            );
            if ((result.warnings ?? []).length > 0) {
              result.warnings!.forEach((w) =>
                this.snack.open(w, 'OK', { duration: 5000 })
              );
            }
            this.projectsResource.reload();
          },
          error: (e: unknown) => { this.importBusy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
        });
      } catch {
        this.importBusy.set(false);
        this.snack.open('Invalid JSON file', 'OK', { duration: 4000 });
      }
    };
    reader.readAsText(file);
  }

  // --- Project AI Roles & Rules ---

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
        this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
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
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
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
        this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
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
        this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
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
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
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
        this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
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
    this.aiRulesDialogRef = this.dialog.open(this.aiRulesDialog(), {
      width: '680px',
      maxWidth: '95vw',
      maxHeight: '90vh',
    });
    this.aiRulesDialogRef.afterClosed().subscribe(() => {
      this.selectedAiProject.set(null);
      this.resetAiRuleDrafts();
    });
  }

  openAiRulesFromEdit(): void {
    const p = this.projects().find((proj) => proj.id === this.editingProjectId());
    if (p) this.openAiRules(p);
  }
}
