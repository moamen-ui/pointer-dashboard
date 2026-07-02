<script setup lang="ts">
// Branding admin page — super-admin only.
// Uses AXIOS_INSTANCE directly for all calls because @moamen-ui/pointer-vue@1.0.16
// does not yet include branding hooks (they land in 1.0.17). Once the package is
// updated, replace these raw calls with the generated hooks.
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { AXIOS_INSTANCE } from '@moamen-ui/pointer-vue';
import { Upload, RotateCcw, ImageOff } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractMessage } from '@/lib/error';
import { toast } from '@/composables/useToast';
import { refreshBranding, type BrandingData } from '@/composables/useBranding';

const { t } = useI18n();

// ─── Types ───────────────────────────────────────────────────────────────────

type AssetKind = 'logo' | 'iconSquare' | 'favicon' | 'appleTouch' | 'pwa192' | 'pwa512';

interface AssetMeta {
  kind: AssetKind;
  labelKey: string;
  hintKey: string;
  accept: string;
}

const ASSET_META: AssetMeta[] = [
  { kind: 'logo',        labelKey: 'branding.assetLogo',        hintKey: 'branding.assetLogoHint',        accept: 'image/png,image/svg+xml,image/webp,image/jpeg' },
  { kind: 'iconSquare',  labelKey: 'branding.assetIconSquare',  hintKey: 'branding.assetIconSquareHint',  accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'favicon',     labelKey: 'branding.assetFavicon',     hintKey: 'branding.assetFaviconHint',     accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'appleTouch',  labelKey: 'branding.assetAppleTouch',  hintKey: 'branding.assetAppleTouchHint',  accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'pwa192',      labelKey: 'branding.assetPwa192',      hintKey: 'branding.assetPwa192Hint',      accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'pwa512',      labelKey: 'branding.assetPwa512',      hintKey: 'branding.assetPwa512Hint',      accept: 'image/png,image/webp,image/jpeg' },
];

// ─── State ───────────────────────────────────────────────────────────────────

const loading = ref(false);
const saving = ref(false);
const loadError = ref('');

const form = ref({
  productName: '',
  tagline: '',
  primaryColor: '#2563eb',
  urlApp: '',
  urlDemo: '',
  urlDocs: '',
  urlLanding: '',
});

