import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { PlansService, getApiAdminPlansResource } from '@moamen-ui/pointer-angular';
import type { PlanAdminResponse, PlanEntitlementsDto, PlanWriteDto } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

/** Editable form shape: entitlement number fields become string so an empty input maps to null;
 *  bool fields are tri-state (null = "use platform default"). */
interface EntitlementsForm {
  maxProjects: string;
  maxSeats: string;
  maxCommentsPerMonth: string;
  extensionEnabled: boolean | null;
  maxExtensionSites: string;
  maxPredefinedActionsPerProject: string;
  maxTenantWidePredefinedActions: string;
  retentionDays: string;
  maxEnvironments: string;
  maxActiveInvites: string;
  emailsPerMonth: string;
  extensionCommentsPerMonth: string;
  maxPendingSuggestions: string;
  exportImportEnabled: boolean | null;
  promptSuggestionsEnabled: boolean | null;
  customStatusesEnabled: boolean | null;
  prioritySupport: boolean | null;
}

interface PlanForm {
  name: string;
  slug: string;
  priceMonthly: number;
  currency: string;
  interval: 0 | 1;
  sortOrder: number;
  isActive: boolean;
  displayState: 0 | 1 | 2;
  featureBullets: string[];
  entitlements: EntitlementsForm;
}

