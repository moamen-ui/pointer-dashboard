<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  useGetApiAuthSignupEnabled,
  usePostApiAuthRegisterAdmin,
  useGetApiPlans,
} from '@moamen-ui/pointer-vue';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractMessage } from '@/lib/error';
import { cn } from '@/lib/utils';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

// Signup availability comes from the typed SignupEnabledResponse { enabled }.
const { data: signupData, isPending: checking } = useGetApiAuthSignupEnabled();
const signupOpen = computed(() => signupData.value?.enabled === true);
const signupClosed = computed(() => !checking.value && !signupOpen.value);

// Public plans list — anonymous endpoint, ordered by sortOrder.
// Visible (displayState 0) are selectable; ComingSoon (1) shown greyed & disabled; Hidden (2) excluded.
const { data: plansRaw } = useGetApiPlans();

interface PlanPublicResponse {
  slug?: string | null;
  name?: string | null;
  priceMonthly?: number;
  currency?: string | null;
  interval?: number;
  featureBullets?: string[] | null;
  displayState?: number; // 0=Visible, 1=ComingSoon, 2=Hidden
  sortOrder?: number;
}

const allPlans = computed<PlanPublicResponse[]>(
  () => (plansRaw.value as unknown as PlanPublicResponse[] | undefined) ?? [],
);

// Filter out Hidden (2), sort by sortOrder.
const selectablePlans = computed(() =>
  allPlans.value
    .filter((p) => p.displayState !== 2)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
);

// Honor ?plan=<slug>: preselect if Visible (displayState 0). Default null = Free.
const planSlugFromQuery = computed<string | null>(() => {
  const q = route.query.plan;
  return typeof q === 'string' ? q : null;
});

const selectedSlug = ref<string | null>(null);
// Whether we've already applied the query-param preselection (run once when plans load).
const preselected = ref(false);

watchEffect(() => {
  if (preselected.value) return;
  const slug = planSlugFromQuery.value;
  if (!slug) { preselected.value = true; return; }
  const plans = selectablePlans.value;
  if (plans.length === 0) return; // wait for plans to load
  const match = plans.find((p) => p.slug === slug && p.displayState === 0);
  selectedSlug.value = match?.slug ?? null;
  preselected.value = true;
});

function formatPlanPrice(plan: PlanPublicResponse): string {
  if (!plan.priceMonthly) return t('signup.plan.free');
  const interval = plan.interval === 1 ? '/yr' : '/mo';
  return `${plan.priceMonthly} ${plan.currency ?? 'USD'}${interval}`;
}

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
    // INTENTIONAL: planId is always sent as null (undefined) here.
    //
    // The public /api/plans endpoint returns PlanPublicResponse which has no `id` field,
    // only `slug`. Resolving a slug to an integer planId would require either:
    //   (a) the admin /api/admin/plans endpoint (requires super-admin auth), or
    //   (b) an id-bearing public endpoint that does not yet exist.
    //
    // The spec decision: treat the plan selector as display-only marketing UI.
    // When payment integration + an id-bearing public endpoint exist, replace
    // `planId: undefined` below with the resolved integer.
    //
    // See monetization-ui-spec.md §4 "Submit selected plan's id?"
    await registerAdmin.mutateAsync({
      data: {
        email: email.value,
        password: password.value,
        displayName: displayName.value,
        // planId: null — intentionally omitted until payment integration
      },
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
    <Card class="w-[440px] max-w-[92vw]">
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

          <!-- Plan selector (marketing display only) -->
          <div v-if="selectablePlans.length > 0" class="flex flex-col gap-2">
            <Label class="text-sm font-medium">{{ t('signup.plan.choosePlan') }}</Label>
            <div class="flex flex-col gap-2">
              <button
                v-for="plan in selectablePlans"
                :key="plan.slug ?? plan.name ?? ''"
                type="button"
                :disabled="plan.displayState === 1"
                :class="cn(
                  'flex w-full flex-col gap-1 rounded-lg border px-3 py-3 text-start transition-colors',
                  selectedSlug === plan.slug
                    ? 'border-brand bg-brand-tint text-brand'
                    : 'border-border bg-card text-card-foreground hover:border-brand/50',
                  plan.displayState === 1 && 'cursor-not-allowed opacity-50',
                )"
                @click="plan.displayState !== 1 && (selectedSlug = plan.slug ?? null)"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-semibold">{{ plan.name }}</span>
                  <span class="text-xs font-medium">{{ formatPlanPrice(plan) }}</span>
                </div>
                <span v-if="plan.displayState === 1" class="chip chip-neutral text-[10px]">
                  {{ t('signup.plan.comingSoon') }}
                </span>
                <ul v-if="plan.featureBullets && plan.featureBullets.length > 0" class="mt-1 flex flex-col gap-0.5">
                  <li
                    v-for="(bullet, i) in plan.featureBullets.slice(0, 3)"
                    :key="i"
                    class="text-xs text-muted-foreground"
                  >
                    · {{ bullet }}
                  </li>
                </ul>
              </button>
            </div>
            <p class="text-xs text-muted-foreground">{{ t('signup.plan.marketingNote') }}</p>
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
