<script setup lang="ts">
import { computed, ref } from 'vue';
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
import { Label } from '@/components/ui/label';
import { useAuth } from '@/composables/useAuth';
import { extractMessage } from '@/lib/error';

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

const canSubmit = computed(
  () =>
    !!email.value &&
    password.value.length >= 8 &&
    password.value === confirmPassword.value &&
    !!displayName.value,
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
            <div class="flex flex-col gap-2">
              <Label for="join-email">{{ t('login.email') }}</Label>
              <Input
                id="join-email"
                v-model="email"
                type="email"
                autocomplete="email"
                required
              />
            </div>

            <!-- Display name -->
            <div class="flex flex-col gap-2">
              <Label for="join-name">{{ t('invite.displayName') }}</Label>
              <Input
                id="join-name"
                v-model="displayName"
                autocomplete="name"
                required
              />
            </div>

            <!-- Password -->
            <div class="flex flex-col gap-2">
              <Label for="join-password">{{ t('invite.password') }}</Label>
              <Input
                id="join-password"
                v-model="password"
                type="password"
                autocomplete="new-password"
                minlength="8"
                required
              />
            </div>

            <!-- Confirm password -->
            <div class="flex flex-col gap-2">
              <Label for="join-confirm">{{ t('invite.confirmPassword') }}</Label>
              <Input
                id="join-confirm"
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
