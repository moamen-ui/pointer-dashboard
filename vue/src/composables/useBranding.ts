// Branding store — fetches GET /api/branding once on load, then applies
// the runtime effects (document.title, favicon, productName/logo in Shell).
//
// Super-admin pages import `refreshBranding()` after any save/upload so the
// header/title/favicon update immediately without a page reload.
//
// Falls back to bundled defaults if the fetch fails — the header never blanks.
import { ref, readonly } from 'vue';
import { AXIOS_INSTANCE } from '@moamen-ui/pointer-vue';

export interface BrandingAssets {
  logo: string | null;
  iconSquare: string | null;
  favicon: string | null;
  appleTouch: string | null;
  pwa192: string | null;
  pwa512: string | null;
}

export interface BrandingUrls {
  app: string | null;
  demo: string | null;
  docs: string | null;
  landing: string | null;
}

export interface BrandingData {
  productName: string;
  tagline: string | null;
  primaryColor: string | null;
  urls: BrandingUrls;
  assets: BrandingAssets;
  version: number;
}

const DEFAULT_BRANDING: BrandingData = {
  productName: 'Pointer',
  tagline: null,
  primaryColor: null,
  urls: { app: null, demo: null, docs: null, landing: null },
  assets: { logo: null, iconSquare: null, favicon: null, appleTouch: null, pwa192: null, pwa512: null },
  version: 0,
};

const branding = ref<BrandingData>({ ...DEFAULT_BRANDING });
let fetchPromise: Promise<void> | null = null;

function applyBrandingEffects(data: BrandingData): void {
  // 1. document.title
  document.title = `${data.productName} Admin`;

  // 2. Favicon — swap <link rel="icon"> when a custom one is uploaded
  if (data.assets.favicon) {
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = data.assets.favicon;
  }
}

async function fetchBranding(): Promise<void> {
  try {
    const response = await AXIOS_INSTANCE.get<{
      isSuccess: boolean;
      data: BrandingData;
    }>('/api/branding');
    const raw = response.data;
    // Handle both wrapped (isSuccess envelope) and unwrapped responses
    const data: BrandingData = (raw as unknown as { isSuccess?: boolean }).isSuccess !== undefined
      ? (raw as unknown as { data: BrandingData }).data
      : (raw as unknown as BrandingData);
    if (data?.productName) {
      branding.value = data;
      applyBrandingEffects(data);
    }
  } catch {
    // Silently fall back to defaults — never blank the header.
  }
}

/** Fetches branding once (idempotent). Called from main.ts on app boot. */
export function initBranding(): Promise<void> {
  if (!fetchPromise) {
    fetchPromise = fetchBranding();
  }
  return fetchPromise;
}

/** Re-fetches branding and re-applies effects. Call after admin saves/uploads. */
export async function refreshBranding(): Promise<void> {
  fetchPromise = null;
  await fetchBranding();
}

export function useBranding() {
  return {
    branding: readonly(branding),
    refreshBranding,
  };
}
