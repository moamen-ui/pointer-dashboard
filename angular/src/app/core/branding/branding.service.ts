import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

export interface BrandingResponse {
  productName: string;
  tagline: string;
  primaryColor: string;
  urls: { app: string; demo: string; docs: string; landing: string };
  assets: {
    logo: string | null;
    iconSquare: string | null;
    favicon: string | null;
    appleTouch: string | null;
    pwa192: string | null;
    pwa512: string | null;
  };
  version: number;
}

const DEFAULTS: BrandingResponse = {
  productName: 'Pointer',
  tagline: 'Point at the UI. Ship it with AI.',
  primaryColor: '#2563eb',
  urls: { app: '', demo: '', docs: '', landing: '' },
  assets: { logo: null, iconSquare: null, favicon: null, appleTouch: null, pwa192: null, pwa512: null },
  version: 0,
};

@Injectable({ providedIn: 'root' })
export class BrandingService {
  private http = inject(HttpClient);
  private _data = signal<BrandingResponse>(DEFAULTS);

  readonly productName = computed(() => this._data().productName || 'Pointer');
  readonly tagline = computed(() => this._data().tagline);
  readonly primaryColor = computed(() => this._data().primaryColor);
  readonly logo = computed(() => this._data().assets.logo);
  readonly favicon = computed(() => this._data().assets.favicon);
  readonly data = this._data.asReadonly();

  /** Call once on app init. Also called after save/upload to refresh live branding. */
  refresh(): void {
    this.http.get<BrandingResponse>('/api/branding')
      .pipe(catchError(() => of(DEFAULTS)))
      .subscribe((res) => {
        this._data.set(res);
        this.applyEffects(res);
      });
  }

  private applyEffects(res: BrandingResponse): void {
    if (typeof document === 'undefined') return;
    document.title = `${res.productName || 'Pointer'} Admin`;
    const fav = res.assets.favicon;
    if (fav) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = fav;
    }
  }
}
