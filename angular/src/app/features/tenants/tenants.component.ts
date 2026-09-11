import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TenantsService, getApiAdminTenantsResource, getApiAdminPlansResource } from '@moamen-ui/pointer-angular';
import type { TenantResponse, PlanAdminResponse } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { ConfirmService } from '../../core/confirm.service';
import { AppDialogService } from '../../shared/ui/app-dialog.service';
import { AppToastService } from '../../shared/ui/app-toast.service';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppIconComponent } from '../../shared/ui/app-icon.component';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppSelectComponent, type SelectOption } from '../../shared/ui/app-select.component';
import { AppFormFieldComponent } from '../../shared/ui/app-form-field.component';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { AppDataTableComponent, type DataTableColumn } from '../../shared/ui/app-data-table.component';
import { DataTableCellDirective } from '../../shared/data-table/data-table-cell.directive';
import { type RowActionItem } from '../../shared/row-actions-menu/row-actions-menu.component';
import { AppDialogComponent, AppDialogBodyDirective, AppDialogFooterDirective } from '../../shared/ui/app-dialog.component';

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoModule,
    AppButtonDirective,
    AppIconComponent,
    AppInputDirective,
    AppSelectComponent,
    AppFormFieldComponent,
    BadgeComponent,
    AppDataTableComponent,
    DataTableCellDirective,
    AppDialogComponent,
    AppDialogBodyDirective,
    AppDialogFooterDirective,
  ],
  template: `
    <div class="flex-1 min-w-0 overflow-auto bg-background">
      <div class="mx-auto w-full max-w-[1120px]">
        <!-- Title row -->
        <div class="flex items-center justify-between gap-4 mb-6">
          <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
            {{ 'tenants.title' | transloco }}
          </h1>
          <button appButton variant="primary" size="sm" (click)="openAdd()">
            <app-icon name="plus" [size]="16"></app-icon>
            {{ 'tenants.addTenant' | transloco }}
          </button>
        </div>

        <!-- Loading / error states -->
        @if (tenantsResource.error()) {
          <div class="flex h-40 items-center justify-center text-sm text-state-danger">
            {{ 'tenants.loadError' | transloco }}
          </div>
        } @else if (tenantsResource.isLoading() && tenants().length === 0) {
          <div class="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {{ 'tenants.loading' | transloco }}
          </div>
        } @else {
          <!-- Data table -->
          <app-data-table
            [rows]="tenants()"
            [columns]="columns()"
            [actions]="actionsFor"
            [actionsHeader]="'tenants.actions' | transloco"
            [actionsAriaLabel]="'tenants.actions' | transloco"
            [emptyMessage]="'tenants.empty' | transloco"
            [emptyHint]="'tenants.emptyHint' | transloco"
            [gutter]="true"
            [paginated]="true"
          >
            <!-- Email / Display Name column -->
            <ng-template appDataTableCell="email" let-t>
              <div class="flex flex-col gap-0.5">
                <span class="text-[14px] font-medium">{{ t.email }}</span>
                <span class="text-[13px] text-muted-foreground">{{ t.displayName ?? '—' }}</span>
              </div>
            </ng-template>

            <!-- Approval status column -->
            <ng-template appDataTableCell="approvalStatus" let-t>
              <app-badge [severity]="approvalSeverity(t.approvalStatus)">
                <span>{{ approvalLabel(t.approvalStatus) }}</span>
              </app-badge>
            </ng-template>

            <!-- Status column -->
            <ng-template appDataTableCell="isActive" let-t>
              <app-badge [severity]="t.isActive ? 'success' : 'danger'">
                <span>{{ (t.isActive ? 'common.active' : 'common.disabled') | transloco }}</span>
              </app-badge>
            </ng-template>

            <!-- Projects count -->
            <ng-template appDataTableCell="projects" let-t>
              <span class="font-mono text-[14px]">{{ t.projects ?? 0 }}</span>
            </ng-template>

            <!-- Comments count -->
            <ng-template appDataTableCell="comments" let-t>
              <span class="font-mono text-[14px]">{{ t.comments ?? 0 }}</span>
            </ng-template>

            <!-- Plan column -->
            <ng-template appDataTableCell="plan" let-t>
              <app-badge severity="neutral">
                {{ t.planName ?? ('tenants.noPlan' | transloco) }}
              </app-badge>
            </ng-template>

            <!-- Demo expiry column -->
            <ng-template appDataTableCell="demoExpiry" let-t>
              <span class="font-mono text-[13px] text-muted-foreground">
                @if (t.isDemo) {
                  {{ formatExpiry(t.expiresAt) }}
                } @else {
                  —
                }
              </span>
            </ng-template>
            <button appButton variant="primary" size="sm" (click)="openAdd()" emptyAction>
              <app-icon name="plus" [size]="16"></app-icon>
              {{ 'tenants.addTenant' | transloco }}
            </button>
          </app-data-table>
        }
      </div>
    </div>

    <!-- Add tenant dialog -->
    <ng-template #addDialog>
      <app-dialog [title]="'tenants.addTenant' | transloco">
        <ng-template appDialogBody>
          <div class="space-y-4">
            <app-form-field [label]="'tenants.email' | transloco">
              <input
                appInput
                type="email"
                [(ngModel)]="newEmail"
                [placeholder]="'tenants.email' | transloco"
              />
            </app-form-field>

            <app-form-field [label]="'tenants.displayName' | transloco">
              <input
                appInput
                [(ngModel)]="newDisplayName"
                [placeholder]="'tenants.displayName' | transloco"
              />
            </app-form-field>

            <app-form-field [label]="'tenants.password' | transloco">
              <input
                appInput
                type="password"
                [(ngModel)]="newPassword"
                [placeholder]="'tenants.password' | transloco"
              />
            </app-form-field>
          </div>
        </ng-template>

        <ng-template appDialogFooter>
          <button appButton variant="secondary" size="sm" (click)="closeAddDialog()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            appButton
            variant="primary"
            size="sm"
            [disabled]="!newEmail.trim() || !newPassword.trim() || !newDisplayName.trim() || addCreating()"
            (click)="addTenant()"
          >
            <app-icon name="plus" [size]="16"></app-icon>
            {{ 'tenants.addTenant' | transloco }}
          </button>
        </ng-template>
      </app-dialog>
    </ng-template>

    <!-- Demo config dialog -->
    <ng-template #demoConfigDialog>
      <app-dialog [title]="'tenants.editDemoConfig' | transloco">
        <ng-template appDialogBody>
          <div class="space-y-4">
            <p class="text-[12px] text-muted-foreground m-0">
              {{ 'tenants.demoConfigHint' | transloco }}
            </p>

            <app-form-field [label]="'tenants.commentCapOverride' | transloco">
              <input
                appInput
                type="number"
                min="1"
                [(ngModel)]="demoConfigCapInput"
                [placeholder]="'tenants.overridePlaceholder' | transloco"
              />
            </app-form-field>

            <app-form-field [label]="'tenants.ttlHoursOverride' | transloco">
              <input
                appInput
                type="number"
                min="1"
                [(ngModel)]="demoConfigTtlInput"
                [placeholder]="'tenants.overridePlaceholder' | transloco"
              />
            </app-form-field>
          </div>
        </ng-template>

        <ng-template appDialogFooter>
          <button appButton variant="secondary" size="sm" (click)="closeDemoConfigDialog()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            appButton
            variant="primary"
            size="sm"
            [disabled]="demoConfigSaving()"
            (click)="saveDemoConfig()"
          >
            {{ 'common.save' | transloco }}
          </button>
        </ng-template>
      </app-dialog>
    </ng-template>

    <!-- Change plan dialog -->
    <ng-template #changePlanDialog>
      <app-dialog [title]="'tenants.changePlan' | transloco">
        <ng-template appDialogBody>
          <div class="space-y-4">
            <div class="text-[13px] font-medium text-foreground">
              {{ changePlanTenant()?.email ?? changePlanTenant()?.displayName ?? '' }}
            </div>
            <app-form-field [label]="'tenants.selectPlan' | transloco">
              <app-select
                [value]="changePlanSelectedId()"
                (valueChange)="changePlanSelectedId.set($event)"
                [options]="planOptions()"
                [disabled]="plans().length === 0"
              />
            </app-form-field>
          </div>
        </ng-template>

        <ng-template appDialogFooter>
          <button appButton variant="secondary" size="sm" (click)="closeChangePlanDialog()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            appButton
            variant="primary"
            size="sm"
            [disabled]="!changePlanSelectedId() || changePlanSaving()"
            (click)="submitChangePlan()"
          >
            {{ 'common.save' | transloco }}
          </button>
        </ng-template>
      </app-dialog>
    </ng-template>
  `,
})
export class TenantsComponent {
  private tenantsService = inject(TenantsService);
  private toast = inject(AppToastService);
  private appDialog = inject(AppDialogService);
  private confirm = inject(ConfirmService);
  private transloco = inject(TranslocoService);

