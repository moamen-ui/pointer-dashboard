import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BidiModule } from '@angular/cdk/bidi';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
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
          <app-form-field [label]="'environments.name' | transloco">
            <input
              appInput
              [(ngModel)]="newName"
              placeholder="e.g. qa"
              (keydown.enter)="addEnvironment()"
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
            [disabled]="!newName.trim()"
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
          <app-form-field [label]="'environments.name' | transloco">
            <input
              appInput
              [(ngModel)]="editName"
              (keydown.enter)="saveRename()"
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
            [disabled]="!editName.trim()"
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

  columns(): DataTableColumn<AppEnvironmentResponse>[] {
    return [
      { key: 'name', header: this.transloco.translate('environments.name'), sortable: true },
      { key: 'scope', header: this.transloco.translate('environments.scope') },
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

  openAdd() {
    this.newName = '';
    this.addOpen.set(true);
  }

  addEnvironment() {
    const name = this.newName.trim();
    if (!name) return;
    this.environmentsService.postApiAdminEnvironments({ name }).subscribe({
      next: () => {
        this.addOpen.set(false);
        this.newName = '';
        this.environmentsResource.reload();
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }

  openRename(env: AppEnvironmentResponse) {
    this.editingEnvironment.set(env);
    this.editName = env.name ?? '';
    this.renameOpen.set(true);
  }

  saveRename() {
    const env = this.editingEnvironment();
    const name = this.editName.trim();
    if (!env || !name || name === env.name) {
      this.renameOpen.set(false);
      return;
    }
    this.environmentsService.patchApiAdminEnvironmentsId(env.id!, { name }).subscribe({
      next: () => {
        this.renameOpen.set(false);
        this.environmentsResource.reload();
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
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
