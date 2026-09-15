import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BidiModule } from '@angular/cdk/bidi';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import type { HttpErrorResponse } from '@angular/common/http';
import { AppEnvironmentsService, getApiAdminEnvironmentsResource } from '@moamen-ui/pointer-angular';
import type { AppEnvironmentResponse } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { ConfirmService } from '../../core/confirm.service';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppIconComponent } from '../../shared/ui/app-icon.component';
import { AppFormFieldComponent } from '../../shared/ui/app-form-field.component';
import { AppToastService } from '../../shared/ui/app-toast.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { AppSwitchComponent } from '../../shared/ui/app-switch.component';
import type { RowActionItem } from '../../shared/row-actions-menu/row-actions-menu.component';
import { AppDataTableComponent, type DataTableColumn } from '../../shared/ui/app-data-table.component';
import { DataTableCellDirective } from '../../shared/data-table/data-table-cell.directive';

/**
 * A super-admin-seeded global catalog ("default", "prod", "staging", "testing") every tenant
 * sees, plus each tenant's own custom environments layered on top — same own-plus-global shape
 * as the Roles page. A project can have one AppUrl per environment (see the Projects page).
 */
@Component({
  selector: 'app-environments',
  standalone: true,
  imports: [
    BidiModule,
    FormsModule,
    TranslocoModule,
    AppButtonDirective,
    AppInputDirective,
    AppIconComponent,
    AppFormFieldComponent,
    AppDataTableComponent,
    DataTableCellDirective,
    BadgeComponent,
    AppSwitchComponent,
  ],
  template: `
    <div class="space-y-6">
      <!-- Title row -->
      <div class="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
            {{ 'environments.title' | transloco }}
          </h1>
          <p class="mt-1 text-[14px] text-muted-foreground">
            {{ 'environments.subtitle' | transloco }}
          </p>
        </div>
        <button
          appButton
          variant="primary"
          (click)="openAdd()"
        >
          <app-icon name="plus" [size]="16"></app-icon>
          {{ 'environments.addEnvironment' | transloco }}
        </button>
      </div>

      <!-- Environments table (shared app-data-table: gutter, sortable name, ghost-row empty state) -->
      <app-data-table
        [rows]="environments()"
        [columns]="columns()"
        [actions]="actionsFor"
        [actionsAriaLabel]="'common.actions' | transloco"
        [gutter]="true"
        [paginated]="false"
        [emptyMessage]="'environments.empty' | transloco"
        [emptyHint]="'environments.emptyHint' | transloco"
      >
        <button emptyAction appButton variant="primary" size="sm" (click)="openAdd()">
          <app-icon name="plus" [size]="16"></app-icon>
          {{ 'environments.addEnvironment' | transloco }}
        </button>
        <ng-template appDataTableCell="name" let-env>
          <span class="font-medium">{{ env.name }}</span>
        </ng-template>
        <ng-template appDataTableCell="scope" let-env>
          <app-badge [severity]="env.isGlobal ? 'neutral' : 'primary'">
            {{ (env.isGlobal ? 'environments.global' : 'environments.own') | transloco }}
          </app-badge>
        </ng-template>
        <ng-template appDataTableCell="isEnabled" let-env>
          <app-switch
            [checked]="env.isEnabled ?? true"
            [disabled]="!env.canManage"
            (checkedChange)="toggleEnabled(env, $event)"
          />
        </ng-template>
      </app-data-table>
    </div>

    <!-- Add environment dialog -->
    @if (addOpen()) {
      <div
        class="fixed inset-0 z-40 bg-overlay"
        (click)="addOpen.set(false)"
      ></div>
      <div
        class="fixed top-1/2 start-1/2 z-50 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background shadow-dialog"
        [style.animation]="'scaleIn 120ms ease-out forwards'"
      >
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-[16px] font-semibold">
            {{ 'environments.addEnvironment' | transloco }}
          </h2>
        </div>
        <div class="px-5 py-2 space-y-4">
          <app-form-field [label]="'environments.name' | transloco" [error]="newNameError()">
            <input
              appInput
              [ngModel]="newName"
              (ngModelChange)="onNewNameChange($event)"
              placeholder="e.g. qa"
              (keydown.enter)="addFormValid() && addEnvironment()"
            />
          </app-form-field>
        </div>
        <div class="px-5 pb-5 pt-3 flex justify-end gap-2">
          <button
            appButton
            variant="secondary"
            size="sm"
            (click)="addOpen.set(false)"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            appButton
            variant="primary"
            size="sm"
            [disabled]="!addFormValid()"
            (click)="addEnvironment()"
          >
            <app-icon name="plus" [size]="16"></app-icon>
            {{ 'environments.addEnvironment' | transloco }}
          </button>
        </div>
      </div>
    }

    <!-- Rename environment dialog -->
    @if (renameOpen()) {
      <div
        class="fixed inset-0 z-40 bg-overlay"
        (click)="renameOpen.set(false)"
      ></div>
      <div
        class="fixed top-1/2 start-1/2 z-50 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background shadow-dialog"
        [style.animation]="'scaleIn 120ms ease-out forwards'"
      >
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-[16px] font-semibold">
            {{ 'common.rename' | transloco }}
          </h2>
        </div>
        <div class="px-5 py-2 space-y-4">
          <app-form-field [label]="'environments.name' | transloco" [error]="editNameError()">
            <input
              appInput
              [ngModel]="editName"
              (ngModelChange)="onEditNameChange($event)"
              (keydown.enter)="editFormValid() && saveRename()"
            />
          </app-form-field>
        </div>
        <div class="px-5 pb-5 pt-3 flex justify-end gap-2">
          <button
            appButton
            variant="secondary"
            size="sm"
            (click)="renameOpen.set(false)"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            appButton
            variant="primary"
            size="sm"
            [disabled]="!editFormValid()"
            (click)="saveRename()"
          >
            {{ 'common.save' | transloco }}
          </button>
        </div>
      </div>
    }

    <style>
      @keyframes scaleIn {
        from {
          transform: scale(0.98);
          opacity: 0;
        }
        to {
          transform: scale(1);
          opacity: 1;
        }
      }
    </style>
  `,
})
export class EnvironmentsComponent {
  private environmentsService = inject(AppEnvironmentsService);
  private toast = inject(AppToastService);
  private transloco = inject(TranslocoService);
  private confirmService = inject(ConfirmService);

