<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  useGetApiAuthSignupEnabled,
  usePostApiAuthRegisterAdmin,
} from '@moamen-ui/pointer-vue';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractMessage } from '@/lib/error';

const { t } = useI18n();
const router = useRouter();

// Signup availability comes from the typed SignupEnabledResponse { enabled }.
const { data: signupData, isPending: checking } = useGetApiAuthSignupEnabled();
const signupOpen = computed(() => signupData.value?.enabled === true);
const signupClosed = computed(() => !checking.value && !signupOpen.value);

const registerAdmin = usePostApiAuthRegisterAdmin();

const email = ref('');
const password = ref('');
const displayName = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const submitted = ref(false);

async function onSubmit() {
  if (!email.value || !password.value || !displayName.value) return;
  loading.value = true;
  error.value = null;
  try {
    await registerAdmin.mutateAsync({
      data: { email: email.value, password: password.value, displayName: displayName.value },
    });
    submitted.value = true;
  } catch (err) {
    error.value = extractMessage(err) || t('signup.failed');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-secondary p-4">
    <Card class="w-[400px] max-w-[92vw]">
      <CardContent class="flex flex-col gap-5 p-6">
        <h1 class="text-center text-xl font-bold">{{ t('signup.title') }}</h1>

        <!-- Loading check -->
        <div v-if="checking" class="text-center text-sm text-muted-foreground">
          {{ t('signup.checking') }}
        </div>

        <!-- Signup closed -->
        <div v-else-if="signupClosed" class="flex flex-col gap-4 text-center">
          <p class="text-sm text-muted-foreground">{{ t('signup.closed') }}</p>
          <Button variant="outline" @click="router.push('/login')">
            {{ t('signup.backToLogin') }}
          </Button>
        </div>

        <!-- Success state -->
        <div v-else-if="submitted" class="flex flex-col gap-4 text-center">
          <p class="text-sm">{{ t('signup.pendingApproval') }}</p>
          <Button variant="outline" @click="router.push('/login')">
            {{ t('signup.backToLogin') }}
          </Button>
        </div>

        <!-- Signup form -->
        <form v-else-if="signupOpen" class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <div class="flex flex-col gap-2">
            <Label for="signup-name">{{ t('signup.displayName') }}</Label>
            <Input id="signup-name" v-model="displayName" autocomplete="name" required />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="signup-email">{{ t('signup.email') }}</Label>
            <Input id="signup-email" v-model="email" type="email" autocomplete="email" required />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="signup-password">{{ t('signup.password') }}</Label>
            <Input
              id="signup-password"
              v-model="password"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <Button
            type="submit"
            class="mt-1"
            :disabled="loading || !email || !password || !displayName"
          >
            {{ t('signup.submit') }}
          </Button>
          <Button variant="ghost" size="sm" @click="router.push('/login')">
            {{ t('signup.backToLogin') }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
