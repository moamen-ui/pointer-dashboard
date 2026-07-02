import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TenantsService, getApiAdminTenantsResource, getApiAdminPlansResource } from '@moamen-ui/pointer-angular';
import type { TenantResponse, PlanAdminResponse } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    TranslocoModule,
  ],
  template: `
    <div class="p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="m-0 text-[1.5em] font-bold">{{ 'tenants.title' | transloco }}</h2>
        <button mat-flat-button color="primary" (click)="openAdd()">
          <mat-icon>add</mat-icon> {{ 'tenants.addTenant' | transloco }}
        </button>
      </div>

      @if (tenantsResource.error()) {
        <p class="text-red-500">{{ 'tenants.loadError' | transloco }}</p>
      } @else if (tenantsResource.isLoading() && tenants().length === 0) {
        <p class="text-muted">{{ 'tenants.loading' | transloco }}</p>
      } @else if (tenants().length === 0) {
        <p class="text-muted">{{ 'tenants.empty' | transloco }}</p>
      } @else {
        <table mat-table [dataSource]="tenants()" class="w-full mat-elevation-z2">

          <ng-container matColumnDef="displayName">
            <th mat-header-cell *matHeaderCellDef>{{ 'tenants.displayName' | transloco }}</th>
            <td mat-cell *matCellDef="let t">{{ t.displayName ?? '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>{{ 'tenants.email' | transloco }}</th>
            <td mat-cell *matCellDef="let t">{{ t.email ?? '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="approvalStatus">
            <th mat-header-cell *matHeaderCellDef>{{ 'tenants.approvalStatus' | transloco }}</th>
            <td mat-cell *matCellDef="let t">
              <span class="chip"
                [class.chip-active]="t.approvalStatus === 'approved'"
                [class.chip-neutral]="t.approvalStatus === 'pending'"
                [class.chip-disabled]="t.approvalStatus === 'rejected'">
                {{ t.approvalStatus ?? '—' }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="isActive">
            <th mat-header-cell *matHeaderCellDef>{{ 'tenants.status' | transloco }}</th>
            <td mat-cell *matCellDef="let t">
              <span class="chip" [class.chip-active]="t.isActive" [class.chip-disabled]="!t.isActive">
                {{ (t.isActive ? 'common.active' : 'common.disabled') | transloco }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="projects">
            <th mat-header-cell *matHeaderCellDef>{{ 'tenants.projects' | transloco }}</th>
            <td mat-cell *matCellDef="let t">{{ t.projects ?? 0 }}</td>
          </ng-container>

          <ng-container matColumnDef="comments">
            <th mat-header-cell *matHeaderCellDef>{{ 'tenants.comments' | transloco }}</th>
            <td mat-cell *matCellDef="let t">{{ t.comments ?? 0 }}</td>
          </ng-container>

          <ng-container matColumnDef="plan">
            <th mat-header-cell *matHeaderCellDef>{{ 'tenants.plan' | transloco }}</th>
            <td mat-cell *matCellDef="let t">
              <span class="chip chip-neutral">{{ t.planName ?? ('tenants.noPlan' | transloco) }}</span>
              @if (t.subscriptionStatus) {
                <span class="chip chip-active ms-1 text-[10px]">{{ t.subscriptionStatus }}</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="demoExpiry">
            <th mat-header-cell *matHeaderCellDef>{{ 'tenants.demoExpiry' | transloco }}</th>
            <td mat-cell *matCellDef="let t">
              @if (t.isDemo) {
                {{ t.expiresAt ? (t.expiresAt | date:'short') : '—' }}
              } @else {
                —
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>{{ 'tenants.actions' | transloco }}</th>
            <td mat-cell *matCellDef="let t">
              <div class="flex flex-wrap gap-2">
                @if (t.approvalStatus !== 'approved') {
                  <button mat-stroked-button color="primary" (click)="setStatus(t, 'approve')">
                    <mat-icon>check_circle</mat-icon> {{ 'tenants.approve' | transloco }}
                  </button>
                }
                @if (t.isActive) {
                  <button mat-stroked-button color="warn" (click)="setStatus(t, 'disable')">
                    <mat-icon>block</mat-icon> {{ 'common.disable' | transloco }}
                  </button>
                } @else {
                  <button mat-stroked-button color="primary" (click)="setStatus(t, 'enable')">
                    <mat-icon>check_circle</mat-icon> {{ 'common.enable' | transloco }}
                  </button>
                }
                <button mat-stroked-button color="warn" (click)="openDelete(t)">
                  <mat-icon>delete</mat-icon> {{ 'common.delete' | transloco }}
                </button>
                <button mat-stroked-button (click)="openChangePlan(t)">
                  <mat-icon>swap_horiz</mat-icon> {{ 'tenants.changePlan' | transloco }}
                </button>
                @if (t.isDemo) {
                  <button mat-stroked-button
                    [disabled]="t.demoExtended"
                    [matTooltip]="t.demoExtended ? ('tenants.extendOnce' | transloco) : ''"
                    (click)="extendDemo(t)">
                    <mat-icon>schedule</mat-icon> {{ 'tenants.extend' | transloco }}
                  </button>
                  <button mat-stroked-button (click)="openDemoConfig(t)">
                    <mat-icon>tune</mat-icon> {{ 'tenants.editDemoConfig' | transloco }}
                  </button>
                }
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      }
    </div>

    <!-- Add tenant dialog -->
    <ng-template #addDialog>
      <h2 mat-dialog-title>{{ 'tenants.addTenant' | transloco }}</h2>
      <mat-dialog-content>
        <div class="flex min-w-80 flex-col gap-4 pt-2">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'tenants.email' | transloco }}</mat-label>
            <input matInput type="email" [(ngModel)]="newEmail" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'tenants.displayName' | transloco }}</mat-label>
            <input matInput [(ngModel)]="newDisplayName" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'tenants.password' | transloco }}</mat-label>
            <input matInput type="password" [(ngModel)]="newPassword" />
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary"
          [disabled]="!newEmail.trim() || !newPassword.trim()"
          (click)="addTenant()">
          <mat-icon>add</mat-icon> {{ 'tenants.addTenant' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>

    <!-- Demo config dialog -->
    <ng-template #demoConfigDialog>
      <h2 mat-dialog-title>{{ 'tenants.editDemoConfig' | transloco }}</h2>
      <mat-dialog-content>
        <div class="flex min-w-80 flex-col gap-4 pt-2">
          <p class="text-xs text-muted-foreground m-0">{{ 'tenants.demoConfigHint' | transloco }}</p>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'tenants.commentCapOverride' | transloco }}</mat-label>
            <input matInput type="number" min="1"
              [(ngModel)]="demoConfigCapInput"
              [placeholder]="'tenants.overridePlaceholder' | transloco" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'tenants.ttlHoursOverride' | transloco }}</mat-label>
            <input matInput type="number" min="1"
              [(ngModel)]="demoConfigTtlInput"
              [placeholder]="'tenants.overridePlaceholder' | transloco" />
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary" (click)="saveDemoConfig()">
          {{ 'common.save' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>

    <!-- Change plan dialog -->
    <ng-template #changePlanDialog>
      <h2 mat-dialog-title>{{ 'tenants.changePlan' | transloco }}</h2>
      <mat-dialog-content>
        <div class="flex min-w-80 flex-col gap-4 pt-2">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'tenants.selectPlan' | transloco }}</mat-label>
            <mat-select [ngModel]="changePlanSelectedId()" (ngModelChange)="changePlanSelectedId.set($event)">
              <mat-option [value]="null">{{ 'tenants.noPlan' | transloco }}</mat-option>
              @for (plan of plans(); track plan.id) {
                <mat-option [value]="plan.id">{{ plan.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary" (click)="submitChangePlan()">
          {{ 'common.save' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>
  `,
})
export class TenantsComponent {
  private tenantsService = inject(TenantsService);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private dialog = inject(MatDialog);