  readonly addDialog = viewChild.required<TemplateRef<unknown>>('addDialog');
  readonly demoConfigDialog = viewChild.required<TemplateRef<unknown>>('demoConfigDialog');
  readonly changePlanDialog = viewChild.required<TemplateRef<unknown>>('changePlanDialog');

  // Tenants data
  tenantsResource = getApiAdminTenantsResource();
  tenants = computed(() => (this.tenantsResource.value() as unknown as TenantResponse[]) ?? []);

  // Plans data
  plansResource = getApiAdminPlansResource();
  plans = computed(() => (this.plansResource.value() as unknown as PlanAdminResponse[]) ?? []);
  planOptions = computed(() =>
    this.plans().map(p => ({ label: p.name ?? '', value: String(p.id ?? '') }))
  );

  // Add dialog state
  newEmail = '';
  newDisplayName = '';
  newPassword = '';
  addCreating = signal(false);

  // Demo config dialog state
  demoConfigTenant = signal<TenantResponse | null>(null);
  demoConfigCapInput = '';
  demoConfigTtlInput = '';
  demoConfigSaving = signal(false);

  // Change plan dialog state
  changePlanTenant = signal<TenantResponse | null>(null);
  changePlanSelectedId = signal<string | null>(null);
  changePlanSaving = signal(false);

