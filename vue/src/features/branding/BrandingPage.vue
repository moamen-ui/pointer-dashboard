<script setup lang="ts">
// Branding admin page — super-admin only.
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  getApiAdminBranding,
  putApiAdminBranding,
  postApiAdminBrandingAssetKind,
  deleteApiAdminBrandingAssetKind,
  type PostApiAdminBrandingAssetKindBody,
} from '@moamen-ui/pointer-vue';
import { Upload, RotateCcw, Pin } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FormField from '@/components/shared/FormField.vue';
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
  { kind: 'logo',        labelKey: 'branding.assetKind.logo',        hintKey: 'branding.assetHint.logo',        accept: 'image/png,image/svg+xml,image/webp,image/jpeg' },
  { kind: 'iconSquare',  labelKey: 'branding.assetKind.iconSquare',  hintKey: 'branding.assetHint.iconSquare',  accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'favicon',     labelKey: 'branding.assetKind.favicon',     hintKey: 'branding.assetHint.favicon',     accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'appleTouch',  labelKey: 'branding.assetKind.appleTouch',  hintKey: 'branding.assetHint.appleTouch',  accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'pwa192',      labelKey: 'branding.assetKind.pwa192',      hintKey: 'branding.assetHint.pwa192',      accept: 'image/png,image/webp,image/jpeg' },
  { kind: 'pwa512',      labelKey: 'branding.assetKind.pwa512',      hintKey: 'branding.assetHint.pwa512',      accept: 'image/png,image/webp,image/jpeg' },
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

const colorPicker = ref<HTMLInputElement | null>(null);

/** Opens the hidden per-kind file input; the Upload control is a real Button for parity. */
function pickFile(kind: AssetKind) {
  const input = document.getElementById(`upload-${kind}`) as HTMLInputElement | null;
  input?.click();
}