  readonly addDialog = viewChild.required<TemplateRef<unknown>>('addDialog');
  readonly demoConfigDialog = viewChild.required<TemplateRef<unknown>>('demoConfigDialog');
  readonly changePlanDialog = viewChild.required<TemplateRef<unknown>>('changePlanDialog');
  private dialogRef?: MatDialogRef<unknown>;

  // Plans list for the change-plan dropdown. Interceptor unwraps the envelope → PlanAdminResponse[].
  plansResource = getApiAdminPlansResource();
  plans = computed(() => (this.plansResource.value() as unknown as PlanAdminResponse[]) ?? []);

  // Change-plan dialog state.
  changePlanTenant = signal<TenantResponse | null>(null);
  changePlanSelectedId = signal<number | null>(null);

  tenantsResource = getApiAdminTenantsResource();
  // The HTTP interceptor unwraps the envelope, so the actual runtime value is TenantResponse[].
  tenants = computed(() => (this.tenantsResource.value() as unknown as TenantResponse[]) ?? []);

  displayedColumns = ['displayName', 'email', 'approvalStatus', 'isActive', 'projects', 'comments', 'plan', 'demoExpiry', 'actions'];

  newEmail = '';
  newDisplayName = '';
  newPassword = '';

  deletingTenant = signal<TenantResponse | null>(null);

