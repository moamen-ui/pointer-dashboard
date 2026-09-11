import { Component, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  BrandingService as ApiBrandingService,
  getApiAdminBrandingResource,
} from '@moamen-ui/pointer-angular';
import type { PostApiAdminBrandingAssetKindBody, BrandingResponse } from '@moamen-ui/pointer-angular';
import { BrandingService } from '../../core/branding/branding.service';
import { extractMessage } from '../../core/api/extract-message';
import { AppButtonDirective } from '../../shared/ui/app-button.directive';
import { AppInputDirective } from '../../shared/ui/app-input.directive';
import { AppFormFieldComponent } from '../../shared/ui/app-form-field.component';
import { AppToastService } from '../../shared/ui/app-toast.service';
import { AppIconComponent } from '../../shared/ui/app-icon.component';

type AssetKind = 'logo' | 'iconSquare' | 'favicon' | 'appleTouch' | 'pwa192' | 'pwa512';

interface AssetMeta {
  kind: AssetKind;
  labelKey: string;
  hintKey: string;
  accept: string;
}

const ASSET_KINDS: AssetMeta[] = [
  { kind: 'logo',        labelKey: 'branding.assetKind.logo',        hintKey: 'branding.assetHint.logo',        accept: 'image/png,image/svg+xml,image/webp,image/jpeg' },
  { kind: 'iconSquare',  labelKey: 'branding.assetKind.iconSquare',  hintKey: 'branding.assetHint.iconSquare',  accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'favicon',     labelKey: 'branding.assetKind.favicon',     hintKey: 'branding.assetHint.favicon',     accept: 'image/png,image/webp' },
  { kind: 'appleTouch',  labelKey: 'branding.assetKind.appleTouch',  hintKey: 'branding.assetHint.appleTouch',  accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'pwa192',      labelKey: 'branding.assetKind.pwa192',      hintKey: 'branding.assetHint.pwa192',      accept: 'image/png,image/webp' },
  { kind: 'pwa512',      labelKey: 'branding.assetKind.pwa512',      hintKey: 'branding.assetHint.pwa512',      accept: 'image/png,image/webp' },
];

interface BrandingForm {
  productName: string;
  tagline: string;
  primaryColor: string;
  urlApp: string;
  urlDemo: string;
  urlDocs: string;
  urlLanding: string;
}

