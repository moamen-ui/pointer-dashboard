<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  useGetApiMeProfile,
  useGetApiAdminUsersIdProfile,
  type ProfileProject,
  type ProfileEnvironment,
} from '@moamen-ui/pointer-vue';
import {
  Folder,
  MessageSquare,
  Reply,
  ChevronDown,
  ChevronRight,
} from 'lucide-vue-next';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/composables/useAuth';
import { useStatusCatalog } from '@/composables/useStatusCatalog';

const { t } = useI18n();
const route = useRoute();
const { isAdmin } = useAuth();
const { color: statusColor, label: statusLabel } = useStatusCatalog();

// Determine if this is an admin viewing another user's profile.
const routeId = computed(() => {
  const raw = route.params.id;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(n) && n > 0 ? n : null;
});

// Fire exactly one query via reactive `enabled`.
const isAdminView = computed(() => isAdmin.value && routeId.value != null);

// Admin query: GET /api/admin/users/{id}/profile
const adminQuery = useGetApiAdminUsersIdProfile(
  computed(() => routeId.value ?? 0),
  { query: { enabled: computed(() => isAdminView.value) } },
);

// Me query: GET /api/me/profile
const meQuery = useGetApiMeProfile(
  { query: { enabled: computed(() => !isAdminView.value) } },
);

const data = computed(() => isAdminView.value ? adminQuery.data.value : meQuery.data.value);
const isLoading = computed(() => isAdminView.value ? adminQuery.isLoading.value : meQuery.isLoading.value);
const isError = computed(() => isAdminView.value ? adminQuery.isError.value : meQuery.isError.value);

const profileUser = computed(() => data.value?.user);
const totals = computed(() => data.value?.totals);
const projects = computed<ProfileProject[]>(() => data.value?.projects ?? []);

// Status value constants.
const STATUS_OPEN = 1;
const STATUS_READY = 2;
const STATUS_APPLIED = 3;
const STATUS_ARCHIVED = 4;

const ENV_NAMES: Record<number, string> = { 1: 'Local', 2: 'Staging', 3: 'Production' };

function envName(env: number): string {
  return ENV_NAMES[env] ?? String(env);
}

// Track which project rows have their environment panel expanded.
const expanded = ref<Set<number>>(new Set());
function toggleExpand(projectId: number) {
  const s = new Set(expanded.value);
  if (s.has(projectId)) {
    s.delete(projectId);
  } else {
    s.add(projectId);
  }
  expanded.value = s;
}

