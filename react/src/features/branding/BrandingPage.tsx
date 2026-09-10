// Branding admin page — super-admin only.
// Text/URL/color form + per-kind icon upload widgets (6 kinds) + reset-to-default.
// §3 grammar: form section with Save primary at section footer end, asset uploaders as 2-column grid.
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getApiAdminBranding,
  putApiAdminBranding,
  postApiAdminBrandingAssetKind,
  deleteApiAdminBrandingAssetKind,
} from '@moamen-ui/pointer-react';
import { Upload, RotateCcw, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useBranding, type BrandingData } from '@/lib/branding';
import { extractMessage } from '@/lib/error';

// ---- Types ------------------------------------------------------------------

/** Shape of the branding payload as the API returns it (inside `Result<T>`). */
interface BrandingPayload {
  productName?: string | null;
  tagline?: string | null;
  primaryColor?: string | null;
  urls?: { app?: string | null; demo?: string | null; docs?: string | null; landing?: string | null } | null;
  assets?: {
    logo?: string | null; iconSquare?: string | null; favicon?: string | null;
    appleTouch?: string | null; pwa192?: string | null; pwa512?: string | null;
  } | null;
  version?: number | null;
}

type AssetKind = 'logo' | 'iconSquare' | 'favicon' | 'appleTouch' | 'pwa192' | 'pwa512';

interface AssetMeta {
  kind: AssetKind;
  labelKey: string;
  hintKey: string;
}

const ASSET_KINDS: AssetMeta[] = [
  { kind: 'logo',        labelKey: 'branding.assetKind.logo',        hintKey: 'branding.assetHint.logo' },
  { kind: 'iconSquare',  labelKey: 'branding.assetKind.iconSquare',   hintKey: 'branding.assetHint.iconSquare' },
  { kind: 'favicon',     labelKey: 'branding.assetKind.favicon',      hintKey: 'branding.assetHint.favicon' },
  { kind: 'appleTouch',  labelKey: 'branding.assetKind.appleTouch',   hintKey: 'branding.assetHint.appleTouch' },
  { kind: 'pwa192',      labelKey: 'branding.assetKind.pwa192',       hintKey: 'branding.assetHint.pwa192' },
  { kind: 'pwa512',      labelKey: 'branding.assetKind.pwa512',       hintKey: 'branding.assetHint.pwa512' },
];

// ---- API helpers (generated @moamen-ui/pointer-react client) ----------------

/** The client's mutator returns the inner payload and throws on failure, but the generated
 *  types still declare the `Result<T>` envelope — accept either shape, as the list pages do. */
function unwrapBranding(res: unknown): BrandingPayload {
  const maybe = res as { data?: BrandingPayload } | BrandingPayload | null;
  return ((maybe as { data?: BrandingPayload })?.data ?? maybe ?? {}) as BrandingPayload;
}

async function fetchAdminBranding(): Promise<BrandingData> {
  const d = unwrapBranding(await getApiAdminBranding());
  return {
    productName: d?.productName ?? 'Pointer',
    tagline: d?.tagline ?? null,
    primaryColor: d?.primaryColor ?? null,
    urls: {
      app: d?.urls?.app ?? null,
      demo: d?.urls?.demo ?? null,
      docs: d?.urls?.docs ?? null,
      landing: d?.urls?.landing ?? null,
    },
    assets: {
      logo: d?.assets?.logo ?? null,
      iconSquare: d?.assets?.iconSquare ?? null,
      favicon: d?.assets?.favicon ?? null,
      appleTouch: d?.assets?.appleTouch ?? null,
      pwa192: d?.assets?.pwa192 ?? null,
      pwa512: d?.assets?.pwa512 ?? null,
    },
    version: d?.version ?? 0,
  };
}

async function putAdminBranding(body: {
  productName: string;
  tagline: string;
  primaryColor: string;
  urls: { app: string; demo: string; docs: string; landing: string };
}): Promise<void> {
  await putApiAdminBranding(body);
}

