import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { PlansService, getApiAdminPlansResource, BillingInterval, PlanDisplayState } from '@moamen-ui/pointer-angular';
import type { PlanAdminResponse, PlanEntitlementsDto, PlanWriteDto } from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { AppDataTableComponent, type DataTableColumn } from '../../shared/ui/app-data-table.component';
import { DataTableCellDirective } from '../../shared/data-table/data-table-cell.directive';
import type { RowActionItem } from '../../shared/row-actions-menu/row-actions-menu.component';
import { RowActionsMenuComponent } from '../../shared/row-actions-menu/row-actions-menu.component';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppIconComponent } from '../../shared/ui/app-icon.component';
import { AppTabsComponent, type TabItem } from '../../shared/ui/app-tabs.component';
import { AppFormFieldComponent } from '../../shared/ui/app-form-field.component';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppSelectComponent, type SelectOption } from '../../shared/ui/app-select.component';
import { AppCheckboxComponent } from '../../shared/ui/app-checkbox.component';
import { AppDialogService } from '../../shared/ui/app-dialog.service';
import { AppToastService } from '../../shared/ui/app-toast.service';
import { ConfirmService } from '../../core/confirm.service';

// Blank entitlements form (all null = use platform default)
function emptyEntitlements(): PlanEntitlementsDto {
  return {
    maxProjects: null,
    maxSeats: null,
    maxCommentsPerMonth: null,
    extensionEnabled: null,
    maxExtensionSites: null,
    maxPredefinedActionsPerProject: null,
    maxTenantWidePredefinedActions: null,
    retentionDays: null,
    maxEnvironments: null,
    maxActiveInvites: null,
    emailsPerMonth: null,
    extensionCommentsPerMonth: null,
    maxPendingSuggestions: null,
    exportImportEnabled: null,
    promptSuggestionsEnabled: null,
    customStatusesEnabled: null,
    prioritySupport: null,
  };
}

// Blank form state
interface PlanFormState {
  name: string;
  slug: string;
  priceMonthly: string;
  currency: string;
  interval: string; // '0' | '1'
  sortOrder: string;
  isActive: boolean;
  displayState: string; // '0' | '1' | '2'
  featureBullets: string; // one per line
  entitlements: PlanEntitlementsDto;
}

function emptyForm(): PlanFormState {
  return {
    name: '',
    slug: '',
    priceMonthly: '',
    currency: 'USD',
    interval: '0',
    sortOrder: '0',
    isActive: true,
    displayState: '0',
    featureBullets: '',
    entitlements: emptyEntitlements(),
  };
}

function planToForm(plan: PlanAdminResponse): PlanFormState {
  return {
    name: plan.name ?? '',
    slug: plan.slug ?? '',
    priceMonthly: plan.priceMonthly != null ? String(plan.priceMonthly) : '',
    currency: plan.currency ?? 'USD',
    interval: String(plan.interval ?? 0),
    sortOrder: String(plan.sortOrder ?? 0),
    isActive: plan.isActive ?? true,
    displayState: String(plan.displayState ?? 0),
    featureBullets: (plan.featureBullets ?? []).join('\n'),
    entitlements: plan.entitlements ?? emptyEntitlements(),
  };
}

function formToDto(f: PlanFormState): PlanWriteDto {
  return {
    name: f.name.trim(),
    slug: f.slug.trim(),
    priceMonthly: f.priceMonthly === '' ? 0 : Number(f.priceMonthly),
    currency: f.currency.trim(),
    interval: Number(f.interval) as 0 | 1,
    sortOrder: Number(f.sortOrder) || 0,
    isActive: f.isActive,
    displayState: Number(f.displayState) as 0 | 1 | 2,
    featureBullets: f.featureBullets
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    entitlements: f.entitlements,
  };
}

// Convert nullable int field → string for <input>
function intToStr(v: number | null | undefined): string {
  return v == null ? '' : String(v);
}

// Parse input string → nullable int (empty=null, '-1'=unlimited, numeric=number)
function strToInt(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
}

