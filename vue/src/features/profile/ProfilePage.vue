<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  useGetApiMeProfile,
  useGetApiAdminUsersIdProfile,
  useGetApiMeApiKey,
  usePostApiMeApiKeyRegenerate,
  type ProfileProject,
  type ProfileEnvironment,
} from '@moamen-ui/pointer-vue';
import {
  ChevronDown,
  ChevronRight,
  Key,
  Copy,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/composables/useAuth';
import { statusTone, toneHeaderClass, toneTextClass } from '@/lib/statusTone';
import { useStatusCatalog } from '@/composables/useStatusCatalog';
import { toast } from '@/composables/useToast';
import { confirm } from '@/composables/useConfirm';
import Diffstat from '@/components/shared/Diffstat.vue';
import CountCell from '@/components/shared/CountCell.vue';

const { t } = useI18n();
const route = useRoute();
const { isAdmin } = useAuth();
const { items: statusItems, displayLabelFor: statusLabel } = useStatusCatalog();

// API key state
const apiKeyQuery = useGetApiMeApiKey();
const apiKeyMutation = usePostApiMeApiKeyRegenerate({
  mutation: {
    onSuccess: () => {
      revealKey.value = true;
      apiKeyQuery.refetch();
      toast(t('profile.apiKeyRegenerated'), 'success');
    },
    onError: () => {
      toast(t('profile.error'), 'danger');
    },
  },
});
const revealKey = ref(false);
const isRegenerating = computed(() => apiKeyMutation.isPending.value);

const apiKeyValue = computed(() => apiKeyQuery.data.value?.apiKey ?? null);
const apiKeyPrefix = computed(() => apiKeyQuery.data.value?.prefix);
const apiKeyLastUsedAt = computed(() => apiKeyQuery.data.value?.lastUsedAt);

const maskedApiKey = computed(() => {
  const key = apiKeyValue.value;
  if (!key) return '';
  // Use the server-sent prefix if available, otherwise the first 12 chars of the key
  const prefix = apiKeyPrefix.value || key.slice(0, 12);
  return `${prefix}${'•'.repeat(24)}`;
});

const lastUsedLabel = computed(() => {
  if (!apiKeyLastUsedAt.value) {
    return t('profile.apiKeyNeverUsed');
  }
  return new Date(apiKeyLastUsedAt.value).toLocaleString();
});

async function handleRegenerateKey() {
  const ok = await confirm({
    message: t('profile.regenerateApiKeyConfirm'),
    confirmLabel: t('profile.regenerateApiKey'),
    confirmVariant: 'destructive',
  });
  if (ok) {
    apiKeyMutation.mutate();
  }
}

function copyApiKey() {
  const key = apiKeyValue.value;
  if (!key) return;
  navigator.clipboard?.writeText(key).then(
    () => toast(t('profile.copied'), 'success'),
    () => toast(t('demo.copyFailed'), 'danger'),
  );
}

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
  ];
}

// Build diffstat items for the profile header
const diffstatItems = computed(() => {
  const t_totals = totals.value;
  if (!t_totals) return [];

  return [
    { count: t_totals.projectsInvolved ?? 0, label: t('profile.projects'), severity: undefined as any },
    { count: t_totals.comments ?? 0, label: t('profile.comments'), severity: undefined as any },
    { count: t_totals.replies ?? 0, label: t('profile.replies'), severity: undefined as any },
    { count: t_totals.open ?? 0, label: statusLabel(STATUS_OPEN), severity: 'open' as const },
    { count: t_totals.readyToApply ?? 0, label: statusLabel(STATUS_READY), severity: 'ready' as const },
    { count: t_totals.applied ?? 0, label: statusLabel(STATUS_APPLIED), severity: 'completed' as const },
    { count: t_totals.archived ?? 0, label: statusLabel(STATUS_ARCHIVED), severity: 'archived' as const },
  ];
});

