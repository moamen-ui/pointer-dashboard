<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
// @ts-ignore composable ships in the client version published at deploy (>=1.0.8)
import { usePostApiAuthResetPassword } from '@moamen-ui/pointer-vue';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
          <div class="flex flex-col gap-2">
            <Label for="new-password">{{ t('auth.newPassword') }}</Label>
            <Input
              id="new-password"
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              minlength="8"
              required
            />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="confirm-password">{{ t('auth.confirmPassword') }}</Label>
            <Input
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              minlength="8"
              required
            />
          </div>
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