// Per-kind upload state
const uploadingKind = ref<AssetKind | null>(null);
const deletingKind = ref<AssetKind | null>(null);
const assetUrls = ref<Record<AssetKind, string | null>>({
  logo: null,
  iconSquare: null,
  favicon: null,
  appleTouch: null,
  pwa192: null,
  pwa512: null,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface ApiEnvelope<T> {
  isSuccess: boolean;
  data: T;
  message?: string;
}

function unwrap<T>(raw: ApiEnvelope<T> | T): T {
  const env = raw as ApiEnvelope<T>;
  if (typeof env.isSuccess === 'boolean') {
    if (!env.isSuccess) throw new Error(env.message || 'Request failed');
    return env.data;
  }
  return raw as T;
}

async function getAdminBranding(): Promise<BrandingData> {
  const r = await AXIOS_INSTANCE.get<ApiEnvelope<BrandingData> | BrandingData>('/api/admin/branding');
  return unwrap(r.data as ApiEnvelope<BrandingData>);
}

async function putAdminBranding(body: {
  productName: string;
  tagline: string | null;
  primaryColor: string | null;
  urls: { app: string | null; demo: string | null; docs: string | null; landing: string | null };
}): Promise<void> {
  const r = await AXIOS_INSTANCE.put<ApiEnvelope<unknown> | unknown>('/api/admin/branding', body);
  unwrap(r.data as ApiEnvelope<unknown>);
}

function populateForm(data: BrandingData) {
  form.value.productName = data.productName ?? '';
  form.value.tagline = data.tagline ?? '';
  form.value.primaryColor = data.primaryColor ?? '#2563eb';
  form.value.urlApp = data.urls?.app ?? '';
  form.value.urlDemo = data.urls?.demo ?? '';
  form.value.urlDocs = data.urls?.docs ?? '';
  form.value.urlLanding = data.urls?.landing ?? '';
  assetUrls.value = {
    logo:        data.assets?.logo ?? null,
    iconSquare:  data.assets?.iconSquare ?? null,
    favicon:     data.assets?.favicon ?? null,
    appleTouch:  data.assets?.appleTouch ?? null,
    pwa192:      data.assets?.pwa192 ?? null,
    pwa512:      data.assets?.pwa512 ?? null,
  };
}

async function loadData() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await getAdminBranding();
    populateForm(data);
  } catch (e) {
    loadError.value = extractMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

// ─── Save text/URL form ───────────────────────────────────────────────────────

async function saveForm() {
  if (!form.value.productName.trim()) return;
  saving.value = true;
  try {
    await putAdminBranding({
      productName: form.value.productName.trim(),
      tagline: form.value.tagline.trim() || null,
      primaryColor: form.value.primaryColor || null,
      urls: {
        app:     form.value.urlApp.trim() || null,
        demo:    form.value.urlDemo.trim() || null,
        docs:    form.value.urlDocs.trim() || null,
        landing: form.value.urlLanding.trim() || null,
      },
    });
    toast(t('branding.saved'));
    await loadData();
    await refreshBranding();
  } catch (e) {
    toast(extractMessage(e));
  } finally {
    saving.value = false;
  }
}

// ─── Asset upload ─────────────────────────────────────────────────────────────

async function uploadAsset(kind: AssetKind, file: File) {
  if (file.size > 1024 * 1024) {
    toast(t('branding.fileTooLarge'));
    return;
  }
  uploadingKind.value = kind;
  try {
    const fd = new FormData();
    fd.append('file', file);
    await AXIOS_INSTANCE.post(`/api/admin/branding/asset/${kind}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    toast(t('branding.assetUploaded'));
    await loadData();
    await refreshBranding();
  } catch (e) {
    toast(extractMessage(e));
  } finally {
    uploadingKind.value = null;
  }
}

function onFileChange(kind: AssetKind, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    void uploadAsset(kind, file);
  }
  // Reset input so the same file can be re-uploaded after a reset
  input.value = '';
}

// ─── Asset delete ─────────────────────────────────────────────────────────────

async function deleteAsset(kind: AssetKind) {
  deletingKind.value = kind;
  try {
    await AXIOS_INSTANCE.delete(`/api/admin/branding/asset/${kind}`);
    toast(t('branding.assetReset'));
    await loadData();
    await refreshBranding();
  } catch (e) {
    toast(extractMessage(e));
  } finally {
    deletingKind.value = null;
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <h2 class="text-lg font-semibold">
      {{ t('branding.title') }}
      <span v-if="loading" class="ms-2 text-xs font-normal text-muted-foreground">
        {{ t('common.loading') }}…
      </span>
    </h2>

    <p v-if="loadError" class="text-sm text-destructive">{{ loadError }}</p>

    <!-- Text / URL form -->
    <Card class="p-6">
      <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {{ t('branding.textSection') }}
      </h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <!-- Product name -->
        <div class="flex flex-col gap-2">
          <Label for="b-name">{{ t('branding.productName') }}</Label>
          <Input id="b-name" v-model="form.productName" :placeholder="t('branding.productNamePlaceholder')" />
        </div>
        <!-- Tagline -->
        <div class="flex flex-col gap-2">
          <Label for="b-tagline">{{ t('branding.tagline') }}</Label>
          <Input id="b-tagline" v-model="form.tagline" :placeholder="t('branding.taglinePlaceholder')" />
        </div>
        <!-- Primary color -->
        <div class="flex flex-col gap-2">
          <Label for="b-color">{{ t('branding.primaryColor') }}</Label>
          <div class="flex items-center gap-2">
            <input
              id="b-color"
              v-model="form.primaryColor"
              type="color"
              class="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
            />
            <Input v-model="form.primaryColor" class="w-32 font-mono text-sm" maxlength="7" />
          </div>
        </div>
      </div>

      <!-- URL fields -->
      <h3 class="mb-4 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {{ t('branding.urlSection') }}
      </h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-2">
          <Label for="b-url-app">{{ t('branding.urlApp') }}</Label>
          <Input id="b-url-app" v-model="form.urlApp" type="url" :placeholder="t('branding.urlPlaceholder')" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="b-url-demo">{{ t('branding.urlDemo') }}</Label>
          <Input id="b-url-demo" v-model="form.urlDemo" type="url" :placeholder="t('branding.urlPlaceholder')" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="b-url-docs">{{ t('branding.urlDocs') }}</Label>
          <Input id="b-url-docs" v-model="form.urlDocs" type="url" :placeholder="t('branding.urlPlaceholder')" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="b-url-landing">{{ t('branding.urlLanding') }}</Label>
          <Input id="b-url-landing" v-model="form.urlLanding" type="url" :placeholder="t('branding.urlPlaceholder')" />
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <Button :disabled="!form.productName.trim() || saving" @click="saveForm">
          {{ saving ? `${t('common.save')}…` : t('common.save') }}
        </Button>
      </div>
    </Card>

    <!-- Icon uploaders -->
    <Card class="p-6">
      <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {{ t('branding.assetsSection') }}
      </h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="meta in ASSET_META"
          :key="meta.kind"
          class="flex flex-col gap-3 rounded-lg border border-border p-4"
        >
          <!-- Label + dimension hint -->
          <div>
            <p class="text-sm font-medium">{{ t(meta.labelKey) }}</p>
            <p class="text-xs text-muted-foreground">{{ t(meta.hintKey) }}</p>
          </div>

          <!-- Preview -->
          <div class="flex h-20 items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
            <img
              v-if="assetUrls[meta.kind]"
              :src="assetUrls[meta.kind]!"
              :alt="t(meta.labelKey)"
              class="max-h-16 max-w-full object-contain"
            />
            <div v-else class="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageOff class="h-6 w-6" />
              <span class="text-xs">{{ t('branding.usingDefault') }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2">
            <!-- Upload button wraps a hidden file input -->
            <label
              :for="`upload-${meta.kind}`"
              class="flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              :class="{ 'pointer-events-none opacity-50': uploadingKind === meta.kind }"
            >
              <Upload class="h-3.5 w-3.5" />
              {{
                uploadingKind === meta.kind
                  ? `${t('branding.uploading')}…`
                  : t('branding.upload')
              }}
            </label>
            <input
              :id="`upload-${meta.kind}`"
              type="file"
              :accept="meta.accept"
              class="sr-only"
              @change="onFileChange(meta.kind, $event)"
            />

            <!-- Reset to default — only when an asset is uploaded -->
            <Button
              v-if="assetUrls[meta.kind]"
              variant="ghost"
              size="sm"
              class="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
              :disabled="deletingKind === meta.kind"
              @click="deleteAsset(meta.kind)"
            >
              <RotateCcw class="h-3.5 w-3.5" />
              {{ t('branding.resetToDefault') }}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>