// Build status breakdown for a project or environment row.
type StatusBucket = { value: number; count: number };
function statusBuckets(row: ProfileProject | ProfileEnvironment): StatusBucket[] {
  return [
    { value: STATUS_OPEN,     count: row.open ?? 0 },
    { value: STATUS_READY,    count: row.readyToApply ?? 0 },
    { value: STATUS_APPLIED,  count: row.applied ?? 0 },
    { value: STATUS_ARCHIVED, count: row.archived ?? 0 },
  ].filter((b) => b.count > 0);
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Loading bar -->
    <div v-if="isLoading" class="h-0.5 w-full overflow-hidden rounded bg-muted">
      <div class="h-full w-1/3 animate-pulse bg-primary" />
    </div>

    <!-- Error state -->
    <p v-else-if="isError" class="text-sm text-destructive">
      {{ t('profile.loadError') }}
    </p>

    <template v-else-if="data">
      <!-- Headline: user info -->
      <div>
        <h1 class="text-xl font-bold">{{ profileUser?.displayName ?? t('profile.unknownUser') }}</h1>
        <p class="text-sm text-muted-foreground">{{ profileUser?.email }}</p>
        <p v-if="profileUser?.roleName" class="mt-0.5 text-xs text-muted-foreground">
          {{ profileUser.roleName }}
        </p>
      </div>

      <!-- Headline stats -->
      <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
        <!-- Projects involved -->
        <Card>
          <CardContent class="flex items-center gap-3 p-4">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
              <Folder class="h-5 w-5" />
            </div>
            <div class="flex flex-col">
              <span class="text-[1.5rem] font-bold leading-tight">{{ totals?.projectsInvolved ?? 0 }}</span>
              <span class="mt-0.5 text-[0.72rem] uppercase tracking-wide text-muted-foreground">{{ t('profile.projects') }}</span>
            </div>
          </CardContent>
        </Card>

        <!-- Total comments -->
        <Card>
          <CardContent class="flex items-center gap-3 p-4">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
              <MessageSquare class="h-5 w-5" />
            </div>
            <div class="flex flex-col">
              <span class="text-[1.5rem] font-bold leading-tight">{{ totals?.comments ?? 0 }}</span>
              <span class="mt-0.5 text-[0.72rem] uppercase tracking-wide text-muted-foreground">{{ t('profile.comments') }}</span>
            </div>
          </CardContent>
        </Card>

        <!-- Total replies (separate from status breakdown) -->
        <Card>
          <CardContent class="flex items-center gap-3 p-4">
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300">
              <Reply class="h-5 w-5" />
            </div>
            <div class="flex flex-col">
              <span class="text-[1.5rem] font-bold leading-tight">{{ totals?.replies ?? 0 }}</span>
              <span class="mt-0.5 text-[0.72rem] uppercase tracking-wide text-muted-foreground">{{ t('profile.replies') }}</span>
            </div>
          </CardContent>
        </Card>

        <!-- Status split: one card per non-zero bucket -->
        <Card
          v-for="bucket in statusBuckets(totals ?? {})"
          :key="bucket.value"
        >
          <CardContent class="flex items-center gap-3 p-4">
            <div
              class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
              :style="{ backgroundColor: statusColor(bucket.value) + '22', color: statusColor(bucket.value) }"
            >
              <span class="text-xs font-bold">{{ bucket.count }}</span>
            </div>
            <div class="flex flex-col">
              <span
                class="text-[1.5rem] font-bold leading-tight"
                :style="{ color: statusColor(bucket.value) }"
              >{{ bucket.count }}</span>
              <span class="mt-0.5 text-[0.72rem] uppercase tracking-wide text-muted-foreground">
                {{ statusLabel(bucket.value) }}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Per-project breakdown -->
      <div v-if="projects.length > 0">
        <h2 class="mb-3 text-base font-semibold">{{ t('profile.projectBreakdown') }}</h2>

        <div class="flex flex-col gap-2">
          <Card v-for="proj in projects" :key="proj.projectId">
            <CardContent class="p-0">
              <!-- Project row -->
              <button
                type="button"
                class="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-accent/40 transition-colors"
                @click="toggleExpand(proj.projectId ?? 0)"
              >
                <component
                  :is="expanded.has(proj.projectId ?? 0) ? ChevronDown : ChevronRight"
                  class="h-4 w-4 flex-shrink-0 text-muted-foreground"
                />
                <span class="flex-1 font-medium">
                  {{ proj.name }}
                  <code class="ms-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{{ proj.key }}</code>
                </span>

                <!-- Totals: comments -->
                <span class="flex items-center gap-1 text-sm text-muted-foreground" :title="t('profile.comments')">
                  <MessageSquare class="h-3.5 w-3.5" />
                  {{ proj.comments ?? 0 }}
                </span>

                <!-- Totals: replies (separate) -->
                <span class="flex items-center gap-1 text-sm text-muted-foreground" :title="t('profile.replies')">
                  <Reply class="h-3.5 w-3.5" />
                  {{ proj.replies ?? 0 }}
                </span>

                <!-- Status buckets -->
                <span
                  v-for="bucket in statusBuckets(proj)"
                  :key="bucket.value"
                  class="ms-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                  :style="{ backgroundColor: statusColor(bucket.value) + '22', color: statusColor(bucket.value) }"
                >
                  {{ statusLabel(bucket.value) }} {{ bucket.count }}
                </span>
              </button>

              <!-- Expandable environment split -->
              <template v-if="expanded.has(proj.projectId ?? 0) && (proj.environments?.length ?? 0) > 0">
                <div class="border-t border-border">
                  <div
                    v-for="env in proj.environments"
                    :key="env.environment"
                    class="flex items-center gap-3 bg-muted/30 px-4 py-2 text-sm"
                  >
                    <span class="w-24 flex-shrink-0 font-medium text-muted-foreground">
                      {{ envName(env.environment ?? 0) }}
                    </span>

                    <span class="flex items-center gap-1 text-muted-foreground" :title="t('profile.comments')">
                      <MessageSquare class="h-3 w-3" />
                      {{ env.comments ?? 0 }}
                    </span>

                    <span class="flex items-center gap-1 text-muted-foreground" :title="t('profile.replies')">
                      <Reply class="h-3 w-3" />
                      {{ env.replies ?? 0 }}
                    </span>

                    <span
                      v-for="bucket in statusBuckets(env)"
                      :key="bucket.value"
                      class="ms-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      :style="{ backgroundColor: statusColor(bucket.value) + '22', color: statusColor(bucket.value) }"
                    >
                      {{ statusLabel(bucket.value) }} {{ bucket.count }}
                    </span>
                  </div>
                </div>
              </template>
            </CardContent>
          </Card>
        </div>
      </div>

      <p v-else class="text-sm text-muted-foreground">{{ t('profile.noProjects') }}</p>
    </template>
  </div>
</template>