async function postAdminBrandingAsset(kind: AssetKind, file: File): Promise<void> {
  await postApiAdminBrandingAssetKind(kind, { file });
}

async function deleteAdminBrandingAsset(kind: AssetKind): Promise<void> {
  await deleteApiAdminBrandingAssetKind(kind);
}

// ---- Form state -------------------------------------------------------------

interface FormState {
  productName: string;
  tagline: string;
  primaryColor: string;
  urlApp: string;
  urlDemo: string;
  urlDocs: string;
  urlLanding: string;
}

function dataToForm(d: BrandingData): FormState {
  return {
    productName: d.productName ?? '',
    tagline: d.tagline ?? '',
    primaryColor: d.primaryColor ?? '#2563eb',
    urlApp: d.urls?.app ?? '',
    urlDemo: d.urls?.demo ?? '',
    urlDocs: d.urls?.docs ?? '',
    urlLanding: d.urls?.landing ?? '',
  };
}

// ---- AssetWidget subcomponent -----------------------------------------------

interface AssetWidgetProps {
  meta: AssetMeta;
  currentUrl: string | null;
  productName: string;
  onUpload: (kind: AssetKind, file: File) => Promise<void>;
  onReset: (kind: AssetKind) => Promise<void>;
  uploading: boolean;
  resetting: boolean;
}

