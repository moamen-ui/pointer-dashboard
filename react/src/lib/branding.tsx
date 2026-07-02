// Branding store — fetches GET /api/branding once on mount, exposes the
// payload to all consumers, and provides a refresh() callback so the admin
// page can trigger an update after save/upload without reloading.
//
// Falls back gracefully: if the fetch fails the provider still renders its
// children using null values (Shell stays "Pointer Admin", favicon unchanged).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AXIOS_INSTANCE } from '@moamen-ui/pointer-react';

// ---- Types ------------------------------------------------------------------

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

interface BrandingContextValue {
  branding: BrandingData | null;
  refresh: () => Promise<void>;
}

// ---- Defaults ---------------------------------------------------------------

const DEFAULTS: BrandingData = {
  productName: 'Pointer',
  tagline: null,
  primaryColor: null,
  urls: { app: null, demo: null, docs: null, landing: null },
  assets: {
    logo: null,
    iconSquare: null,
    favicon: null,
    appleTouch: null,
    pwa192: null,
    pwa512: null,
  },
  version: 0,
};

// ---- Context ----------------------------------------------------------------

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULTS,
  refresh: async () => {},
});

// ---- Side-effects -----------------------------------------------------------

function applyBranding(b: BrandingData) {
  // 1. Document title
  document.title = `${b.productName} Admin`;

  // 2. Favicon swap
  if (b.assets.favicon) {
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = b.assets.favicon;
  }

  // 3. Optional: set CSS primary-color var if the theme exposes --color-brand
  if (b.primaryColor) {
    document.documentElement.style.setProperty('--brand-color-override', b.primaryColor);
  }
}

// ---- Provider ---------------------------------------------------------------

async function fetchBranding(): Promise<BrandingData> {
  const res = await AXIOS_INSTANCE.get<{ isSuccess: boolean; data: BrandingData }>(
    '/api/branding',
  );
  const envelope = res.data;
  if (!envelope?.isSuccess) throw new Error('branding fetch failed');
  return envelope.data;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingData | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchBranding();
      setBranding(data);
      applyBranding(data);
    } catch {
      // Fetch failed — fall back to defaults silently
      setBranding(DEFAULTS);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<BrandingContextValue>(
    () => ({ branding, refresh: load }),
    [branding, load],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

// ---- Hook -------------------------------------------------------------------

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}
