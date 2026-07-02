import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { BrandingService, BrandingResponse } from '../../core/branding/branding.service';
import { extractMessage } from '../../core/api/extract-message';

type AssetKind = 'logo' | 'iconSquare' | 'favicon' | 'appleTouch' | 'pwa192' | 'pwa512';

interface AssetMeta {
  kind: AssetKind;
  labelKey: string;
  hintKey: string;
  accept: string;
}

const ASSET_KINDS: AssetMeta[] = [
  { kind: 'logo',        labelKey: 'branding.assetLogo',        hintKey: 'branding.assetLogoHint',        accept: 'image/png,image/svg+xml,image/webp,image/jpeg' },
  { kind: 'iconSquare',  labelKey: 'branding.assetIconSquare',  hintKey: 'branding.assetIconSquareHint',  accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'favicon',     labelKey: 'branding.assetFavicon',     hintKey: 'branding.assetFaviconHint',     accept: 'image/png,image/webp' },
  { kind: 'appleTouch',  labelKey: 'branding.assetAppleTouch',  hintKey: 'branding.assetAppleTouchHint',  accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'pwa192',      labelKey: 'branding.assetPwa192',      hintKey: 'branding.assetPwa192Hint',      accept: 'image/png,image/webp' },
  { kind: 'pwa512',      labelKey: 'branding.assetPwa512',      hintKey: 'branding.assetPwa512Hint',      accept: 'image/png,image/webp' },
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
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslocoModule,
  ],
  template: `
    <div class="p-6 max-w-3xl">
      <h2 class="m-0 mb-6 text-[1.5em] font-bold">{{ 'branding.title' | transloco }}</h2>

      @if (loading()) {
        <p class="text-muted">{{ 'branding.loading' | transloco }}</p>
      } @else if (loadError()) {
        <p class="text-red-500">{{ 'branding.loadError' | transloco }}</p>
      } @else {

        <!-- Text / URL form -->
        <section class="mb-8">
          <h3 class="m-0 mb-4 text-[1.1em] font-semibold">{{ 'branding.sectionText' | transloco }}</h3>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <mat-form-field appearance="outline" class="col-span-1 sm:col-span-2">
              <mat-label>{{ 'branding.productName' | transloco }}</mat-label>
              <input matInput [(ngModel)]="form.productName" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="col-span-1 sm:col-span-2">
              <mat-label>{{ 'branding.tagline' | transloco }}</mat-label>
              <input matInput [(ngModel)]="form.tagline" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'branding.primaryColor' | transloco }}</mat-label>
              <input matInput type="color" [(ngModel)]="form.primaryColor" style="height:36px;padding:2px 4px;cursor:pointer" />
            </mat-form-field>
          </div>

          <h3 class="m-0 mb-4 mt-4 text-[1.1em] font-semibold">{{ 'branding.sectionUrls' | transloco }}</h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'branding.urlApp' | transloco }}</mat-label>
              <input matInput type="url" [(ngModel)]="form.urlApp" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'branding.urlDemo' | transloco }}</mat-label>
              <input matInput type="url" [(ngModel)]="form.urlDemo" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'branding.urlDocs' | transloco }}</mat-label>
              <input matInput type="url" [(ngModel)]="form.urlDocs" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'branding.urlLanding' | transloco }}</mat-label>
              <input matInput type="url" [(ngModel)]="form.urlLanding" />
            </mat-form-field>
          </div>

          <div class="mt-4 flex justify-end">
            <button mat-flat-button color="primary" [disabled]="saving()" (click)="saveText()">
              <mat-icon>save</mat-icon> {{ 'branding.save' | transloco }}
            </button>
          </div>
        </section>

        <!-- Asset uploaders -->
        <section>
          <h3 class="m-0 mb-4 text-[1.1em] font-semibold">{{ 'branding.sectionAssets' | transloco }}</h3>
          <div class="flex flex-col gap-6">
            @for (asset of assetKinds; track asset.kind) {
              <div class="rounded-lg border border-app-border p-4">
                <div class="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p class="m-0 font-medium">{{ asset.labelKey | transloco }}</p>
                    <p class="m-0 text-xs text-muted">{{ asset.hintKey | transloco }}</p>
                  </div>
                  @if (assetUrl(asset.kind)) {
                    <img [src]="assetUrl(asset.kind)!" [alt]="asset.kind"
                      class="max-h-[48px] max-w-[96px] rounded border border-app-border object-contain bg-gray-100 dark:bg-gray-800" />
                  } @else {
                    <span class="text-xs text-muted italic">{{ 'branding.usingDefault' | transloco }}</span>
                  }
                </div>
                <div class="flex items-center gap-2">
                  <input #fileInput type="file" [accept]="asset.accept" class="hidden"
                    (change)="onFileChange(asset.kind, fileInput)" />
                  <button mat-stroked-button [disabled]="uploadingKind() === asset.kind"
                    (click)="fileInput.click()">
                    <mat-icon>upload</mat-icon> {{ 'branding.upload' | transloco }}
                  </button>
                  @if (assetUrl(asset.kind)) {
                    <button mat-stroked-button color="warn" [disabled]="deletingKind() === asset.kind"
                      (click)="deleteAsset(asset.kind)">
                      <mat-icon>restore</mat-icon> {{ 'branding.resetToDefault' | transloco }}
                    </button>
                  }
                  @if (uploadingKind() === asset.kind || deletingKind() === asset.kind) {
                    <mat-spinner diameter="20" />
                  }
                </div>
              </div>
            }
          </div>
        </section>

      }
    </div>
  `,
})
export class BrandingComponent implements OnInit {
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private brandingService = inject(BrandingService);

