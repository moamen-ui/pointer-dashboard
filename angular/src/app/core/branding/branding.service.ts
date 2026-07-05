import { computed, effect, Injectable } from '@angular/core';
import { getApiBrandingResource } from '@moamen-ui/pointer-angular';
import type { BrandingResponse as ApiBrandingResponse } from '@moamen-ui/pointer-angular';

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

function toLocal(api: ApiBrandingResponse | null | undefined): BrandingResponse {
  if (!api) return DEFAULTS;
  return {
    productName: api.productName ?? DEFAULTS.productName,
    tagline: api.tagline ?? DEFAULTS.tagline,
    primaryColor: api.primaryColor ?? DEFAULTS.primaryColor,
    urls: {
      app: api.urls?.app ?? '',
      demo: api.urls?.demo ?? '',
      docs: api.urls?.docs ?? '',
      landing: api.urls?.landing ?? '',
    },
    assets: {
      logo: api.assets?.logo ?? null,
      iconSquare: api.assets?.iconSquare ?? null,
      favicon: api.assets?.favicon ?? null,
      appleTouch: api.assets?.appleTouch ?? null,
      pwa192: api.assets?.pwa192 ?? null,
      pwa512: api.assets?.pwa512 ?? null,
    },
    version: api.version ?? 0,
  };
}

@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly resource = getApiBrandingResource();

  private readonly _data = computed<BrandingResponse>(() =>
    toLocal(this.resource.value()?.data)
  );

  readonly productName = computed(() => this._data().productName || 'Pointer');
  readonly tagline = computed(() => this._data().tagline);
  readonly primaryColor = computed(() => this._data().primaryColor);
  readonly logo = computed(() => this._data().assets.logo);
  readonly favicon = computed(() => this._data().assets.favicon);
  readonly data = this._data;

  constructor() {
    effect(() => {
      const res = this._data();
      this.applyEffects(res);
    });
  }

  /** Re-fetch live branding from the API (call after save/upload). */
  refresh(): void {
    this.resource.reload();
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