  columns(): DataTableColumn<TenantResponse>[] {
    return [
      { key: 'email', header: this.transloco.translate('tenants.email') },
      { key: 'approvalStatus', header: this.transloco.translate('tenants.approval') },
      { key: 'isActive', header: this.transloco.translate('tenants.statusCol') },
      { key: 'projects', header: this.transloco.translate('tenants.projects') },
      { key: 'comments', header: this.transloco.translate('tenants.comments') },
      { key: 'plan', header: this.transloco.translate('tenants.planCol') },
      { key: 'demoExpiry', header: this.transloco.translate('tenants.demoExpiry') },
    ];
  }

  /** The API returns PascalCase ("Approved"), so normalize before comparing. */
  approvalSeverity(status: string | null | undefined): 'success' | 'danger' | 'warning' {
    switch ((status ?? '').toLowerCase()) {
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      default: return 'warning';
    }
  }

  approvalLabel(status: string | null | undefined): string {
    switch ((status ?? '').toLowerCase()) {
      case 'approved': return this.transloco.translate('common.approved');
      case 'rejected': return this.transloco.translate('common.rejected');
      case 'pending': return this.transloco.translate('common.pending');
      default: return status ?? '—';
    }
  }

  formatExpiry(expiresAt: string | null | undefined): string {
    if (!expiresAt) return '—';
    try {
      return new Date(expiresAt).toLocaleString();
    } catch {
      return expiresAt;
    }
  }

  readonly actionsFor = (tenant: TenantResponse): RowActionItem[] => {
    const items: RowActionItem[] = [];

    // Approve (anything not already approved; the API returns PascalCase)
    if ((tenant.approvalStatus ?? '').toLowerCase() !== 'approved') {
      items.push({
        label: this.transloco.translate('tenants.approve'),
        icon: 'shield-check',
        onClick: () => this.setStatus(tenant, 'approve'),
      });
    }

    // Enable / Disable
    if (tenant.isActive) {
      items.push({
        label: this.transloco.translate('common.disable'),
        icon: 'x',
        severity: 'danger',
        onClick: () => this.setStatus(tenant, 'disable'),
      });
    } else {
      items.push({
        label: this.transloco.translate('common.enable'),
        icon: 'circle-check',
        onClick: () => this.setStatus(tenant, 'enable'),
      });
    }

    // Demo actions (extend + config) — only for demo tenants
    if (tenant.isDemo) {
      items.push({
        label: this.transloco.translate('tenants.extend'),
        icon: 'clock',
        disabled: !!tenant.demoExtended,
        tooltip: tenant.demoExtended ? this.transloco.translate('tenants.extendOnce') : undefined,
        onClick: () => this.extendDemo(tenant),
      });
      items.push({
        label: this.transloco.translate('tenants.editDemoConfig'),
        icon: 'wrench',
        onClick: () => this.openDemoConfig(tenant),
      });
    }

    // Change plan
    items.push({
      label: this.transloco.translate('tenants.changePlan'),
      icon: 'credit-card',
      onClick: () => this.openChangePlan(tenant),
    });

    // Delete (last)
    items.push({
      label: this.transloco.translate('common.delete'),
      icon: 'trash-2',
      severity: 'danger',
      onClick: () => this.openDelete(tenant),
    });

    return items;
  };

  openAdd() {
    this.newEmail = '';
    this.newDisplayName = '';
    this.newPassword = '';
    this.addCreating.set(false);
    this.appDialog.openRef(this.addDialog());
  }

  closeAddDialog() {
    this.appDialog.closeAll();
  }