  readonly assetKinds = ASSET_KINDS;

  loading = signal(true);
  loadError = signal(false);
  saving = signal(false);
  uploadingKind = signal<AssetKind | null>(null);
  deletingKind = signal<AssetKind | null>(null);

  private _serverData = signal<BrandingResponse | null>(null);

  form: BrandingForm = {
    productName: '', tagline: '', primaryColor: '#2563eb',
    urlApp: '', urlDemo: '', urlDocs: '', urlLanding: '',
  };

  ngOnInit(): void {
    this.loadBranding();
  }

  assetUrl(kind: AssetKind): string | null {
    return this._serverData()?.assets[kind] ?? null;
  }

  private loadBranding(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.http.get<BrandingResponse>('/api/admin/branding').subscribe({
      next: (res) => {
        this._serverData.set(res);
        this.form = {
          productName: res.productName ?? '',
          tagline: res.tagline ?? '',
          primaryColor: res.primaryColor ?? '#2563eb',
          urlApp: res.urls?.app ?? '',
          urlDemo: res.urls?.demo ?? '',
          urlDocs: res.urls?.docs ?? '',
          urlLanding: res.urls?.landing ?? '',
        };
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
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
    this.http.put<unknown>('/api/admin/branding', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open(this.transloco.translate('branding.saved'), 'OK', { duration: 3000 });
        this.brandingService.refresh();
        this.loadBranding();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snack.open(extractMessage(err), 'OK', { duration: 4000 });
      },
    });
  }

  onFileChange(kind: AssetKind, input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 1_048_576) {
      this.snack.open(this.transloco.translate('branding.fileTooLarge'), 'OK', { duration: 4000 });
      input.value = '';
      return;
    }
    this.uploadingKind.set(kind);
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<unknown>(`/api/admin/branding/asset/${kind}`, fd).subscribe({
      next: () => {
        this.uploadingKind.set(null);
        input.value = '';
        this.snack.open(this.transloco.translate('branding.uploaded'), 'OK', { duration: 3000 });
        this.brandingService.refresh();
        this.loadBranding();
      },
      error: (err: unknown) => {
        this.uploadingKind.set(null);
        input.value = '';
        this.snack.open(extractMessage(err), 'OK', { duration: 4000 });
      },
    });
  }

  deleteAsset(kind: AssetKind): void {
    this.deletingKind.set(kind);
    this.http.delete<unknown>(`/api/admin/branding/asset/${kind}`).subscribe({
      next: () => {
        this.deletingKind.set(null);
        this.snack.open(this.transloco.translate('branding.resetDone'), 'OK', { duration: 3000 });
        this.brandingService.refresh();
        this.loadBranding();
      },
      error: (err: unknown) => {
        this.deletingKind.set(null);
        this.snack.open(extractMessage(err), 'OK', { duration: 4000 });
      },
    });
  }
}