@Component({
  selector: 'app-branding',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoModule,
    AppButtonDirective,
    AppInputDirective,
    AppFormFieldComponent,
    AppIconComponent,
  ],
  template: `
    <div class="flex-1 min-w-0 overflow-auto bg-background">
      <div class="mx-auto w-full max-w-[1120px]">
        <!-- Title row -->
        <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em] mb-8">
          {{ 'branding.title' | transloco }}
        </h1>

        @if (loading()) {
          <div class="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {{ 'branding.loading' | transloco }}
          </div>
        } @else if (loadError()) {
          <div class="flex h-40 items-center justify-center text-sm text-state-danger">
            {{ 'branding.loadError' | transloco }}
          </div>
        } @else {
          <div class="flex flex-col gap-8">
            <!-- Form section: product name, tagline, primary color, four URLs -->
            <section class="flex flex-col gap-3">
              <h2 class="text-[16px] font-semibold leading-6">{{ 'branding.textSection' | transloco }}</h2>
              <div class="rounded-md border border-border">
                <div class="space-y-4 p-5">
                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <app-form-field label="{{ 'branding.productName' | transloco }}">
                      <input appInput [(ngModel)]="form.productName" />
                    </app-form-field>
                    <app-form-field label="{{ 'branding.tagline' | transloco }}">
                      <input appInput [(ngModel)]="form.tagline" />
                    </app-form-field>
                  </div>

                  <!-- Primary color: 24px swatch button next to mono hex input -->
                  <app-form-field label="{{ 'branding.primaryColor' | transloco }}">
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        (click)="colorPickerInput.click()"
                        class="h-6 w-6 rounded-md border border-border"
                        [style.backgroundColor]="form.primaryColor"
                        [attr.aria-label]="'branding.primaryColor' | transloco"
                      ></button>
                      <input
                        appInput
                        type="text"
                        [(ngModel)]="form.primaryColor"
                        class="font-mono text-[13px]"
                        placeholder="#0969da"
                      />
                    </div>
                    <input
                      #colorPickerInput
                      type="color"
                      [(ngModel)]="form.primaryColor"
                      class="hidden"
                    />
                  </app-form-field>

                  <!-- Four URLs in a grid -->
                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <app-form-field label="{{ 'branding.urlApp' | transloco }}">
                      <input appInput type="url" [(ngModel)]="form.urlApp" />
                    </app-form-field>
                    <app-form-field label="{{ 'branding.urlDemo' | transloco }}">
                      <input appInput type="url" [(ngModel)]="form.urlDemo" />
                    </app-form-field>
                    <app-form-field label="{{ 'branding.urlDocs' | transloco }}">
                      <input appInput type="url" [(ngModel)]="form.urlDocs" />
                    </app-form-field>
                    <app-form-field label="{{ 'branding.urlLanding' | transloco }}">
                      <input appInput type="url" [(ngModel)]="form.urlLanding" />
                    </app-form-field>
                  </div>
                </div>

                <!-- Save primary button at section footer end -->
                <div class="border-t border-border px-5 py-3 flex justify-end">
                  <button
                    appButton
                    variant="primary"
                    [disabled]="saving() || !form.productName.trim()"
                    (click)="saveText()"
                  >
                    {{ 'common.save' | transloco }}
                  </button>
                </div>
              </div>
            </section>

            <!-- Asset uploaders as 2-column grid of bordered rows -->
            <section class="flex flex-col gap-3">
              <h2 class="text-[16px] font-semibold leading-6">{{ 'branding.assetsSection' | transloco }}</h2>
              <p class="text-[12px] text-muted-foreground max-w-[72ch]">{{ 'branding.assetsHint' | transloco }}</p>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                @for (asset of assetKinds; track asset.kind) {
                  <div class="flex flex-col gap-3 rounded-md border border-border p-3">
                    <!-- Preview — 40px box on bg-gutter -->
                    <div class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-gutter">
                      @if (assetUrl(asset.kind)) {
                        <img
                          [src]="assetUrl(asset.kind)!"
                          [alt]="asset.kind"
                          class="max-h-full max-w-full object-contain"
                        />
                      } @else if (asset.kind === 'logo') {
                        <div class="flex items-center gap-0.5 text-[10px] font-bold text-foreground">
                          <app-icon name="pin" [size]="12" class="rotate-45" />
                          <span class="truncate">{{ branding.productName() }}</span>
                        </div>
                      } @else {
                        <app-icon name="pin" [size]="16" class="rotate-45 text-muted-foreground" />
                      }
                    </div>

                    <!-- Kind label 14px/500 + expected size 13px muted -->
                    <div class="flex flex-col gap-0.5">
                      <p class="text-[14px] font-medium text-foreground">{{ asset.labelKey | transloco }}</p>
                      <p class="text-[13px] text-muted-foreground">{{ asset.hintKey | transloco }}</p>
                    </div>

                    <!-- Buttons: Upload secondary size=sm, Reset ghost size=sm -->
                    <div class="flex gap-2">
                      <input
                        #fileInput
                        type="file"
                        [accept]="asset.accept"
                        class="hidden"
                        (change)="onFileChange(asset.kind, fileInput)"
                      />
                      <button
                        appButton
                        variant="secondary"
                        size="sm"
                        [disabled]="uploadingKind() === asset.kind || deletingKind() === asset.kind"
                        (click)="fileInput.click()"
                      >
                        <app-icon name="upload" [size]="16" />
                        {{ 'branding.upload' | transloco }}
                      </button>
                      @if (assetUrl(asset.kind)) {
                        <button
                          appButton
                          variant="ghost"
                          size="sm"
                          [disabled]="uploadingKind() === asset.kind || deletingKind() === asset.kind"
                          (click)="deleteAsset(asset.kind)"
                        >
                          <app-icon name="rotate-ccw" [size]="16" />
                          {{ 'branding.resetToDefault' | transloco }}
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            </section>
          </div>
        }
      </div>
    </div>
  `,
})
export class BrandingComponent {
  private apiBranding = inject(ApiBrandingService);
  private toast = inject(AppToastService);
  private transloco = inject(TranslocoService);
  // Public: the template previews the built-in mark (product name) for assets
  // that have no upload yet.
  readonly branding = inject(BrandingService);