  readonly environmentsResource = getApiAdminEnvironmentsResource();
  readonly environments = computed(() => this.environmentsResource.value() ?? []);

  readonly addOpen = signal(false);
  readonly renameOpen = signal(false);

  newName = '';
  editingEnvironment = signal<AppEnvironmentResponse | null>(null);
  editName = '';

  // #191 — client-side "unique per project" guard: true uniqueness enforcement is a DB/API
  // concern (the API lives in the separate `poitner-api` repo), so this only blocks the obvious
  // case (case-insensitive, trimmed match against environments already loaded) and surfaces a
  // server 409/duplicate response inline instead of a generic toast.
  readonly addServerError = signal('');
  readonly renameServerError = signal('');

  columns(): DataTableColumn<AppEnvironmentResponse>[] {
    return [
      { key: 'name', header: this.transloco.translate('environments.name'), sortable: true, mobile: 'primary' },
      { key: 'scope', header: this.transloco.translate('environments.scope') },
      { key: 'isEnabled', header: this.transloco.translate('common.active') },
    ];
  }

  readonly actionsFor = (env: AppEnvironmentResponse): RowActionItem[] => {
    if (!env.canManage) return [];
    return [
      {
        label: this.transloco.translate('common.rename'),
        icon: 'pencil',
        onClick: () => this.openRename(env),
      },
      {
        label: this.transloco.translate('common.delete'),
        icon: 'trash-2',
        severity: 'danger',
        onClick: () => this.confirmDelete(env),
      },
    ];
  };

  /** Case-insensitive, trimmed duplicate check against every environment already loaded (own +
   *  global) — `excludeId` lets a rename compare against every OTHER environment, not itself. */
  private isDuplicateName(name: string, excludeId?: number | null): boolean {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return false;
    return this.environments().some(
      (env) => env.id !== excludeId && (env.name ?? '').trim().toLowerCase() === normalized,
    );
  }

  private duplicateNameMessage(): string {
    return this.transloco.translate('environments.nameTaken');
  }

