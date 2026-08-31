<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
// @ts-ignore composable ships in the client version published at deploy (>=1.0.8)
import { usePostApiAuthForgotPassword } from '@moamen-ui/pointer-vue';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FormField from '@/components/shared/FormField.vue';
import { isValidEmail } from '@/lib/validation';

const { t } = useI18n();
const router = useRouter();

const forgotMutation = usePostApiAuthForgotPassword();

const email = ref('');
const loading = ref(false);
const submitted = ref(false);

// Angular-parity validation: email required + valid format; error appears only
// after the field was touched (blurred), like FormControl.invalid && .touched.
const touched = reactive({ email: false });

const emailError = computed(() => {
  if (!touched.email) return '';
  if (!email.value.trim()) return t('common.fieldRequired');
  if (!isValidEmail(email.value)) return t('common.invalidEmail');
  return '';
});

const formInvalid = computed(() => !email.value.trim() || !isValidEmail(email.value));

async function onSubmit() {
  if (formInvalid.value) return;
  loading.value = true;
  try {
    await forgotMutation.mutateAsync({ data: { email: email.value } });
  } catch {
    // Always show success — never reveal whether the email exists.
  } finally {
    loading.value = false;
    submitted.value = true;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-secondary p-4">
    <Card class="w-[380px] max-w-[92vw]">
      <CardContent class="flex flex-col gap-5 p-6">
        <h1 class="text-center text-xl font-bold">{{ t('auth.forgotTitle') }}</h1>

        <!-- Success state — always shown after submit -->
        <div v-if="submitted" class="flex flex-col gap-4 text-center">
          <p class="text-sm text-muted-foreground">{{ t('auth.forgotSent') }}</p>
          <Button variant="outline" @click="router.push('/login')">
            {{ t('auth.backToLogin') }}
          </Button>
        </div>

        <!-- Request form -->
        <form v-else class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <FormField :label="t('login.email')" html-for="forgot-email" :error="emailError">
            <Input
              id="forgot-email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              @blur="touched.email = true"
            />
          </FormField>
          <Button
            type="submit"
            class="mt-1"
            :disabled="loading || formInvalid"
          >
            {{ t('auth.forgotSubmit') }}
          </Button>
          <Button variant="ghost" size="sm" @click="router.push('/login')">
            {{ t('auth.backToLogin') }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
