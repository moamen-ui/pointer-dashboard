<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { X, Sparkles, Rocket } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  clearDemoSession,
  getDemoSession,
  isDemoDismissed,
  markDemoDismissed,
} from '@/lib/demoSession';
import { usePostApiDemoUpgrade } from '@moamen-ui/pointer-vue';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import FormField from '@/components/shared/FormField.vue';
import { useAuth } from '@/composables/useAuth';
import { toast } from '@/composables/useToast';
import { extractMessage } from '@/lib/error';
import { isValidEmail } from '@/lib/validation';
import { useInstallGuide } from '@/shared/install-guide/useInstallGuide';

const { t } = useI18n();

const session = ref(getDemoSession());
const dismissed = ref(isDemoDismissed());

const { guideOpen } = useInstallGuide();

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

const remainingMs = computed(() => {
  if (!session.value?.expiresAt) return 0;
  return new Date(session.value.expiresAt).getTime() - now.value;
});

const expired = computed(() => remainingMs.value <= 0);

const countdown = computed(() => {
  const ms = Math.max(0, remainingMs.value);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
});

/**
 * Hides the banner but keeps the session: it holds the demo project key and the
 * widget login, which the install guide still needs. Deleting it here used to
 * throw those credentials away with no way to get them back.
 */
function dismiss() {
  markDemoDismissed();
  dismissed.value = true;
}

const { loginWithToken } = useAuth();
const upgradeDialogOpen = ref(false);
const upgradeForm = reactive({ email: '', password: '', confirmPassword: '', displayName: '' });
const upgradeError = ref('');

// Angular-parity validation: email required + format, password required + min
// length 8, confirmPassword required, displayName optional. Errors appear only
// after a field was touched (blurred), like FormControl.invalid && .touched.
// Confirm deliberately gets NO per-field error copy (matches the Angular
// reference) — its feedback is the cross-field mismatch paragraph, which the
// Angular reference gates on confirmPassword *dirty* (typed), not touched.
const touched = reactive({ email: false, password: false });
const confirmDirty = ref(false);

const emailError = computed(() => {
  if (!touched.email) return '';
  if (!upgradeForm.email.trim()) return t('common.fieldRequired');
  if (!isValidEmail(upgradeForm.email)) return t('common.invalidEmail');
  return '';
});

const passwordError = computed(() => {
  if (!touched.password) return '';
  if (!upgradeForm.password) return t('common.fieldRequired');
  if (upgradeForm.password.length < 8) return t('common.passwordMinLength', { min: 8 });
  return '';
});

// Cross-field mismatch: belongs to the field pair, not one field, so it stays
// OUT of FormField's per-field error slot — a separate paragraph below both
// fields (mirrors the Angular reference's FormGroup-level validator).
const passwordsMismatch = computed(
  () =>
    !!upgradeForm.password &&
    !!upgradeForm.confirmPassword &&
    upgradeForm.password !== upgradeForm.confirmPassword &&
    confirmDirty.value,
);

const upgradeInvalid = computed(() => {
  if (!upgradeForm.email.trim() || !isValidEmail(upgradeForm.email)) return true;
  if (!upgradeForm.password) return true;
  if (upgradeForm.password.length < 8) return true;
  if (upgradeForm.password !== upgradeForm.confirmPassword) return true;
  return false;
});

const upgradeHook = usePostApiDemoUpgrade();

function openUpgrade() {
  upgradeForm.email = session.value?.email ?? '';
  upgradeForm.password = '';
  upgradeForm.confirmPassword = '';
  upgradeForm.displayName = '';
  touched.email = false;
  touched.password = false;
  confirmDirty.value = false;
  upgradeError.value = '';
  upgradeDialogOpen.value = true;
}

async function submitUpgrade() {
  if (upgradeInvalid.value) return;
  if (upgradeForm.password !== upgradeForm.confirmPassword) {
    upgradeError.value = t('demo.passwordMismatch');
    return;
  }
  try {
    const res = await upgradeHook.mutateAsync({
      data: {
        email: upgradeForm.email,
        password: upgradeForm.password,
        displayName: upgradeForm.displayName || undefined,
      },
    });
    if (res.token) {
      await loginWithToken(res.token);
    }
    upgradeDialogOpen.value = false;
    clearDemoSession();
    dismissed.value = true;
    toast(t('demo.upgradeSuccess'));
  } catch (e: unknown) {
    upgradeError.value = extractMessage(e);
  }
}
</script>