  newNameError(): string {
    if (this.addServerError()) return this.addServerError();
    return this.isDuplicateName(this.newName) ? this.duplicateNameMessage() : '';
  }

  editNameError(): string {
    if (this.renameServerError()) return this.renameServerError();
    return this.isDuplicateName(this.editName, this.editingEnvironment()?.id) ? this.duplicateNameMessage() : '';
  }

  addFormValid(): boolean {
    return !!this.newName.trim() && !this.newNameError();
  }

  editFormValid(): boolean {
    return !!this.editName.trim() && !this.editNameError();
  }

  onNewNameChange(value: string): void {
    this.newName = value;
    this.addServerError.set('');
  }

  onEditNameChange(value: string): void {
    this.editName = value;
    this.renameServerError.set('');
  }

  private isConflictError(e: unknown): boolean {
    const raw = e as (HttpErrorResponse & { error?: { isConflict?: boolean } }) | null;
    return raw?.status === 409 || raw?.error?.isConflict === true;
  }

  openAdd() {
    this.newName = '';
    this.addServerError.set('');
    this.addOpen.set(true);
  }

  addEnvironment() {
    const name = this.newName.trim();
    if (!name || this.newNameError()) return;
    this.addServerError.set('');
    this.environmentsService.postApiAdminEnvironments({ name }).subscribe({
      next: () => {
        this.addOpen.set(false);
        this.newName = '';
        this.environmentsResource.reload();
      },
      error: (e: unknown) => {
        if (this.isConflictError(e)) {
          this.addServerError.set(this.duplicateNameMessage());
        } else {
          this.toast.show(extractMessage(e), 'danger');
        }
      },
    });
  }

  openRename(env: AppEnvironmentResponse) {
    this.editingEnvironment.set(env);
    this.editName = env.name ?? '';
    this.renameServerError.set('');
    this.renameOpen.set(true);
  }

  saveRename() {
    const env = this.editingEnvironment();
    const name = this.editName.trim();
    if (!env || !name || name === env.name) {
      this.renameOpen.set(false);
      return;
    }
    if (this.editNameError()) return;
    this.environmentsService.patchApiAdminEnvironmentsId(env.id!, { name }).subscribe({
      next: () => {
        this.renameOpen.set(false);
        this.environmentsResource.reload();
      },
      error: (e: unknown) => {
        if (this.isConflictError(e)) {
          this.renameServerError.set(this.duplicateNameMessage());
        } else {
          this.toast.show(extractMessage(e), 'danger');
        }
      },
    });
  }

  toggleEnabled(env: AppEnvironmentResponse, enabled: boolean) {
    // If disabling and has URLs, show confirm dialog
    if (!enabled && (env.projectUrlCount ?? 0) > 0) {
      this.confirmService
        .confirm({
          message: this.transloco.translate('environments.confirmDisable', { name: env.name, count: env.projectUrlCount }),
          confirmLabel: this.transloco.translate('common.disable'),
          confirmColor: 'danger',
        })
        .subscribe((ok) => {
          if (ok) this.patchIsEnabled(env, enabled);
        });
    } else {
      this.patchIsEnabled(env, enabled);
    }
  }

  private patchIsEnabled(env: AppEnvironmentResponse, isEnabled: boolean) {
    this.environmentsService.patchApiAdminEnvironmentsId(env.id!, { isEnabled }).subscribe({
      next: () => {
        this.environmentsResource.reload();
        this.toast.show(this.transloco.translate('environments.updated'), 'success');
      },
      error: (e: unknown) => {
        this.environmentsResource.reload();
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  confirmDelete(env: AppEnvironmentResponse) {
    this.confirmService
      .confirm({
        message: this.transloco.translate('environments.confirmDelete', { name: env.name }),
        confirmLabel: this.transloco.translate('common.delete'),
        confirmColor: 'danger',
      })
      .subscribe((ok) => {
        if (ok) this.deleteEnvironment(env);
      });
  }

  private deleteEnvironment(env: AppEnvironmentResponse) {
    this.environmentsService.deleteApiAdminEnvironmentsId(env.id!).subscribe({
      next: () => {
        this.toast.show(this.transloco.translate('environments.deleted'), 'success');
        this.environmentsResource.reload();
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }
}