// Get environment names for a project
function getEnvironmentNames(proj: ProfileProject): string {
  return (proj.environments ?? [])
    .map(e => envName(e.environment ?? 0))
    .join(', ');
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Loading bar -->
    <div v-if="isLoading" class="h-0.5 w-full overflow-hidden rounded bg-muted">
      <div class="h-full w-1/3 animate-pulse bg-brand" />
    </div>

    <!-- Error state -->
    <p v-else-if="isError" class="text-[14px] text-state-danger">
      {{ t('profile.loadError') }}
    </p>

    <template v-else-if="data">
      <!-- API key section — first, because it is the one thing on this page a person comes here to copy.
           Masked by default: it is a bearer credential. -->
      <section class="rounded-lg border border-border bg-card p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-2">
            <Key :size="16" class="text-muted-foreground" />
            <h2 class="text-[15px] font-semibold leading-6">{{ t('profile.apiKey') }}</h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            :disabled="isRegenerating || !apiKeyValue"
            @click="handleRegenerateKey"
            class="shrink-0"
          >
            <Loader2 v-if="isRegenerating" :size="16" class="animate-spin" />
            {{ t('profile.regenerateApiKey') }}
          </Button>
        </div>

        <p class="mt-1 text-[13px] text-muted-foreground">{{ t('profile.apiKeyHint') }}</p>

        <div v-if="apiKeyQuery.isLoading.value" class="mt-3 text-[13px] text-muted-foreground">
          {{ t('profile.loading') }}
        </div>
        <div v-else-if="apiKeyValue" class="mt-3 flex flex-wrap items-center gap-2">
          <code class="flex-1 min-w-[16rem] rounded-md border border-border bg-gutter px-3 py-2 font-mono text-[13px] break-all">
            {{ revealKey ? apiKeyValue : maskedApiKey }}
          </code>

          <Button
            variant="ghost"
            size="sm"
            type="button"
            @click="revealKey = !revealKey"
            class="text-muted-foreground hover:text-foreground"
          >
            <component :is="revealKey ? EyeOff : Eye" :size="16" class="me-2" />
            {{ revealKey ? t('install.wizard.hide') : t('install.wizard.reveal') }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            @click="copyApiKey"
          >
            <Copy :size="16" class="me-2" />
            {{ t('profile.copyApiKey') }}
          </Button>
        </div>
        <div v-else class="mt-3 text-[13px] text-muted-foreground">
          {{ t('profile.apiKeyUnavailable') }}
        </div>

        <p v-if="apiKeyValue" class="mt-2 text-[12px] text-muted-foreground">
          {{ t('profile.apiKeyLastUsed') }}:
          <span class="font-mono">{{ lastUsedLabel }}</span>
        </p>
      </section>

      <!-- Title row: display name -->
      <div>
        <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
          {{ profileUser?.displayName ?? t('profile.unknownUser') }}
        </h1>
        <p class="text-[14px] text-muted-foreground">
          {{ profileUser?.email }}
          <span v-if="profileUser?.roleName" class="ms-2">· {{ profileUser.roleName }}</span>
        </p>
      </div>

      <!-- Diffstat line -->
      <Diffstat v-if="diffstatItems.length > 0" :items="diffstatItems" class="mb-6" />

      <!-- Projects table -->
      <div v-if="projects.length > 0">
        <h2 class="text-[16px] font-semibold leading-6 mb-3">{{ t('overview.projects') }}</h2>

        <div class="rounded-md border border-border overflow-hidden">
          <!-- Table header (§3 grammar) -->
          <div class="h-10 bg-gutter text-[13px] font-medium text-muted-foreground flex items-center border-b border-border-muted">
            <div class="w-10 text-end font-mono text-[12px] text-faint-foreground px-3" />
            <div class="flex-1 min-w-0 px-3">{{ t('overview.name') }}</div>
            <div class="w-40 px-3">{{ t('overview.environments') }}</div>
            <!-- Dynamic status columns from catalog (fixed width) -->
            <div
              v-for="status in statusItems"
              :key="`header-${status.value}`"
              class="w-24 text-end px-3 text-[13px] font-medium"
              :class="toneHeaderClass(statusTone(status.value))"
            >
              {{ statusLabel(status.value) }}
            </div>
          </div>

          <!-- Table body -->
          <div>
            <template v-for="(proj, idx) in projects" :key="proj.projectId">
              <!-- Project row -->
              <button
                type="button"
                class="w-full h-11 border-t border-border-muted hover:bg-gutter/60 transition-colors flex items-center text-start"
                @click="toggleExpand(proj.projectId ?? 0)"
              >
                <!-- Gutter column (row number) -->
                <div class="w-10 text-end font-mono text-[12px] text-faint-foreground px-3">
                  {{ idx + 1 }}
                </div>

                <!-- Name + key chip (min-w-[260px] to prevent overlap at 1440) -->
                <div class="flex-1 min-w-0 px-3 flex items-center gap-2">
                  <component
                    :is="expanded.has(proj.projectId ?? 0) ? ChevronDown : ChevronRight"
                    class="h-4 w-4 flex-shrink-0 text-muted-foreground"
                  />
                  <span class="text-[14px] font-medium">{{ proj.name }}</span>
                  <code class="rounded bg-gutter px-1.5 py-0.5 text-[13px] font-mono text-faint-foreground">
                    {{ proj.key }}
                  </code>
                </div>

                <!-- Environments column (w-40 fixed width) -->
                <div class="w-40 px-3 text-[14px] text-muted-foreground">
                  {{ getEnvironmentNames(proj) || '—' }}
                </div>

                <!-- Count cells per status (w-24 fixed width, text-end) -->
                <template v-for="status in statusItems" :key="`cell-${status.value}`">
                  <div class="w-24 text-end px-3">
                    <CountCell
                      :count="statusBuckets(proj).find(b => b.value === status.value)?.count ?? 0"
                      :severity="status.value === STATUS_OPEN ? 'open' : status.value === STATUS_READY ? 'ready' : status.value === STATUS_APPLIED ? 'completed' : 'archived'"
                      :show-glyph="true"
                    />
                  </div>
                </template>
              </button>

              <!-- Expandable environment rows -->
              <template v-if="expanded.has(proj.projectId ?? 0) && (proj.environments?.length ?? 0) > 0">
                <div
                  v-for="env in proj.environments"
                  :key="`env-${proj.projectId}-${env.environment}`"
                  class="h-11 border-t border-border-muted bg-gutter/30 flex items-center text-[14px]"
                >
                  <!-- Gutter -->
                  <div class="w-10 px-3" />

                  <!-- Environment name (indented, min-w-[260px]) -->
                  <div class="flex-1 min-w-0 px-3 flex items-center gap-2">
                    <span class="text-muted-foreground">↳</span>
                    <span class="text-muted-foreground italic">{{ envName(env.environment ?? 0) }}</span>
                  </div>

                  <!-- Empty environments column (w-40) -->
                  <div class="w-40 px-3" />

                  <!-- Count cells for environment (w-24 fixed width) -->
                  <template v-for="status in statusItems" :key="`env-${status.value}`">
                    <div class="w-24 text-end px-3">
                      <CountCell
                        :count="statusBuckets(env).find(b => b.value === status.value)?.count ?? 0"
                        :severity="status.value === STATUS_OPEN ? 'open' : status.value === STATUS_READY ? 'ready' : status.value === STATUS_APPLIED ? 'completed' : 'archived'"
                        :show-glyph="true"
                      />
                    </div>
                  </template>
                </div>
              </template>
            </template>
          </div>
        </div>
      </div>

      <!-- Empty state (three ghost rows with dashed borders per §3) -->
      <div v-else class="rounded-md border border-border overflow-hidden">
        <!-- Table header -->
        <div class="h-10 bg-gutter text-[13px] font-medium text-muted-foreground flex items-center border-b border-border-muted">
          <div class="w-10 text-end font-mono text-[12px] text-faint-foreground px-3" />
          <div class="flex-1 min-w-0 px-3">{{ t('overview.name') }}</div>
          <div class="w-40 px-3">{{ t('overview.environments') }}</div>
          <!-- Dynamic status columns from catalog -->
          <div
            v-for="status in statusItems"
            :key="`header-${status.value}`"
            class="w-24 text-end px-3 text-[13px] font-medium"
            :class="toneTextClass(statusTone(status.value))"
          >
            {{ statusLabel(status.value) }}
          </div>
        </div>

        <!-- Empty ghost rows (three dashed rows per §3) -->
        <div>
          <div v-for="i in 3" :key="`ghost-${i}`" class="h-11 border-t border-border-muted border-dashed flex">
            <template v-if="i === 1">
              <div class="w-10 px-3" />
              <div class="flex-1 min-w-0 px-3 text-[14px] text-muted-foreground">{{ t('profile.noProjects') }}</div>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