  readonly assetKinds = ASSET_KINDS;

  private readonly brandingResource = getApiAdminBrandingResource();

  readonly loading = computed(() => this.brandingResource.isLoading());
  readonly loadError = computed(() => !!this.brandingResource.error());

  saving = signal(false);
  uploadingKind = signal<AssetKind | null>(null);
  deletingKind = signal<AssetKind | null>(null);

  form: BrandingForm = {
    productName: '', tagline: '', primaryColor: '#2563eb',
    urlApp: '', urlDemo: '', urlDocs: '', urlLanding: '',
  };

  /** The auth interceptor unwraps `Result<T>`, but the generated resource type still declares the
   *  envelope — accept either shape so the form fills in regardless. */
  private brandingPayload() {
    const value = this.brandingResource.value() as
      | (BrandingResponse & { data?: BrandingResponse })
      | undefined;
    return value?.data ?? value;
  }

  constructor() {
    // Sync form fields whenever the resource delivers fresh data
    effect(() => {
      const res = this.brandingPayload();
      if (!res) return;
      this.form = {
        productName: res.productName ?? '',
        tagline: res.tagline ?? '',
        primaryColor: res.primaryColor ?? '#2563eb',
        urlApp: res.urls?.app ?? '',
        urlDemo: res.urls?.demo ?? '',
        urlDocs: res.urls?.docs ?? '',
        urlLanding: res.urls?.landing ?? '',
      };
    });
  }

  assetUrl(kind: AssetKind): string | null {
    const assets = this.brandingPayload()?.assets as Record<string, string | null> | undefined;
    return assets?.[kind] ?? null;
  }

  saveText(): void {
    this.saving.set(true);
    const body = {
      productName: this.form.productName.trim(),
      tagline: this.form.tagline.trim(),
      primaryColor: this.form.primaryColor,
      urls: {
        app: this.form.urlApp.trim(),
        demo: this.form.urlDemo.trim(),
        docs: this.form.urlDocs.trim(),
        landing: this.form.urlLanding.trim(),
      },
    };
    this.apiBranding.putApiAdminBranding(body).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.show(this.transloco.translate('branding.saved'), 'success');
        this.branding.refresh();
        this.brandingResource.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.toast.show(extractMessage(err), 'danger');
      },
    });
  }

  onFileChange(kind: AssetKind, input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 1_048_576) {
      this.toast.show(this.transloco.translate('branding.fileTooLarge'), 'warning');
      input.value = '';
      return;
    }
    this.uploadingKind.set(kind);
    const body: PostApiAdminBrandingAssetKindBody = { file };
    this.apiBranding.postApiAdminBrandingAssetKind(kind, body).subscribe({
      next: () => {
        this.uploadingKind.set(null);
        input.value = '';
        this.toast.show(this.transloco.translate('branding.uploadSuccess'), 'success');
        this.branding.refresh();
        this.brandingResource.reload();
      },
      error: (err: unknown) => {
        this.uploadingKind.set(null);
        input.value = '';
        this.toast.show(extractMessage(err), 'danger');
      },
    });
  }

  deleteAsset(kind: AssetKind): void {
    this.deletingKind.set(kind);
    this.apiBranding.deleteApiAdminBrandingAssetKind(kind).subscribe({
      next: () => {
        this.deletingKind.set(null);
        this.toast.show(this.transloco.translate('branding.resetSuccess'), 'success');
        this.branding.refresh();
        this.brandingResource.reload();
      },
      error: (err: unknown) => {
        this.deletingKind.set(null);
        this.toast.show(extractMessage(err), 'danger');
      },
    });
  }
}