function formatPrice(plan: PlanAdminResponse): string {
  if (!plan.priceMonthly) return 'Free';
  const interval = plan.interval === BillingInterval.NUMBER_1 ? '/yr' : '/mo';
  return `${plan.priceMonthly} ${plan.currency ?? 'USD'}${interval}`;
}

function displayStateBadge(state: number | undefined): string {
  if (state === PlanDisplayState.NUMBER_1) return 'coming-soon';
  if (state === PlanDisplayState.NUMBER_2) return 'hidden';
  return 'visible';
}

function displayStateSeverity(state: number | undefined): 'success' | 'neutral' | 'danger' {
  if (state === PlanDisplayState.NUMBER_1) return 'neutral';
  if (state === PlanDisplayState.NUMBER_2) return 'danger';
  return 'success';
}

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoModule,
    AppDataTableComponent,
    DataTableCellDirective,
    BadgeComponent,
    RowActionsMenuComponent,
    AppButtonDirective,
    AppIconComponent,
    AppTabsComponent,
    AppFormFieldComponent,
    AppInputDirective,
    AppSelectComponent,
    AppCheckboxComponent,
  ],
  template: `
    <div class="flex flex-col gap-6">
      <!-- Title row -->
      <div class="flex items-center justify-between gap-4">
        <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
          {{ 'plans.title' | transloco }}
        </h1>
        <button appButton variant="primary" size="sm" (click)="openCreate()">
          <app-icon name="plus" [size]="16"></app-icon>
          {{ 'plans.addPlan' | transloco }}
        </button>
      </div>

      <!-- Table -->
      @if (plansResource.error()) {
        <div class="flex h-40 items-center justify-center text-sm text-destructive">
          {{ 'plans.loadError' | transloco }}
        </div>
      } @else if (plansResource.isLoading() && plans().length === 0) {
        <div class="flex h-40 items-center justify-center text-sm text-muted-foreground">
          {{ 'plans.loading' | transloco }}
        </div>
      } @else {
        <app-data-table
          [rows]="plans()"
          [columns]="columns()"
          [gutter]="true"
          [paginated]="true"
          [emptyMessage]="'plans.empty' | transloco"
          [emptyHint]="'plans.emptyHint' | transloco"
        >
          <!-- Name cell -->
          <ng-template appDataTableCell="name" let-p>
            <span class="font-medium">{{ p.name ?? '—' }}</span>
          </ng-template>

          <!-- Slug cell (mono key chip) -->
          <ng-template appDataTableCell="slug" let-p>
            <span class="font-mono text-[13px] text-muted-foreground">
              {{ p.slug ?? '—' }}
            </span>
          </ng-template>

          <!-- Price cell (mono) -->
          <ng-template appDataTableCell="price" let-p>
            <span class="font-mono text-[14px]">{{ formatPrice(p) }}</span>
          </ng-template>

          <!-- Active cell (badge) -->
          <ng-template appDataTableCell="isActive" let-p>
            <app-badge [severity]="p.isActive ? 'success' : 'danger'">
              {{ (p.isActive ? 'common.active' : 'common.disabled') | transloco }}
            </app-badge>
          </ng-template>

          <!-- Display state cell (badge) -->
          <ng-template appDataTableCell="displayState" let-p>
            <app-badge [severity]="displayStateSeverity(p.displayState)">
              {{ 'plans.displayState.' + displayStateBadge(p.displayState) | transloco }}
            </app-badge>
          </ng-template>

          <!-- Subscriptions cell (mono) -->
          <ng-template appDataTableCell="subscriptions" let-p>
            <span class="font-mono text-[14px]">{{ p.activeSubscriptions ?? 0 }}</span>
          </ng-template>

          <!-- Actions cell -->
          <ng-template appDataTableCell="actions" let-p>
            <app-row-actions-menu
              [items]="getRowActions(p)"
              [ariaLabel]="'plans.actions' | transloco"
            />
          </ng-template>
        </app-data-table>
      }
    </div>

    <!-- Create / Edit dialog with Tabs: Details / Enforced / Display-only -->
    <ng-template #planDialog>
      <div class="px-5 pt-5 pb-3">
        <h2 class="text-[16px] font-semibold">
          {{ (editingPlan() ? 'plans.editPlan' : 'plans.addPlan') | transloco }}
        </h2>
      </div>

      <div class="px-5 py-2">
        <app-tabs [tabs]="tabItems" (selected)="onTabChange($event)"></app-tabs>

        <!-- Details tab -->
        @if (selectedTab() === 'details') {
          <div class="space-y-4 py-4">
            <div class="grid grid-cols-2 gap-4">
              <app-form-field [label]="'plans.colName' | transloco">
                <input appInput [(ngModel)]="form.name" type="text" />
              </app-form-field>
              <app-form-field [label]="'plans.colSlug' | transloco">
                <input appInput [(ngModel)]="form.slug" type="text" />
              </app-form-field>
              <app-form-field [label]="'plans.priceMonthly' | transloco">
                <input appInput [(ngModel)]="form.priceMonthly" type="number" min="0" />
              </app-form-field>
              <app-form-field [label]="'plans.currency' | transloco">
                <input appInput [(ngModel)]="form.currency" type="text" />
              </app-form-field>
              <app-form-field [label]="'plans.interval' | transloco">
                <app-select [options]="intervalOptions()" [(value)]="form.interval"></app-select>
              </app-form-field>
              <app-form-field [label]="'plans.sortOrder' | transloco">
                <input appInput [(ngModel)]="form.sortOrder" type="number" />
              </app-form-field>
              <app-form-field [label]="'plans.displayStateLabel' | transloco">
                <app-select [options]="displayStateOptions()" [(value)]="form.displayState"></app-select>
              </app-form-field>
            </div>

            <!-- Active checkbox -->
            <div class="flex items-center gap-2">
              <app-checkbox [(checked)]="form.isActive" id="plan-active"></app-checkbox>
              <label for="plan-active" class="text-[13px] font-medium text-foreground">
                {{ 'plans.isActive' | transloco }}
              </label>
            </div>

            <!-- Feature bullets textarea -->
            <app-form-field [label]="'plans.featureBullets' | transloco" [hint]="'plans.bulletsPlaceholder' | transloco">
              <textarea
                appInput
                [(ngModel)]="form.featureBullets"
                rows="4"
                class="resize-none"
              ></textarea>
            </app-form-field>
          </div>
        }

        <!-- Enforced entitlements tab -->
        @if (selectedTab() === 'enforced') {
          <div class="space-y-4 py-4">
            <div class="grid grid-cols-2 gap-4">
              @for (field of enforcedEntitlementFields; track field.key) {
                <app-form-field [label]="field.label | transloco" [hint]="'plans.entitlementsHint' | transloco">
                  @if (field.isBool) {
                    <app-select
                      [options]="boolOptions()"
                      [value]="getBoolValue(field.key)"
                      (valueChange)="updateBoolEntitlement(field.key, $event)"
                    ></app-select>
                  } @else {
                    <input appInput
                      type="number"
                      [value]="intToStr(getNumValue(field.key))"
                      (input)="updateNumEntitlement(field.key, $event)"
                    />
                  }
                </app-form-field>
              }
            </div>
          </div>
        }

        <!-- Display-only entitlements tab -->
        @if (selectedTab() === 'display') {
          <div class="space-y-4 py-4">
            <div class="grid grid-cols-2 gap-4">
              @for (field of displayOnlyEntitlementFields; track field.key) {
                <app-form-field [label]="field.label | transloco" [hint]="'plans.entitlementsHint' | transloco">
                  @if (field.isBool) {
                    <app-select
                      [options]="boolOptions()"
                      [value]="getBoolValue(field.key)"
                      (valueChange)="updateBoolEntitlement(field.key, $event)"
                    ></app-select>
                  } @else {
                    <input appInput
                      type="number"
                      [value]="intToStr(getNumValue(field.key))"
                      (input)="updateNumEntitlement(field.key, $event)"
                    />
                  }
                </app-form-field>
              }
            </div>
          </div>
        }
      </div>

      <!-- Footer -->
      <div class="px-5 pb-5 pt-3 flex justify-end gap-2">
        <button appButton variant="secondary" (click)="closeDialog()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button appButton
          variant="primary"
          [disabled]="!form.name.trim() || isSaving()"
          (click)="save()">
          {{ 'common.save' | transloco }}
        </button>
      </div>
    </ng-template>
  `,
})
export class PlansComponent {
  private readonly plansService = inject(PlansService);
  private readonly toast = inject(AppToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly appDialog = inject(AppDialogService);
  private readonly confirm = inject(ConfirmService);

  readonly planDialog = viewChild.required<TemplateRef<unknown>>('planDialog');
  private dialogRef: any;

  plansResource = getApiAdminPlansResource();
  plans = computed(() => (this.plansResource.value() as unknown as PlanAdminResponse[]) ?? []);

  selectedTab = signal<string>('details');
  tabItems: TabItem[] = [
    { id: 'details', label: this.transloco.translate('plans.details') },
    { id: 'enforced', label: this.transloco.translate('plans.enforcedSection') },
    { id: 'display', label: this.transloco.translate('plans.displayOnlySection') },
  ];

  enforcedEntitlementFields = [
    { key: 'maxProjects', label: 'plans.ent.maxProjects' },
    { key: 'maxSeats', label: 'plans.ent.maxSeats' },
    { key: 'maxCommentsPerMonth', label: 'plans.ent.maxCommentsPerMonth' },
    { key: 'extensionEnabled', label: 'plans.ent.extensionEnabled', isBool: true },
    { key: 'maxExtensionSites', label: 'plans.ent.maxExtensionSites' },
    { key: 'maxPredefinedActionsPerProject', label: 'plans.ent.maxPredefinedActionsPerProject' },
    { key: 'maxTenantWidePredefinedActions', label: 'plans.ent.maxTenantWidePredefinedActions' },
  ];

  displayOnlyEntitlementFields = [
    { key: 'retentionDays', label: 'plans.ent.retentionDays' },
    { key: 'maxEnvironments', label: 'plans.ent.maxEnvironments' },
    { key: 'maxActiveInvites', label: 'plans.ent.maxActiveInvites' },
    { key: 'emailsPerMonth', label: 'plans.ent.emailsPerMonth' },
    { key: 'extensionCommentsPerMonth', label: 'plans.ent.extensionCommentsPerMonth' },
    { key: 'maxPendingSuggestions', label: 'plans.ent.maxPendingSuggestions' },
    { key: 'exportImportEnabled', label: 'plans.ent.exportImportEnabled', isBool: true },
    { key: 'promptSuggestionsEnabled', label: 'plans.ent.promptSuggestionsEnabled', isBool: true },
    { key: 'customStatusesEnabled', label: 'plans.ent.customStatusesEnabled', isBool: true },
    { key: 'prioritySupport', label: 'plans.ent.prioritySupport', isBool: true },
  ];

  columns = computed(() => [
    { key: 'name', header: this.transloco.translate('plans.colName') },
    { key: 'slug', header: this.transloco.translate('plans.colSlug') },
    { key: 'price', header: this.transloco.translate('plans.colPrice') },
    { key: 'isActive', header: this.transloco.translate('plans.colActive') },
    { key: 'displayState', header: this.transloco.translate('plans.colDisplay') },
    { key: 'subscriptions', header: this.transloco.translate('plans.colSubs') },
    { key: 'actions', header: this.transloco.translate('plans.actions') },
  ]);

  editingPlan = signal<PlanAdminResponse | null>(null);
  isSaving = signal(false);
  form: PlanFormState = emptyForm();

  readonly formatPrice = formatPrice;
  readonly displayStateBadge = displayStateBadge;
  readonly displayStateSeverity = displayStateSeverity;
  readonly intToStr = intToStr;

  intervalOptions = () => [
    { value: '0', label: this.transloco.translate('plans.intervalMonthly') },
    { value: '1', label: this.transloco.translate('plans.intervalYearly') },
  ];

  displayStateOptions = () => [
    { value: '0', label: this.transloco.translate('plans.displayState.visible') },
    { value: '1', label: this.transloco.translate('plans.displayState.coming-soon') },
    { value: '2', label: this.transloco.translate('plans.displayState.hidden') },
  ];

  getRowActions(plan: PlanAdminResponse): RowActionItem[] {
    return [
      {
        label: this.transloco.translate('common.rename'),
        icon: 'pencil',
        onClick: () => this.openEdit(plan),
      },
      {
        label: this.transloco.translate('plans.delete'),
        icon: 'trash-2',
        severity: 'danger',
        disabled: this.isSaving(),
        onClick: () => this.startDelete(plan),
      },
    ];
  }

  boolOptions = () => [
    { value: '', label: this.transloco.translate('plans.entNull') },
    { value: 'true', label: this.transloco.translate('common.yes') },
    { value: 'false', label: this.transloco.translate('common.no') },
  ];

  getBoolValue(key: string): string {
    const val = (this.form.entitlements as unknown as Record<string, any>)[key];
    return val == null ? '' : val ? 'true' : 'false';
  }

  getNumValue(key: string): number | null {
    return (this.form.entitlements as unknown as Record<string, any>)[key] as number | null;
  }

  onTabChange(value: string | number): void {
    this.selectedTab.set(String(value));
  }

  openCreate(): void {
    this.editingPlan.set(null);
    this.form = emptyForm();
    this.selectedTab.set('details');
    this.dialogRef = this.appDialog.openRef(this.planDialog());
  }

  openEdit(plan: PlanAdminResponse): void {
    this.editingPlan.set(plan);
    this.form = planToForm(plan);
    this.selectedTab.set('details');
    this.dialogRef = this.appDialog.openRef(this.planDialog());
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  updateBoolEntitlement(key: string, value: string): void {
    const newVal = value === '' ? null : value === 'true';
    (this.form.entitlements as unknown as Record<string, any>)[key] = newVal;
  }

  updateNumEntitlement(key: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    (this.form.entitlements as unknown as Record<string, any>)[key] = strToInt(target.value);
  }

  save(): void {
    if (!this.form.name.trim()) return;

    this.isSaving.set(true);
    const dto = formToDto(this.form);
    const editing = this.editingPlan();

    const call = editing
      ? this.plansService.patchApiAdminPlansId(editing.id!, dto)
      : this.plansService.postApiAdminPlans(dto);

    call.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.dialogRef.close();
        this.toast.show(
          this.transloco.translate(editing ? 'plans.updated' : 'plans.created'),
          'success'
        );
        this.plansResource.reload();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.toast.show(extractMessage(err), 'danger');
      },
    });
  }

  startDelete(plan: PlanAdminResponse): void {
    this.confirm
      .confirm({
        message: this.transloco.translate('plans.deleteConfirm', { name: plan.name }),
        confirmColor: 'danger',
      })
      .subscribe((ok: boolean) => {
        if (ok) this.deletePlan(plan);
      });
  }

  private deletePlan(plan: PlanAdminResponse): void {
    this.plansService.deleteApiAdminPlansId(plan.id!).subscribe({
      next: () => {
        this.toast.show(this.transloco.translate('plans.deleted'), 'success');
        this.plansResource.reload();
      },
      error: (err: unknown) => {
        const raw = err as { status?: number; error?: { isConflict?: boolean } } | null;
        const isConflict = raw?.status === 409 || raw?.error?.isConflict === true;
        const msg = isConflict
          ? this.transloco.translate('plans.deleteConflict')
          : extractMessage(err);
        this.toast.show(msg, 'danger');
      },
    });
  }
}