function emptyEntitlementsForm(): EntitlementsForm {
  return {
    maxProjects: '', maxSeats: '', maxCommentsPerMonth: '',
    extensionEnabled: null, maxExtensionSites: '',
    maxPredefinedActionsPerProject: '', maxTenantWidePredefinedActions: '',
    retentionDays: '', maxEnvironments: '', maxActiveInvites: '',
    emailsPerMonth: '', extensionCommentsPerMonth: '',
    maxPendingSuggestions: '', exportImportEnabled: null,
    promptSuggestionsEnabled: null, customStatusesEnabled: null, prioritySupport: null,
  };
}

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    TranslocoModule,
  ],
  template: `
    <div class="p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="m-0 text-[1.5em] font-bold">{{ 'plans.title' | transloco }}</h2>
        <button mat-flat-button color="primary" (click)="openAdd()">
          <mat-icon>add</mat-icon> {{ 'plans.addPlan' | transloco }}
        </button>
      </div>

      @if (plansResource.error()) {
        <p class="text-red-500">{{ 'plans.loadError' | transloco }}</p>
      } @else if (plansResource.isLoading() && plans().length === 0) {
        <p class="text-muted">{{ 'plans.loading' | transloco }}</p>
      } @else if (plans().length === 0) {
        <p class="text-muted">{{ 'plans.empty' | transloco }}</p>
      } @else {
        <table mat-table [dataSource]="plans()" class="w-full mat-elevation-z2">

          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'plans.name' | transloco }}</th>
            <td mat-cell *matCellDef="let p">{{ p.name ?? '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="slug">
            <th mat-header-cell *matHeaderCellDef>{{ 'plans.slug' | transloco }}</th>
            <td mat-cell *matCellDef="let p"><code>{{ p.slug ?? '—' }}</code></td>
          </ng-container>

          <ng-container matColumnDef="price">
            <th mat-header-cell *matHeaderCellDef>{{ 'plans.price' | transloco }}</th>
            <td mat-cell *matCellDef="let p">{{ formatPrice(p) }}</td>
          </ng-container>

          <ng-container matColumnDef="isActive">
            <th mat-header-cell *matHeaderCellDef>{{ 'plans.active' | transloco }}</th>
            <td mat-cell *matCellDef="let p">
              <span class="chip" [class.chip-active]="p.isActive" [class.chip-disabled]="!p.isActive">
                {{ (p.isActive ? 'common.active' : 'common.disabled') | transloco }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="displayState">
            <th mat-header-cell *matHeaderCellDef>{{ 'plans.displayState' | transloco }}</th>
            <td mat-cell *matCellDef="let p">
              <span class="chip chip-neutral">{{ displayStateLabel(p.displayState) | transloco }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="activeSubs">
            <th mat-header-cell *matHeaderCellDef>{{ 'plans.activeSubs' | transloco }}</th>
            <td mat-cell *matCellDef="let p">{{ p.activeSubscriptions ?? 0 }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>{{ 'plans.actions' | transloco }}</th>
            <td mat-cell *matCellDef="let p">
              <div class="flex flex-wrap gap-2">
                <button mat-stroked-button (click)="openEdit(p)">
                  <mat-icon>edit</mat-icon> {{ 'plans.edit' | transloco }}
                </button>
                <button mat-stroked-button color="warn" (click)="confirmDelete(p)">
                  <mat-icon>delete</mat-icon> {{ 'plans.delete' | transloco }}
                </button>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      }
    </div>

    <!-- Add / Edit plan dialog -->
    <ng-template #planDialog>
      <h2 mat-dialog-title>{{ (editingPlan() ? 'plans.editPlan' : 'plans.addPlan') | transloco }}</h2>
      <mat-dialog-content>
        <div class="flex min-w-[520px] max-w-[90vw] flex-col gap-4 pt-2">

          <div class="grid grid-cols-2 gap-3">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.name' | transloco }}</mat-label>
              <input matInput [(ngModel)]="form.name" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.slug' | transloco }}</mat-label>
              <input matInput [(ngModel)]="form.slug" />
            </mat-form-field>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.price' | transloco }}</mat-label>
              <input matInput type="number" min="0" [(ngModel)]="form.priceMonthly" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.currency' | transloco }}</mat-label>
              <input matInput [(ngModel)]="form.currency" placeholder="USD" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.interval' | transloco }}</mat-label>
              <mat-select [(ngModel)]="form.interval">
                <mat-option [value]="0">{{ 'plans.intervalMonthly' | transloco }}</mat-option>
                <mat-option [value]="1">{{ 'plans.intervalYearly' | transloco }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.sortOrder' | transloco }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.sortOrder" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.displayState' | transloco }}</mat-label>
              <mat-select [(ngModel)]="form.displayState">
                <mat-option [value]="0">{{ 'plans.displayStateVisible' | transloco }}</mat-option>
                <mat-option [value]="1">{{ 'plans.displayStateComingSoon' | transloco }}</mat-option>
                <mat-option [value]="2">{{ 'plans.displayStateHidden' | transloco }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <mat-slide-toggle [(ngModel)]="form.isActive">
            {{ 'plans.isActive' | transloco }}
          </mat-slide-toggle>

          <!-- Feature bullets -->
          <div>
            <p class="m-0 mb-2 text-sm font-medium text-muted">{{ 'plans.featureBullets' | transloco }}</p>
            @for (bullet of form.featureBullets; track $index) {
              <div class="mb-2 flex items-center gap-2">
                <mat-form-field appearance="outline" class="flex-1">
                  <input matInput [(ngModel)]="form.featureBullets[$index]" />
                </mat-form-field>
                <button mat-icon-button color="warn" type="button" (click)="removeBullet($index)">
                  <mat-icon>remove_circle_outline</mat-icon>
                </button>
              </div>
            }
            <button mat-stroked-button type="button" (click)="addBullet()">
              <mat-icon>add</mat-icon> {{ 'plans.addBullet' | transloco }}
            </button>
          </div>

          <!-- Enforced entitlements -->
          <p class="m-0 mt-2 text-sm font-semibold">{{ 'plans.entitlementsEnforced' | transloco }}</p>
          <p class="m-0 -mt-3 text-xs text-muted">{{ 'plans.entitlementsHint' | transloco }}</p>

          <div class="grid grid-cols-2 gap-3">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.entMaxProjects' | transloco }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.entitlements.maxProjects" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.entMaxSeats' | transloco }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.entitlements.maxSeats" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.entMaxCommentsPerMonth' | transloco }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.entitlements.maxCommentsPerMonth" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.entMaxExtensionSites' | transloco }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.entitlements.maxExtensionSites" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.entMaxPredefinedActionsPerProject' | transloco }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.entitlements.maxPredefinedActionsPerProject" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.entMaxTenantWidePredefinedActions' | transloco }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.entitlements.maxTenantWidePredefinedActions" />
            </mat-form-field>
          </div>

          <mat-checkbox [indeterminate]="form.entitlements.extensionEnabled === null"
            [(ngModel)]="form.entitlements.extensionEnabled"
            (click)="cycleTri('extensionEnabled', $event)">
            {{ 'plans.entExtensionEnabled' | transloco }}
          </mat-checkbox>

          <!-- Display-only entitlements -->
          <p class="m-0 mt-2 text-sm font-semibold">{{ 'plans.entitlementsDisplay' | transloco }}</p>

          <div class="grid grid-cols-2 gap-3">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.entRetentionDays' | transloco }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.entitlements.retentionDays" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.entMaxEnvironments' | transloco }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.entitlements.maxEnvironments" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.entMaxActiveInvites' | transloco }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.entitlements.maxActiveInvites" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.entEmailsPerMonth' | transloco }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.entitlements.emailsPerMonth" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.entExtensionCommentsPerMonth' | transloco }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.entitlements.extensionCommentsPerMonth" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'plans.entMaxPendingSuggestions' | transloco }}</mat-label>
              <input matInput type="number" [(ngModel)]="form.entitlements.maxPendingSuggestions" />
            </mat-form-field>
          </div>

          <div class="flex flex-col gap-2">
            <mat-checkbox [indeterminate]="form.entitlements.exportImportEnabled === null"
              [(ngModel)]="form.entitlements.exportImportEnabled"
              (click)="cycleTri('exportImportEnabled', $event)">
              {{ 'plans.entExportImportEnabled' | transloco }}
            </mat-checkbox>
            <mat-checkbox [indeterminate]="form.entitlements.promptSuggestionsEnabled === null"
              [(ngModel)]="form.entitlements.promptSuggestionsEnabled"
              (click)="cycleTri('promptSuggestionsEnabled', $event)">
              {{ 'plans.entPromptSuggestionsEnabled' | transloco }}
            </mat-checkbox>
            <mat-checkbox [indeterminate]="form.entitlements.customStatusesEnabled === null"
              [(ngModel)]="form.entitlements.customStatusesEnabled"
              (click)="cycleTri('customStatusesEnabled', $event)">
              {{ 'plans.entCustomStatusesEnabled' | transloco }}
            </mat-checkbox>
            <mat-checkbox [indeterminate]="form.entitlements.prioritySupport === null"
              [(ngModel)]="form.entitlements.prioritySupport"
              (click)="cycleTri('prioritySupport', $event)">
              {{ 'plans.entPrioritySupport' | transloco }}
            </mat-checkbox>
          </div>

        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary"
          [disabled]="!form.name.trim() || !form.slug.trim() || saving()"
          (click)="save()">
          <mat-icon>save</mat-icon> {{ 'common.save' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>
  `,
})
export class PlansComponent {
  private plansService = inject(PlansService);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private dialog = inject(MatDialog);

