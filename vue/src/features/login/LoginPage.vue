<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePostApiDemo, type DemoSessionResponse } from '@moamen-ui/pointer-vue';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import FormField from '@/components/shared/FormField.vue';
import { useAuth } from '@/composables/useAuth';
import { setDemoSession } from '@/lib/demoSession';
import { extractMessage } from '@/lib/error';
import { isValidEmail } from '@/lib/validation';
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

// Angular-parity validation: errors appear only after a field was touched
// (blurred), like FormControl.invalid && FormControl.touched.
const touched = reactive({ email: false, password: false });

const emailError = computed(() => {
  if (!touched.email) return '';
  if (!email.value.trim()) return t('common.fieldRequired');
  if (!isValidEmail(email.value)) return t('common.invalidEmail');
  return '';
});

const passwordError = computed(() => {
  if (!touched.password) return '';
  if (!password.value) return t('common.fieldRequired');
  return '';
});

const formInvalid = computed(() => !email.value.trim() || !isValidEmail(email.value) || !password.value);

// Already authenticated? go straight to the role-appropriate page.
if (isAuthenticated.value) {
  void router.replace(isAdmin.value ? '/overview' : '/profile');
}

async function onSubmit() {
  if (formInvalid.value) return;
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
          <FormField :label="t('login.email')" html-for="email" :error="emailError">
            <Input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              @blur="touched.email = true"
            />
          </FormField>
          <FormField :label="t('login.password')" html-for="password" :error="passwordError">
            <PasswordInput
              id="password"
              v-model="password"
              autocomplete="current-password"
              required
              @blur="touched.password = true"
            />
          </FormField>
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <Button
            type="submit"
            class="mt-1"
            :disabled="loading || formInvalid"
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
