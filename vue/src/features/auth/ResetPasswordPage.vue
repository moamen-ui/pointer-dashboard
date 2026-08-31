<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
// @ts-ignore composable ships in the client version published at deploy (>=1.0.8)
import { usePostApiAuthResetPassword } from '@moamen-ui/pointer-vue';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import FormField from '@/components/shared/FormField.vue';
import { extractMessage } from '@/lib/error';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const resetMutation = usePostApiAuthResetPassword();

const token = computed(() => (route.query.token as string | undefined) ?? '');

const newPassword = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const done = ref(false);

// Angular-parity validation: newPassword required + min length 8, confirmPassword
// required. Errors appear only after a field was touched (blurred), like
// FormControl.invalid && FormControl.touched. Confirm deliberately gets NO
// per-field error copy (matches the Angular reference) — its feedback is the
// cross-field mismatch paragraph below both fields.
const touched = reactive({ newPassword: false, confirmPassword: false });

const newPasswordError = computed(() => {
  if (!touched.newPassword) return '';
  if (!newPassword.value) return t('common.fieldRequired');
  if (newPassword.value.length < 8) return t('common.passwordMinLength', { min: 8 });
  return '';
});

// Cross-field mismatch: belongs to the field pair, not one field, so it stays
// OUT of FormField's per-field error slot — a separate paragraph below both
// fields (mirrors the Angular reference's FormGroup-level validator).
const passwordsMismatch = computed(
  () => touched.confirmPassword && newPassword.value !== confirmPassword.value,
);

const canSubmit = computed(
  () =>
    !!token.value &&
    newPassword.value.length >= 8 &&
    newPassword.value === confirmPassword.value,
);

async function onSubmit() {
  if (!canSubmit.value) return;
  loading.value = true;
  error.value = null;
  try {
    await resetMutation.mutateAsync({ data: { token: token.value, newPassword: newPassword.value } });
    done.value = true;
    await router.replace('/login');
  } catch (err) {
    error.value = extractMessage(err) || t('auth.resetInvalid');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-secondary p-4">
    <Card class="w-[380px] max-w-[92vw]">
      <CardContent class="flex flex-col gap-5 p-6">
        <h1 class="text-center text-xl font-bold">{{ t('auth.resetTitle') }}</h1>

        <!-- No token in URL -->
        <div v-if="!token" class="flex flex-col gap-4 text-center">
          <p class="text-sm text-destructive">{{ t('auth.resetInvalid') }}</p>
          <Button variant="outline" @click="router.push('/login')">
            {{ t('auth.backToLogin') }}
          </Button>
        </div>

        <!-- Success flash (briefly shown before router.replace fires) -->
        <div v-else-if="done" class="flex flex-col gap-4 text-center">
          <p class="text-sm text-green-600 dark:text-green-400">{{ t('auth.resetDone') }}</p>
        </div>

        <!-- Reset form -->
        <form v-else class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <FormField :label="t('auth.newPassword')" html-for="new-password" :error="newPasswordError">
            <PasswordInput
              id="new-password"
              v-model="newPassword"
              autocomplete="new-password"
              required
              @blur="touched.newPassword = true"
            />
          </FormField>
          <FormField :label="t('auth.confirmPassword')" html-for="confirm-password">
            <PasswordInput
              id="confirm-password"
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
            {{ t('auth.resetSubmit') }}
          </Button>
          <Button variant="ghost" size="sm" @click="router.push('/login')">
            {{ t('auth.backToLogin') }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
