<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePostApiDemo, type DemoSessionResponse } from '@moamen-ui/pointer-vue';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/composables/useAuth';
import { setDemoSession } from '@/lib/demoSession';
import { extractMessage } from '@/lib/error';
import { toast } from '@/composables/useToast';

const { t } = useI18n();
const router = useRouter();
const { login, loginWithToken, isAuthenticated, isAdmin } = useAuth();
const demoMutation = usePostApiDemo();

const email = ref('');
const password = ref('');
const demoEmail = ref('');
const loading = ref(false);
const demoLoading = ref(false);
const error = ref<string | null>(null);
const demoEmailError = ref<string | null>(null);
const demoEmailSent = ref(false);

// Already authenticated? go straight to the role-appropriate page.
if (isAuthenticated.value) {
  void router.replace(isAdmin.value ? '/overview' : '/profile');
}

async function onSubmit() {
  if (!email.value || !password.value) return;
  loading.value = true;
  error.value = null;
  try {
    const user = await login(email.value, password.value);
    await router.replace(user?.isAdmin ? '/overview' : '/profile');
  } catch (err) {
    error.value = extractMessage(err) || t('login.failed');
  } finally {
    loading.value = false;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function onTryDemo() {
  demoEmailError.value = null;
  if (!demoEmail.value.trim() || !isValidEmail(demoEmail.value)) {
    demoEmailError.value = t('login.demoEmailLabel');
    return;
  }
  demoLoading.value = true;
  error.value = null;
  try {
    // customInstance unwraps the Result<T> envelope, so this resolves to the inner
    // DemoSessionResponse at runtime (the generated type names the wrapper).
    const demo = (await demoMutation.mutateAsync({ data: { email: demoEmail.value } })) as unknown as DemoSessionResponse;
    if (!demo?.token) throw new Error(t('demo.failed'));

    const user = await loginWithToken(demo.token);
    setDemoSession({
      email: demo.email ?? '',
      password: demo.password ?? '',
      projectKey: demo.projectKey ?? '',
      serverUrl: demo.serverUrl ?? '',
      expiresAt: demo.expiresAt ?? '',
      emailSent: demo.emailSent === true,
    });
    if (demo.emailSent) {
      demoEmailSent.value = true;
    }
    await router.replace(user?.isAdmin ? '/overview' : '/profile');
  } catch (err) {
    toast(extractMessage(err) || t('demo.failed'));
  } finally {
    demoLoading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-secondary p-4">
    <Card class="w-[380px] max-w-[92vw]">
      <CardContent class="flex flex-col gap-5 p-6">
        <h1 class="text-center text-xl font-bold">{{ t('login.title') }}</h1>
        <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <div class="flex flex-col gap-2">
            <Label for="email">{{ t('login.email') }}</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
            />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="password">{{ t('login.password') }}</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <Button
            type="submit"
            class="mt-1"
            :disabled="loading || !email || !password"
          >
            {{ t('login.signIn') }}
          </Button>
        </form>
        <div class="flex items-center gap-3">
          <span class="h-px flex-1 bg-border" />
          <span class="text-xs text-muted-foreground">{{ t('common.or') }}</span>
          <span class="h-px flex-1 bg-border" />
        </div>
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-2">
            <Label for="demo-email">{{ t('login.demoEmailLabel') }}</Label>
            <Input
              id="demo-email"
              v-model="demoEmail"
              type="email"
              autocomplete="email"
              :placeholder="t('login.demoEmailLabel')"
            />
            <p v-if="demoEmailError" class="text-xs text-destructive">
              {{ t('login.demoEmailLabel') }} — {{ t('login.failed').toLowerCase() }}
            </p>
          </div>
          <p v-if="demoEmailSent" class="text-sm text-green-600 dark:text-green-400">
            {{ t('login.demoEmailSent') }}
          </p>
          <Button
            type="button"
            variant="outline"
            :disabled="demoLoading || loading"
            @click="onTryDemo"
          >
            {{ demoLoading ? t('demo.starting') : t('demo.tryDemo') }}
          </Button>
        </div>
        <p class="text-center text-xs text-muted-foreground">
          {{ t('login.signupPrompt') }}
          <RouterLink to="/signup" class="underline">{{ t('login.signupLink') }}</RouterLink>
        </p>
        <p class="text-center text-xs">
          <RouterLink to="/forgot" class="text-muted-foreground underline hover:text-foreground">
            {{ t('login.forgot') }}
          </RouterLink>
        </p>
      </CardContent>
    </Card>
  </div>
</template>