async function loadData() {
  loading.value = true;
  loadError.value = '';
  try {
    // The client's mutator returns the inner payload and throws on failure, but the generated
    // types still declare the `Result<T>` envelope — accept either shape, as the list pages do.
    const res = await getApiAdminBranding();
    const raw = ((res as unknown as { data?: unknown })?.data ?? res) as {
      productName?: string | null;
      tagline?: string | null;
      primaryColor?: string | null;
      urls?: Record<string, string | null | undefined> | null;
      assets?: Record<string, string | null | undefined> | null;
      version?: number | null;
    } | null;
    if (raw) {
      const data: BrandingData = {
        productName: raw.productName ?? 'Pointer',
        tagline: raw.tagline ?? null,
        primaryColor: raw.primaryColor ?? null,
        urls: {
          app: raw.urls?.app ?? null,
          demo: raw.urls?.demo ?? null,
          docs: raw.urls?.docs ?? null,
          landing: raw.urls?.landing ?? null,
        },
        assets: {
          logo: raw.assets?.logo ?? null,
          iconSquare: raw.assets?.iconSquare ?? null,
          favicon: raw.assets?.favicon ?? null,
          appleTouch: raw.assets?.appleTouch ?? null,
          pwa192: raw.assets?.pwa192 ?? null,
          pwa512: raw.assets?.pwa512 ?? null,
        },
        version: raw.version ?? 0,
      };
      populateForm(data);
    }
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
    await putApiAdminBranding({
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
    toast(t('branding.saved'), 'success');
    await loadData();
    await refreshBranding();
  } catch (e) {
    toast(extractMessage(e), 'danger');
  } finally {
    saving.value = false;
  }
}

// ─── Asset upload ─────────────────────────────────────────────────────────────

async function uploadAsset(kind: AssetKind, file: File) {
  if (file.size > 1024 * 1024) {
    toast(t('branding.fileTooLarge'), 'warning');
    return;
  }
  uploadingKind.value = kind;
  try {
    const body: PostApiAdminBrandingAssetKindBody = { file };
    await postApiAdminBrandingAssetKind(kind, body);
    toast(t('branding.assetUploaded'), 'success');
    await loadData();
    await refreshBranding();
  } catch (e) {
    toast(extractMessage(e), 'danger');
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
    await deleteApiAdminBrandingAssetKind(kind);
    toast(t('branding.assetReset'), 'success');
    await loadData();
    await refreshBranding();
  } catch (e) {
    toast(extractMessage(e), 'danger');
  } finally {
    deletingKind.value = null;
  }
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
      {{ t('branding.title') }}
      <span v-if="loading" class="ms-2 text-[12px] font-normal text-muted-foreground">
        {{ t('common.loading') }}…
      </span>
    </h1>

    <p v-if="loadError" class="text-[14px] text-state-danger">{{ loadError }}</p>

    <!-- Identity: name, tagline, primary color, four URLs — one card, Save in its footer -->
    <section v-else class="flex flex-col gap-3">
      <h2 class="text-[16px] font-semibold leading-6">{{ t('branding.textSection') }}</h2>
      <div class="rounded-md border border-border">
        <div class="space-y-4 p-5">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField :label="t('branding.productName')" html-for="b-name">
              <Input id="b-name" v-model="form.productName" :placeholder="t('branding.productNamePlaceholder')" />
            </FormField>
            <FormField :label="t('branding.tagline')" html-for="b-tagline">
              <Input id="b-tagline" v-model="form.tagline" :placeholder="t('branding.taglinePlaceholder')" />
            </FormField>
          </div>

          <!-- Primary color: 24px swatch opening the native picker, next to a mono hex input -->
          <FormField :label="t('branding.primaryColor')" html-for="b-color">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="h-6 w-6 shrink-0 rounded-md border border-border"
                :style="{ backgroundColor: form.primaryColor }"
                :aria-label="t('branding.primaryColor')"
                @click="colorPicker?.click()"
              ></button>
              <Input id="b-color" v-model="form.primaryColor" class="font-mono text-[13px]" maxlength="7" placeholder="#0969da" />
            </div>
            <input ref="colorPicker" v-model="form.primaryColor" type="color" class="hidden" />
          </FormField>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField :label="t('branding.urlApp')" html-for="b-url-app">
              <Input id="b-url-app" v-model="form.urlApp" type="url" :placeholder="t('branding.urlPlaceholder')" />
            </FormField>
            <FormField :label="t('branding.urlDemo')" html-for="b-url-demo">
              <Input id="b-url-demo" v-model="form.urlDemo" type="url" :placeholder="t('branding.urlPlaceholder')" />
            </FormField>
            <FormField :label="t('branding.urlDocs')" html-for="b-url-docs">
              <Input id="b-url-docs" v-model="form.urlDocs" type="url" :placeholder="t('branding.urlPlaceholder')" />
            </FormField>
            <FormField :label="t('branding.urlLanding')" html-for="b-url-landing">
              <Input id="b-url-landing" v-model="form.urlLanding" type="url" :placeholder="t('branding.urlPlaceholder')" />
            </FormField>
          </div>
        </div>

        <div class="flex justify-end border-t border-border px-5 py-3">
          <Button :disabled="!form.productName.trim() || saving" @click="saveForm">
            {{ saving ? `${t('common.save')}…` : t('common.save') }}
          </Button>
        </div>
      </div>
    </section>

    <!-- Logos & icons: 40px preview box, kind label, expected size, then the actions -->
    <section v-if="!loadError" class="flex flex-col gap-3">
      <h2 class="text-[16px] font-semibold leading-6">{{ t('branding.assetsSection') }}</h2>
      <p class="max-w-[72ch] text-[12px] text-muted-foreground">{{ t('branding.assetsHint') }}</p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          v-for="meta in ASSET_META"
          :key="meta.kind"
          class="flex flex-col gap-3 rounded-md border border-border p-3"
        >
          <div class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-gutter">
            <img
              v-if="assetUrls[meta.kind]"
              :src="assetUrls[meta.kind]!"
              :alt="t(meta.labelKey)"
              class="max-h-full max-w-full object-contain"
            />
            <div v-else-if="meta.kind === 'logo'" class="flex items-center gap-0.5 text-[10px] font-bold text-foreground">
              <Pin class="h-3 w-3 rotate-45" />
              <span class="truncate">{{ form.productName || 'Pointer' }}</span>
            </div>
            <Pin v-else class="h-4 w-4 rotate-45 text-muted-foreground" />
          </div>

          <div class="flex flex-col gap-0.5">
            <p class="text-[14px] font-medium text-foreground">{{ t(meta.labelKey) }}</p>
            <p class="text-[13px] text-muted-foreground">{{ t(meta.hintKey) }}</p>
          </div>

          <div class="flex gap-2">
            <input
              :id="`upload-${meta.kind}`"
              type="file"
              :accept="meta.accept"
              class="sr-only"
              @change="onFileChange(meta.kind, $event)"
            />
            <Button
              variant="secondary"
              size="sm"
              :disabled="uploadingKind === meta.kind || deletingKind === meta.kind"
              @click="pickFile(meta.kind)"
            >
              <Upload class="h-4 w-4" />
              {{ uploadingKind === meta.kind ? `${t('branding.uploading')}…` : t('branding.upload') }}
            </Button>
            <Button
              v-if="assetUrls[meta.kind]"
              variant="ghost"
              size="sm"
              :disabled="uploadingKind === meta.kind || deletingKind === meta.kind"
              @click="deleteAsset(meta.kind)"
            >
              <RotateCcw class="h-4 w-4" />
              {{ t('branding.resetToDefault') }}
            </Button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