  readonly planDialog = viewChild.required<TemplateRef<unknown>>('planDialog');
  private dialogRef?: MatDialogRef<unknown>;

  plansResource = getApiAdminPlansResource();
  // The HTTP interceptor unwraps the envelope, so the actual runtime value is PlanAdminResponse[].
  plans = computed(() => (this.plansResource.value() as unknown as PlanAdminResponse[]) ?? []);

  displayedColumns = ['name', 'slug', 'price', 'isActive', 'displayState', 'activeSubs', 'actions'];

  editingPlan = signal<PlanAdminResponse | null>(null);
  saving = signal(false);

  form: PlanForm = this.emptyForm();

  formatPrice(plan: PlanAdminResponse): string {
    if (!plan.priceMonthly) return this.transloco.translate('plans.free');
    const interval = plan.interval === 1 ? '/yr' : '/mo';
    return `${plan.priceMonthly} ${plan.currency ?? 'USD'} ${interval}`;
  }

  displayStateLabel(state: number | undefined): string {
    if (state === 1) return 'plans.displayStateComingSoon';
    if (state === 2) return 'plans.displayStateHidden';
    return 'plans.displayStateVisible';
  }

  private emptyForm(): PlanForm {
    return {
      name: '', slug: '', priceMonthly: 0, currency: 'USD', interval: 0,
      sortOrder: 0, isActive: true, displayState: 0, featureBullets: [],
      entitlements: emptyEntitlementsForm(),
    };
  }

  openAdd(): void {
    this.editingPlan.set(null);
    this.form = this.emptyForm();
    this.dialogRef = this.dialog.open(this.planDialog(), { width: '640px', maxHeight: '90vh' });
  }

  openEdit(plan: PlanAdminResponse): void {
    this.editingPlan.set(plan);
    const ent = plan.entitlements ?? {};
    const numStr = (v: number | null | undefined): string => (v === null || v === undefined ? '' : String(v));
    this.form = {
      name: plan.name ?? '',
      slug: plan.slug ?? '',
      priceMonthly: plan.priceMonthly ?? 0,
      currency: plan.currency ?? 'USD',
      interval: (plan.interval ?? 0) as 0 | 1,
      sortOrder: plan.sortOrder ?? 0,
      isActive: plan.isActive ?? true,
      displayState: (plan.displayState ?? 0) as 0 | 1 | 2,
      featureBullets: [...(plan.featureBullets ?? [])],
      entitlements: {
        maxProjects: numStr(ent.maxProjects),
        maxSeats: numStr(ent.maxSeats),
        maxCommentsPerMonth: numStr(ent.maxCommentsPerMonth),
        extensionEnabled: ent.extensionEnabled ?? null,
        maxExtensionSites: numStr(ent.maxExtensionSites),
        maxPredefinedActionsPerProject: numStr(ent.maxPredefinedActionsPerProject),
        maxTenantWidePredefinedActions: numStr(ent.maxTenantWidePredefinedActions),
        retentionDays: numStr(ent.retentionDays),
        maxEnvironments: numStr(ent.maxEnvironments),
        maxActiveInvites: numStr(ent.maxActiveInvites),
        emailsPerMonth: numStr(ent.emailsPerMonth),
        extensionCommentsPerMonth: numStr(ent.extensionCommentsPerMonth),
        maxPendingSuggestions: numStr(ent.maxPendingSuggestions),
        exportImportEnabled: ent.exportImportEnabled ?? null,
        promptSuggestionsEnabled: ent.promptSuggestionsEnabled ?? null,
        customStatusesEnabled: ent.customStatusesEnabled ?? null,
        prioritySupport: ent.prioritySupport ?? null,
      },
    };
    this.dialogRef = this.dialog.open(this.planDialog(), { width: '640px', maxHeight: '90vh' });
  }