function AssetWidget({ meta, currentUrl, productName, onUpload, onReset, uploading, resetting }: AssetWidgetProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void onUpload(meta.kind, file);
    // Reset the input so same file can be re-selected after reset
    e.target.value = '';
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      {/* Preview — 40px box on bg-gutter */}
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-gutter">
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={t(meta.labelKey)}
            className="max-h-full max-w-full object-contain"
          />
        ) : meta.kind === 'logo' ? (
          <div className="flex items-center gap-0.5 text-[10px] font-bold text-foreground">
            <Pin className="h-3 w-3 rotate-45" />
            <span className="truncate">{productName}</span>
          </div>
        ) : (
          <Pin className="h-4 w-4 rotate-45 text-muted-foreground" />
        )}
      </div>

      {/* Kind label 14px/500 + expected size 13px muted */}
      <div className="flex flex-col gap-0.5">
        <p className="text-[14px] font-medium text-foreground">{t(meta.labelKey)}</p>
        <p className="text-[13px] text-muted-foreground">{t(meta.hintKey)}</p>
      </div>

      {/* Buttons: Upload secondary size=sm, Reset ghost size=sm */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={uploading || resetting}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {t('branding.upload')}
        </Button>
        {currentUrl && (
          <Button
            variant="ghost"
            size="sm"
            disabled={uploading || resetting}
            onClick={() => void onReset(meta.kind)}
          >
            <RotateCcw className="h-4 w-4" />
            {t('branding.resetToDefault')}
          </Button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/png,image/svg+xml,image/webp,image/jpeg"
        onChange={handleFileChange}
      />
    </div>
  );
}

// ---- Page component ---------------------------------------------------------

export function BrandingPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { branding, refresh } = useBranding();

  // Local admin branding state (separate from public branding store)
  const [adminData, setAdminData] = useState<BrandingData | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState<FormState>({
    productName: 'Pointer',
    tagline: '',
    primaryColor: '#2563eb',
    urlApp: '',
    urlDemo: '',
    urlDocs: '',
    urlLanding: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<AssetKind | null>(null);
  const [resettingKind, setResettingKind] = useState<AssetKind | null>(null);

  // Load admin branding on mount
  useEffect(() => {
    fetchAdminBranding()
      .then((d) => {
        setAdminData(d);
        setForm(dataToForm(d));
        setLoadingAdmin(false);
      })
      .catch(() => {
        setLoadError(true);
        setLoadingAdmin(false);
      });
  }, []);

  async function reloadAdmin() {
    try {
      const d = await fetchAdminBranding();
      setAdminData(d);
      setForm(dataToForm(d));
      // Also refresh the public branding store so Shell updates
      await refresh();
    } catch {
      // best-effort
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await putAdminBranding({
        productName: form.productName.trim(),
        tagline: form.tagline.trim(),
        primaryColor: form.primaryColor.trim(),
        urls: {
          app: form.urlApp.trim(),
          demo: form.urlDemo.trim(),
          docs: form.urlDocs.trim(),
          landing: form.urlLanding.trim(),
        },
      });
      toast(t('branding.saved'));
      await reloadAdmin();
    } catch (e) {
      toast(extractMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(kind: AssetKind, file: File) {
    setUploadingKind(kind);
    try {
      await postAdminBrandingAsset(kind, file);
      toast(t('branding.uploadSuccess'));
      await reloadAdmin();
    } catch (e) {
      toast(extractMessage(e), 'error');
    } finally {
      setUploadingKind(null);
    }
  }

  async function handleReset(kind: AssetKind) {
    setResettingKind(kind);
    try {
      await deleteAdminBrandingAsset(kind);
      toast(t('branding.resetSuccess'));
      await reloadAdmin();
    } catch (e) {
      toast(extractMessage(e), 'error');
    } finally {
      setResettingKind(null);
    }
  }

  if (loadingAdmin) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {t('branding.loading')}
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-destructive">
        {t('branding.loadError')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
        {t('branding.title')}
      </h1>

      {/* ── Form section: product name, tagline, primary color, four URLs ── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[16px] font-semibold leading-6">{t('branding.textSection')}</h2>
        <div className="rounded-md border border-border">
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="b-product-name" className="text-[13px] font-medium text-foreground">
                  {t('branding.productName')}
                </Label>
                <Input
                  id="b-product-name"
                  value={form.productName}
                  onChange={(e) => setForm({ ...form, productName: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="b-tagline" className="text-[13px] font-medium text-foreground">
                  {t('branding.tagline')}
                </Label>
                <Input
                  id="b-tagline"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                />
              </div>
            </div>

            {/* Primary color: 24px swatch button next to mono hex input */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[13px] font-medium text-foreground">
                {t('branding.primaryColor')}
              </Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => document.getElementById('b-color-picker')?.click?.()}
                  className="h-6 w-6 rounded-md border border-border"
                  style={{ backgroundColor: form.primaryColor }}
                  aria-label={t('branding.primaryColor')}
                />
                <Input
                  id="b-color"
                  type="text"
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="font-mono text-[13px]"
                  placeholder="#0969da"
                />
              </div>
              <input
                id="b-color-picker"
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="hidden"
              />
            </div>

            {/* Four URLs in a grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  { id: 'b-url-app',     key: 'urlApp',     labelKey: 'branding.urlApp' },
                  { id: 'b-url-demo',    key: 'urlDemo',    labelKey: 'branding.urlDemo' },
                  { id: 'b-url-docs',    key: 'urlDocs',    labelKey: 'branding.urlDocs' },
                  { id: 'b-url-landing', key: 'urlLanding', labelKey: 'branding.urlLanding' },
                ] as { id: string; key: keyof FormState; labelKey: string }[]
              ).map(({ id, key, labelKey }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label htmlFor={id} className="text-[13px] font-medium text-foreground">
                    {t(labelKey)}
                  </Label>
                  <Input
                    id={id}
                    type="url"
                    value={form[key] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save primary button at section footer end */}
          <div className="border-t border-border px-5 py-3 flex justify-end">
            <Button disabled={saving || !form.productName.trim()} onClick={handleSave}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </section>

      {/* ── Asset uploaders as 2-column grid of bordered rows ── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[16px] font-semibold leading-6">{t('branding.assetsSection')}</h2>
        <p className="text-[12px] text-muted-foreground max-w-[72ch]">{t('branding.assetsHint')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ASSET_KINDS.map((meta) => (
            <AssetWidget
              key={meta.kind}
              meta={meta}
              currentUrl={adminData?.assets?.[meta.kind] ?? null}
              productName={branding?.productName ?? 'Pointer'}
              onUpload={handleUpload}
              onReset={handleReset}
              uploading={uploadingKind === meta.kind}
              resetting={resettingKind === meta.kind}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
