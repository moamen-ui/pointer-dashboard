<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
// @ts-ignore composable ships in the client version published at deploy (>=1.0.14)
import {
  useGetApiInvitesCode,
  usePostApiAuthRegisterInvite,
  type InvitePreviewResponse,
} from '@moamen-ui/pointer-vue';
import { Pin } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import FormField from '@/components/shared/FormField.vue';
import { useAuth } from '@/composables/useAuth';
import { useBranding } from '@/composables/useBranding';
import { extractMessage } from '@/lib/error';
import { isValidEmail } from '@/lib/validation';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { loginWithToken } = useAuth();
const { branding } = useBranding();

const code = computed(() => (route.query.code as string | undefined) ?? '');

// Fetch preview only when we have a code.
const previewQuery = useGetApiInvitesCode(code, {
  query: { enabled: computed(() => !!code.value) },
});
const preview = computed(() => previewQuery.data.value as unknown as InvitePreviewResponse | undefined);

const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const displayName = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

// Angular-parity validation: email required + format, displayName required,
// password required + min length 8, confirmPassword required. Errors appear
// only after a field was touched (blurred), like FormControl.invalid &&
// FormControl.touched. Confirm deliberately gets NO per-field error copy
// (matches the Angular reference) — its feedback is the cross-field mismatch
// paragraph below both fields.
const touched = reactive({ email: false, displayName: false, password: false, confirmPassword: false });

const emailError = computed(() => {
  if (!touched.email) return '';
  if (!email.value.trim()) return t('common.fieldRequired');
  if (!isValidEmail(email.value)) return t('common.invalidEmail');
  return '';
});

const displayNameError = computed(() =>
  touched.displayName && !displayName.value.trim() ? t('common.fieldRequired') : '',
);

const passwordError = computed(() => {
  if (!touched.password) return '';
  if (!password.value) return t('common.fieldRequired');
  if (password.value.length < 8) return t('common.passwordMinLength', { min: 8 });
  return '';
});

// Cross-field mismatch: belongs to the field pair, not one field, so it stays
// OUT of FormField's per-field error slot — a separate paragraph below both
// fields (mirrors the Angular reference's FormGroup-level validator).
const passwordsMismatch = computed(
  () => touched.confirmPassword && password.value !== confirmPassword.value,
);

const canSubmit = computed(
  () =>
    !!email.value.trim() &&
    isValidEmail(email.value) &&
    !!displayName.value.trim() &&
    password.value.length >= 8 &&
    password.value === confirmPassword.value,
);

const registerMutation = usePostApiAuthRegisterInvite();

async function onSubmit() {
  if (!canSubmit.value) {
    if (password.value !== confirmPassword.value) {
      error.value = t('invite.passwordMismatch');
    }
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const res = await registerMutation.mutateAsync({
      data: {
        code: code.value,
        email: email.value,
        password: password.value,
        displayName: displayName.value,
      },
    });
    // res is the LoginResponse — sign in like login/demo flow
    const token = (res as any).token ?? '';
    if (!token) throw new Error(t('invite.invalidOrExpired'));
    const user = await loginWithToken(token);
    await router.replace(user?.isAdmin ? '/overview' : '/profile');
  } catch (err) {
    error.value = extractMessage(err) || t('invite.invalidOrExpired');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-4">
    <div class="w-full max-w-[400px] flex flex-col gap-6">
      <!-- Brand mark -->
      <div class="flex items-center gap-2">
        <Pin class="h-4 w-4 text-brand rotate-45" />
        <span class="text-[20px] font-semibold text-foreground">{{ branding.productName ? `${branding.productName} Admin` : t('header.brand') }}</span>
      </div>

      <!-- Missing code -->
      <div v-if="!code" class="flex flex-col gap-4 text-center">
        <p class="text-[14px] text-state-danger">{{ t('invite.invalidLink') }}</p>
        <Button variant="secondary" @click="router.push('/login')">
          {{ t('auth.backToLogin') }}
        </Button>
      </div>

      <!-- Loading preview -->
      <div v-else-if="previewQuery.isPending.value" class="text-center text-[14px] text-muted-foreground py-4">
        …
      </div>

      <!-- Preview error / invalid -->
      <div v-else-if="previewQuery.isError.value" class="flex flex-col gap-4 text-center">
        <p class="text-[14px] text-state-danger">{{ t('invite.invalidOrExpired') }}</p>
        <Button variant="secondary" @click="router.push('/login')">
          {{ t('auth.backToLogin') }}
        </Button>
      </div>

      <!-- Join form -->
      <template v-else-if="preview">
        <div class="flex flex-col gap-1">
          <h1 class="text-[20px] font-semibold text-foreground">
            {{ t('invite.joinTitle', { workspace: preview.workspaceName ?? '' }) }}
          </h1>
          <p v-if="preview.roleName" class="text-[14px] text-muted-foreground">
            {{ t('invite.joinRole', { role: preview.roleName }) }}
          </p>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <!-- Email -->
          <FormField :label="t('login.email')" html-for="join-email" :error="emailError">
            <Input
              id="join-email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              @blur="touched.email = true"
            />
          </FormField>

          <!-- Display name -->
          <FormField :label="t('invite.displayName')" html-for="join-name" :error="displayNameError">
            <Input
              id="join-name"
              v-model="displayName"
              autocomplete="name"
              required
              @blur="touched.displayName = true"
            />
          </FormField>

          <!-- Password -->
          <FormField :label="t('invite.password')" html-for="join-password" :error="passwordError">
            <PasswordInput
              id="join-password"
              v-model="password"
              autocomplete="new-password"
              required
              @blur="touched.password = true"
            />
          </FormField>

          <!-- Confirm password -->
          <FormField :label="t('invite.confirmPassword')" html-for="join-confirm">
            <PasswordInput
              id="join-confirm"
              v-model="confirmPassword"
              autocomplete="new-password"
              required
              @blur="touched.confirmPassword = true"
            />
          </FormField>

          <!-- Cross-field check spans both fields, so it can't live in either
               FormField's per-field error slot — separate paragraph below them. -->
          <p v-if="passwordsMismatch" class="text-[14px] text-state-danger">
            {{ t('invite.passwordMismatch') }}
          </p>

          <p v-if="error" class="text-[14px] text-state-danger">{{ error }}</p>

          <Button
            type="submit"
            class="w-full"
            :disabled="loading || !canSubmit"
          >
            {{ t('invite.join') }}
          </Button>
        </form>

        <!-- Links -->
        <div class="flex flex-col gap-2 pt-2 border-t border-border">
          <RouterLink to="/login" class="text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {{ t('auth.backToLogin') }}
          </RouterLink>
        </div>
      </template>

    </div>
  </div>
</template>