<template>
  <div
    v-if="session && !dismissed"
    class="m-4 mb-0 rounded-xl border border-brand/30 bg-brand-tint/60 p-4 text-sm"
  >
    <div class="flex items-start gap-3">
      <Sparkles class="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" />
      <div class="flex-1 space-y-3">
        <!-- Header row: title + countdown -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="font-semibold text-brand">{{ t('demo.bannerTitle') }}</span>
          <span class="text-muted-foreground">{{ t('demo.bannerDesc') }}</span>
          <span
            class="ms-auto rounded-md bg-background/70 px-2 py-0.5 font-mono text-xs"
            :class="expired ? 'text-destructive' : 'text-foreground'"
          >
            {{ expired ? t('demo.expired') : t('demo.expiresIn', { time: countdown }) }}
          </span>
        </div>

        <!-- Project key + widget login (always visible) -->
        <div class="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span>
            <span class="text-muted-foreground">{{ t('demo.projectKey') }}:</span>
            <span class="ms-1 font-mono">{{ session.projectKey }}</span>
          </span>
          <span>
            <span class="text-muted-foreground">{{ t('demo.widgetLogin') }}:</span>
            <span class="ms-1 font-mono">{{ session.email }}</span>
            <template v-if="session.password">
              <span class="mx-1 text-muted-foreground">/</span>
              <span class="font-mono">{{ session.password }}</span>
            </template>
            <template v-else>
              <span class="ms-1 text-xs text-muted-foreground italic">{{ t('demo.credsEmailed') }}</span>
            </template>
          </span>
        </div>

        <!-- The steps themselves live in the shared install guide (also reachable
             from the header), so demo and permanent accounts read the same thing. -->
        <div>
          <Button variant="outline" size="sm" type="button" @click="guideOpen = true">
            <Rocket class="h-4 w-4" />
            {{ t('install.open') }}
          </Button>
        </div>

        <!-- Keep this workspace button -->
        <div class="flex justify-end">
          <Button variant="outline" size="sm" type="button" @click="openUpgrade">
            {{ t('demo.keepWorkspace') }}
          </Button>
        </div>
      </div>

      <!-- Dismiss button (always visible) -->
      <Button
        variant="ghost"
        size="icon"
        class="flex-shrink-0"
        :aria-label="t('demo.dismiss')"
        @click="dismiss"
      >
        <X class="h-4 w-4" />
      </Button>
    </div>
  </div>

  <!-- Upgrade dialog -->
  <Dialog v-model:open="upgradeDialogOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('demo.upgradeTitle') }}</DialogTitle>
      </DialogHeader>
      <p class="text-sm text-muted-foreground">{{ t('demo.upgradeIntro') }}</p>
      <form class="flex flex-col gap-3 pt-2" @submit.prevent="submitUpgrade">
        <FormField :label="t('demo.email')" html-for="upg-email" :error="emailError">
          <Input
            id="upg-email"
            v-model="upgradeForm.email"
            type="email"
            autocomplete="email"
            @blur="touched.email = true"
          />
        </FormField>
        <FormField :label="t('demo.password')" html-for="upg-pw" :error="passwordError">
          <PasswordInput
            id="upg-pw"
            v-model="upgradeForm.password"
            autocomplete="new-password"
            @blur="touched.password = true"
          />
        </FormField>
        <FormField :label="t('demo.confirmPassword')" html-for="upg-cpw">
          <PasswordInput
            id="upg-cpw"
            v-model="upgradeForm.confirmPassword"
            autocomplete="new-password"
            @input="confirmDirty = true"
          />
        </FormField>
        <FormField :label="t('demo.displayName')" html-for="upg-dn">
          <Input id="upg-dn" v-model="upgradeForm.displayName" autocomplete="name" />
        </FormField>
        <!-- Cross-field check spans both fields, so it can't live in either
             FormField's per-field error slot — separate paragraph below them. -->
        <p v-if="passwordsMismatch" class="text-sm text-destructive">
          {{ t('demo.passwordMismatch') }}
        </p>
        <p v-if="upgradeError" class="text-sm text-destructive">{{ upgradeError }}</p>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="upgradeDialogOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="upgradeInvalid || upgradeHook.isPending.value" @click="submitUpgrade">
          {{ t('demo.upgradeSubmit') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