  // Demo config dialog state
  demoConfigTenant = signal<TenantResponse | null>(null);
  demoConfigCapInput = '';
  demoConfigTtlInput = '';

  openAdd() {
    this.newEmail = '';
    this.newDisplayName = '';
    this.newPassword = '';
    this.dialogRef = this.dialog.open(this.addDialog(), { width: '440px' });
  }

  addTenant() {
    const email = this.newEmail.trim();
    const password = this.newPassword.trim();
    if (!email || !password) return;
    this.tenantsService
      .postApiAdminTenants({ email, password, displayName: this.newDisplayName.trim() || undefined })
      .subscribe({
        next: () => {
          this.dialogRef?.close();
          this.tenantsResource.reload();
          this.snack.open(this.transloco.translate('tenants.created'), 'OK', { duration: 3000 });
        },
        error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
      });
  }

  setStatus(tenant: TenantResponse, action: 'approve' | 'enable' | 'disable') {
    this.tenantsService.patchApiAdminTenantsId(tenant.id!, { action }).subscribe({
      next: () => {
        this.tenantsResource.reload();
        this.snack.open(this.transloco.translate('tenants.statusUpdated'), 'OK', { duration: 3000 });
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  openDelete(tenant: TenantResponse) {
    this.deletingTenant.set(tenant);
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: this.transloco.translate('tenants.deleteTitle'),
          message: this.transloco.translate('tenants.deleteMessage', { name: tenant.displayName ?? tenant.email }),
          confirmLabel: this.transloco.translate('common.delete'),
          confirmColor: 'warn',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean | undefined) => {
        if (ok) this.deleteTenant(tenant);
      });
  }

  private deleteTenant(tenant: TenantResponse) {
    this.tenantsService.deleteApiAdminTenantsId(tenant.id!).subscribe({
      next: () => {
        this.tenantsResource.reload();
        this.snack.open(this.transloco.translate('tenants.deleted'), 'OK', { duration: 3000 });
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  extendDemo(tenant: TenantResponse) {
    (this.tenantsService as any).postApiAdminTenantsIdExtend(tenant.id!).subscribe({
      next: () => {
        this.tenantsResource.reload();
        this.snack.open(this.transloco.translate('tenants.extended'), 'OK', { duration: 3000 });
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  openDemoConfig(tenant: TenantResponse) {
    this.demoConfigTenant.set(tenant);
    // Pre-fill from existing overrides; blank string means "use global default"
    this.demoConfigCapInput = (tenant as any).demoCommentCapOverride != null
      ? String((tenant as any).demoCommentCapOverride)
      : '';
    this.demoConfigTtlInput = (tenant as any).demoTtlHoursOverride != null
      ? String((tenant as any).demoTtlHoursOverride)
      : '';
    this.dialogRef = this.dialog.open(this.demoConfigDialog(), { width: '440px' });
  }

  saveDemoConfig() {
    const tenant = this.demoConfigTenant();
    if (!tenant) return;
    const body = {
      commentCapOverride: this.demoConfigCapInput === '' ? null : Number(this.demoConfigCapInput),
      ttlHoursOverride: this.demoConfigTtlInput === '' ? null : Number(this.demoConfigTtlInput),
    };
    (this.tenantsService as any).patchApiAdminTenantsIdDemoConfig(tenant.id!, body).subscribe({
      next: () => {
        this.dialogRef?.close();
        this.tenantsResource.reload();
        this.snack.open(this.transloco.translate('tenants.demoConfigSaved'), 'OK', { duration: 3000 });
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }

  openChangePlan(tenant: TenantResponse) {
    this.changePlanTenant.set(tenant);
    // Preselect the tenant's current plan by matching planName against the plans list.
    const current = this.plans().find((p) => p.name === tenant.planName);
    this.changePlanSelectedId.set(current?.id ?? null);
    this.plansResource.reload();
    this.dialogRef = this.dialog.open(this.changePlanDialog(), { width: '400px' });
  }

  submitChangePlan() {
    const tenant = this.changePlanTenant();
    if (!tenant) return;
    // ChangeTenantPlanRequest.planId is a number; null clears the plan (back to Free).
    const planId = this.changePlanSelectedId();
    this.tenantsService.patchApiAdminTenantsIdPlan(tenant.id!, { planId: planId ?? undefined }).subscribe({
      next: () => {
        this.dialogRef?.close();
        this.tenantsResource.reload();
        this.snack.open(this.transloco.translate('tenants.planChanged'), 'OK', { duration: 3000 });
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }
}
