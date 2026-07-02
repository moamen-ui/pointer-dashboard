// Branding admin page — super-admin only.
// Text/URL/color form + per-kind icon upload widgets (6 kinds) + reset-to-default.
// Uses AXIOS_INSTANCE directly for multipart upload and DELETE (the generated
// client package v1.0.16 does not expose branding hooks yet).
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AXIOS_INSTANCE } from '@moamen-ui/pointer-react';
import { Upload, RotateCcw, ImageIcon, Palette } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useBranding, type BrandingData } from '@/lib/branding';
import { extractMessage } from '@/lib/error';

// ---- Types ------------------------------------------------------------------

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

// ---- API helpers (raw AXIOS_INSTANCE — branding not in v1.0.16 client) -----

async function fetchAdminBranding(): Promise<BrandingData> {
  const res = await AXIOS_INSTANCE.get<{ isSuccess: boolean; data: BrandingData; message?: string }>(
    '/api/admin/branding',
  );
  if (!res.data?.isSuccess) throw new Error(res.data?.message || 'Failed');
  return res.data.data;
}

async function putAdminBranding(body: {
  productName: string;
  tagline: string;
  primaryColor: string;
  urls: { app: string; demo: string; docs: string; landing: string };
}): Promise<void> {
  const res = await AXIOS_INSTANCE.put<{ isSuccess: boolean }>('/api/admin/branding', body);
  if (!res.data?.isSuccess) throw new Error((res.data as Record<string, unknown>)?.['message'] as string || 'Save failed');
}

async function postAdminBrandingAsset(kind: AssetKind, file: File): Promise<void> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await AXIOS_INSTANCE.post<{ isSuccess: boolean }>(
    `/api/admin/branding/asset/${kind}`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  if (!res.data?.isSuccess) throw new Error((res.data as Record<string, unknown>)?.['message'] as string || 'Upload failed');
}

async function deleteAdminBrandingAsset(kind: AssetKind): Promise<void> {
  const res = await AXIOS_INSTANCE.delete<{ isSuccess: boolean }>(
    `/api/admin/branding/asset/${kind}`,
  );
  if (!res.data?.isSuccess) throw new Error((res.data as Record<string, unknown>)?.['message'] as string || 'Reset failed');
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
  onUpload: (kind: AssetKind, file: File) => Promise<void>;
  onReset: (kind: AssetKind) => Promise<void>;
  uploading: boolean;
  resetting: boolean;
}

function AssetWidget({ meta, currentUrl, onUpload, onReset, uploading, resetting }: AssetWidgetProps) {
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
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{t(meta.labelKey)}</p>
          <p className="text-xs text-muted-foreground">{t(meta.hintKey)}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={uploading || resetting}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {t('branding.upload')}
          </Button>
          {currentUrl && (
            <Button
              variant="outline"
              size="sm"
              disabled={uploading || resetting}
              onClick={() => void onReset(meta.kind)}
            >
              <RotateCcw className="h-4 w-4" />
              {t('branding.resetToDefault')}
            </Button>
          )}
        </div>
      </div>

      {/* Preview */}
      {currentUrl ? (
        <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30 p-2">
          <img
            src={currentUrl}
            alt={t(meta.labelKey)}
            className="max-h-12 max-w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex h-16 items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          {t('branding.usingDefault')}
        </div>
      )}

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
  const { refresh } = useBranding();

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
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">{t('branding.title')}</h2>

      {/* ── Text / Color / URL form ── */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('branding.textSection')}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="b-product-name">{t('branding.productName')}</Label>
            <Input
              id="b-product-name"
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="b-tagline">{t('branding.tagline')}</Label>
            <Input
              id="b-tagline"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="b-color" className="flex items-center gap-1">
              <Palette className="h-3.5 w-3.5" />
              {t('branding.primaryColor')}
            </Label>
            <div className="flex items-center gap-2">
              <input
                id="b-color"
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
              />
              <Input
                className="flex-1"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              />
            </div>
          </div>
        </div>

        <p className="mb-3 mt-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('branding.urlsSection')}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(
            [
              { id: 'b-url-app',     key: 'urlApp',     labelKey: 'branding.urlApp' },
              { id: 'b-url-demo',    key: 'urlDemo',    labelKey: 'branding.urlDemo' },
              { id: 'b-url-docs',    key: 'urlDocs',    labelKey: 'branding.urlDocs' },
              { id: 'b-url-landing', key: 'urlLanding', labelKey: 'branding.urlLanding' },
            ] as { id: string; key: keyof FormState; labelKey: string }[]
          ).map(({ id, key, labelKey }) => (
            <div key={key} className="flex flex-col gap-2">
              <Label htmlFor={id}>{t(labelKey)}</Label>
              <Input
                id={id}
                type="url"
                value={form[key] as string}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <Button disabled={saving || !form.productName.trim()} onClick={handleSave}>
            {t('common.save')}
          </Button>
        </div>
      </Card>

      {/* ── Asset uploaders ── */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('branding.assetsSection')}
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">{t('branding.assetsHint')}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ASSET_KINDS.map((meta) => (
            <AssetWidget
              key={meta.kind}
              meta={meta}
              currentUrl={adminData?.assets?.[meta.kind] ?? null}
              onUpload={handleUpload}
              onReset={handleReset}
              uploading={uploadingKind === meta.kind}
              resetting={resettingKind === meta.kind}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
