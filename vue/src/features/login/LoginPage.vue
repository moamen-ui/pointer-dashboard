<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/composables/useAuth';
import { extractMessage } from '@/lib/error';

const { t } = useI18n();
const router = useRouter();
const { login, isAuthenticated, isAdmin } = useAuth();

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

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
        <p class="text-center text-xs text-muted-foreground">
          {{ t('login.signupPrompt') }}
          <RouterLink to="/signup" class="underline">{{ t('login.signupLink') }}</RouterLink>
        </p>
      </CardContent>
    </Card>
  </div>
</template>