  addBullet(): void {
    this.form.featureBullets = [...this.form.featureBullets, ''];
  }

  removeBullet(index: number): void {
    this.form.featureBullets = this.form.featureBullets.filter((_, i) => i !== index);
  }

  /** Tri-state bool checkbox: unset (null) → true → false → unset. */
  cycleTri(
    field: 'extensionEnabled' | 'exportImportEnabled' | 'promptSuggestionsEnabled' | 'customStatusesEnabled' | 'prioritySupport',
    event: Event,
  ): void {
    event.preventDefault();
    const current = this.form.entitlements[field];
    this.form.entitlements[field] = current === null ? true : current === true ? false : null;
  }

  save(): void {
    const editing = this.editingPlan();
    // Spec: empty number input → null (do NOT coerce to 0); -1 means unlimited.
    const toNum = (v: string): number | null => (v.trim() === '' ? null : Number(v));

    const e = this.form.entitlements;
    const entitlements: PlanEntitlementsDto = {
      maxProjects: toNum(e.maxProjects),
      maxSeats: toNum(e.maxSeats),
      maxCommentsPerMonth: toNum(e.maxCommentsPerMonth),
      extensionEnabled: e.extensionEnabled,
      maxExtensionSites: toNum(e.maxExtensionSites),
      maxPredefinedActionsPerProject: toNum(e.maxPredefinedActionsPerProject),
      maxTenantWidePredefinedActions: toNum(e.maxTenantWidePredefinedActions),
      retentionDays: toNum(e.retentionDays),
      maxEnvironments: toNum(e.maxEnvironments),
      maxActiveInvites: toNum(e.maxActiveInvites),
      emailsPerMonth: toNum(e.emailsPerMonth),
      extensionCommentsPerMonth: toNum(e.extensionCommentsPerMonth),
      maxPendingSuggestions: toNum(e.maxPendingSuggestions),
      exportImportEnabled: e.exportImportEnabled,
      promptSuggestionsEnabled: e.promptSuggestionsEnabled,
      customStatusesEnabled: e.customStatusesEnabled,
      prioritySupport: e.prioritySupport,
    };

    const body: PlanWriteDto = {
      name: this.form.name.trim(),
      slug: this.form.slug.trim(),
      priceMonthly: Number(this.form.priceMonthly) || 0,
      currency: this.form.currency.trim() || 'USD',
      interval: this.form.interval,
      sortOrder: Number(this.form.sortOrder) || 0,
      isActive: this.form.isActive,
      displayState: this.form.displayState,
      featureBullets: this.form.featureBullets.map((b) => b.trim()).filter((b) => b),
      entitlements,
    };

    this.saving.set(true);
    const call = editing
      ? this.plansService.patchApiAdminPlansId(editing.id!, body)
      : this.plansService.postApiAdminPlans(body);

    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef?.close();
        this.snack.open(this.transloco.translate('plans.saved'), 'OK', { duration: 3000 });
        this.plansResource.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snack.open(extractMessage(err), 'OK', { duration: 4000 });
      },
    });
  }

  confirmDelete(plan: PlanAdminResponse): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: this.transloco.translate('plans.deleteTitle'),
          message: this.transloco.translate('plans.deleteMessage', { name: plan.name }),
          confirmLabel: this.transloco.translate('plans.delete'),
          confirmColor: 'warn',
        },
      })
      .afterClosed()
      .subscribe((ok: boolean | undefined) => {
        if (ok) this.deletePlan(plan);
      });
  }

  private deletePlan(plan: PlanAdminResponse): void {
    this.plansService.deleteApiAdminPlansId(plan.id!).subscribe({
      next: () => {
        this.snack.open(this.transloco.translate('plans.deleted'), 'OK', { duration: 3000 });
        this.plansResource.reload();
      },
      error: (err: unknown) => {
        // 409 Conflict = plan has active subscriptions. The interceptor rethrows the
        // envelope message; if it's a conflict surface the friendly "in use" message.
        const raw = err as { status?: number; error?: { isConflict?: boolean } } | null;
        const isConflict = raw?.status === 409 || raw?.error?.isConflict === true;
        const msg = isConflict ? this.transloco.translate('plans.deleteConflict') : extractMessage(err);
        this.snack.open(msg, 'OK', { duration: 5000 });
      },
    });
  }
}
