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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import FormField from '@/components/shared/FormField.vue';
import { useAuth } from '@/composables/useAuth';
import { extractMessage } from '@/lib/error';
import { isValidEmail } from '@/lib/validation';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { loginWithToken } = useAuth();

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
  <div class="flex min-h-screen items-center justify-center bg-secondary p-4">
    <Card class="w-[420px] max-w-[92vw]">
      <CardContent class="flex flex-col gap-5 p-6">

        <!-- Missing code -->
        <div v-if="!code" class="flex flex-col gap-4 text-center">
          <p class="text-sm text-destructive">{{ t('invite.invalidLink') }}</p>
          <Button variant="outline" @click="router.push('/login')">
            {{ t('auth.backToLogin') }}
          </Button>
        </div>

        <!-- Loading preview -->
        <div v-else-if="previewQuery.isPending.value" class="text-center text-sm text-muted-foreground py-4">
          …
        </div>

        <!-- Preview error / invalid -->
        <div v-else-if="previewQuery.isError.value" class="flex flex-col gap-4 text-center">
          <p class="text-sm text-destructive">{{ t('invite.invalidOrExpired') }}</p>
          <Button variant="outline" @click="router.push('/login')">
            {{ t('auth.backToLogin') }}
          </Button>
        </div>

        <!-- Join form -->
        <template v-else-if="preview">
          <h1 class="text-center text-xl font-bold">
            {{ t('invite.joinTitle', { workspace: preview.workspaceName ?? '' }) }}
          </h1>
          <p v-if="preview.roleName" class="text-center text-sm text-muted-foreground">
            {{ t('invite.joinRole', { role: preview.roleName }) }}
          </p>

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
            <p v-if="passwordsMismatch" class="text-sm text-destructive">
              {{ t('invite.passwordMismatch') }}
            </p>

            <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

            <Button
              type="submit"
              class="mt-1"
              :disabled="loading || !canSubmit"
            >
              {{ t('invite.join') }}
            </Button>
          </form>

          <Button variant="ghost" size="sm" @click="router.push('/login')">
            {{ t('auth.backToLogin') }}
          </Button>
        </template>

      </CardContent>
    </Card>
  </div>
</template>