  addTenant() {
    const email = this.newEmail.trim();
    const password = this.newPassword.trim();
    const displayName = this.newDisplayName.trim();
    if (!email || !password || !displayName) return;

    this.addCreating.set(true);
    this.tenantsService
      .postApiAdminTenants({ email, password, displayName })
      .subscribe({
        next: () => {
          this.addCreating.set(false);
          this.closeAddDialog();
          this.tenantsResource.reload();
          this.toast.show(this.transloco.translate('tenants.created'), 'success');
        },
        error: (e: unknown) => {
          this.addCreating.set(false);
          this.toast.show(extractMessage(e), 'danger');
        },
      });
  }

  setStatus(tenant: TenantResponse, action: 'approve' | 'enable' | 'disable') {
    this.tenantsService.patchApiAdminTenantsId(tenant.id!, { action }).subscribe({
      next: () => {
        this.tenantsResource.reload();
        this.toast.show(this.transloco.translate('tenants.updated'), 'success');
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }

  extendDemo(tenant: TenantResponse) {
    (this.tenantsService as any).postApiAdminTenantsIdExtend(tenant.id!).subscribe({
      next: () => {
        this.tenantsResource.reload();
        this.toast.show(this.transloco.translate('tenants.extended'), 'success');
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }

  openDemoConfig(tenant: TenantResponse) {
    this.demoConfigTenant.set(tenant);
    this.demoConfigCapInput = (tenant as any).demoCommentCapOverride != null
      ? String((tenant as any).demoCommentCapOverride)
      : '';
    this.demoConfigTtlInput = (tenant as any).demoTtlHoursOverride != null
      ? String((tenant as any).demoTtlHoursOverride)
      : '';
    this.demoConfigSaving.set(false);
    this.appDialog.openRef(this.demoConfigDialog());
  }

  closeDemoConfigDialog() {
    this.appDialog.closeAll();
  }

  saveDemoConfig() {
    const tenant = this.demoConfigTenant();
    if (!tenant) return;

    this.demoConfigSaving.set(true);
    const body = {
      commentCapOverride: this.demoConfigCapInput === '' ? null : Number(this.demoConfigCapInput),
      ttlHoursOverride: this.demoConfigTtlInput === '' ? null : Number(this.demoConfigTtlInput),
    };
    (this.tenantsService as any).patchApiAdminTenantsIdDemoConfig(tenant.id!, body).subscribe({
      next: () => {
        this.demoConfigSaving.set(false);
        this.closeDemoConfigDialog();
        this.tenantsResource.reload();
        this.toast.show(this.transloco.translate('tenants.demoConfigSaved'), 'success');
      },
      error: (e: unknown) => {
        this.demoConfigSaving.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  openChangePlan(tenant: TenantResponse) {
    this.changePlanTenant.set(tenant);
    const current = this.plans().find((p) => p.name === tenant.planName);
    this.changePlanSelectedId.set(current?.id ? String(current.id) : null);
    this.changePlanSaving.set(false);
    this.plansResource.reload();
    this.appDialog.openRef(this.changePlanDialog());
  }

  closeChangePlanDialog() {
    this.appDialog.closeAll();
  }

  submitChangePlan() {
    const tenant = this.changePlanTenant();
    if (!tenant || !this.changePlanSelectedId()) return;

    this.changePlanSaving.set(true);
    const planId = Number(this.changePlanSelectedId());
    this.tenantsService.patchApiAdminTenantsIdPlan(tenant.id!, { planId }).subscribe({
      next: () => {
        this.changePlanSaving.set(false);
        this.closeChangePlanDialog();
        this.tenantsResource.reload();
        this.toast.show(this.transloco.translate('tenants.planChanged'), 'success');
      },
      error: (e: unknown) => {
        this.changePlanSaving.set(false);
        this.toast.show(extractMessage(e), 'danger');
      },
    });
  }

  openDelete(tenant: TenantResponse) {
    this.confirm.confirm({
      message: this.transloco.translate('tenants.deleteConfirm', { email: tenant.email }),
      confirmLabel: this.transloco.translate('common.delete'),
      confirmColor: 'danger',
    }).subscribe((ok: boolean) => {
      if (ok) this.deleteTenant(tenant);
    });
  }

  private deleteTenant(tenant: TenantResponse) {
    this.tenantsService.deleteApiAdminTenantsId(tenant.id!).subscribe({
      next: () => {
        this.tenantsResource.reload();
        this.toast.show(this.transloco.translate('tenants.deleted'), 'success');
      },
      error: (e: unknown) => this.toast.show(extractMessage(e), 'danger'),
    });
  }
}
