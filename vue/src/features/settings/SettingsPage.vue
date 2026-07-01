<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueryClient } from '@tanstack/vue-query';
import {
  useGetApiAdminSettings,
  usePutApiAdminSettings,
  getGetApiAdminSettingsQueryKey,
  useGetApiAdminPredefinedActions,
  usePostApiAdminPredefinedActions,
  usePatchApiAdminPredefinedActionsId,
  useDeleteApiAdminPredefinedActionsId,
  getGetApiAdminPredefinedActionsQueryKey,
  useGetApiAdminRoles,
  useGetApiAdminInvites,
  usePostApiAdminInvites,
  useDeleteApiAdminInvitesId,
  getGetApiAdminInvitesQueryKey,
  type SettingsResponse,
  type PredefinedActionResponse,
  type RoleResponse,
  type InviteResponse,
} from '@moamen-ui/pointer-vue';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Copy, Link2Off } from 'lucide-vue-next';
import { extractMessage } from '@/lib/error';
import { toast } from '@/composables/useToast';

const { t } = useI18n();
const queryClient = useQueryClient();

const { data, isError } = useGetApiAdminSettings();
// The interceptor unwraps the envelope at runtime; data.value IS SettingsResponse.
// Bridge the TS type mismatch with a cast (mirrors the React dashboard pattern).
const settings = computed(() => data.value as unknown as SettingsResponse | undefined);

const updateSettings = usePutApiAdminSettings();

// Local reactive form state seeded from server data.
const signupEnabled = ref(false);
const emailEnabled = ref(false);
const emailFromEmail = ref('');
const emailFromName = ref('');
const emailDailyCap = ref<number>(300);
const demoMaxActive = ref<number>(10);
const demoTtlHours = ref<number>(48);
const demoPerEmailPerDay = ref<number>(3);
const demoCommentCap = ref<number>(20);

watch(
  settings,
  (s) => {
    if (!s) return;
    signupEnabled.value = (s as any).scopedAdminSignupEnabled ?? false;
    emailEnabled.value = (s as any).emailEnabled ?? false;
    emailFromEmail.value = (s as any).emailFromEmail ?? '';
    emailFromName.value = (s as any).emailFromName ?? '';
    emailDailyCap.value = (s as any).emailDailyCap ?? 300;
    demoMaxActive.value = (s as any).demoMaxActive ?? 10;
    demoTtlHours.value = (s as any).demoTtlHours ?? 48;
    demoPerEmailPerDay.value = (s as any).demoPerEmailPerDay ?? 3;
    demoCommentCap.value = (s as any).demoCommentCap ?? 20;
  },
  { immediate: true },
);

async function saveSettings() {
  try {
    await updateSettings.mutateAsync({
      data: {
        scopedAdminSignupEnabled: signupEnabled.value,
        emailEnabled: emailEnabled.value,
        emailFromEmail: emailFromEmail.value,
        emailFromName: emailFromName.value,
        emailDailyCap: emailDailyCap.value,
        demoMaxActive: demoMaxActive.value,
        demoTtlHours: demoTtlHours.value,
        demoPerEmailPerDay: demoPerEmailPerDay.value,
        demoCommentCap: demoCommentCap.value,
      } as any,
    });
    toast(t('settings.saved'));
    void queryClient.invalidateQueries({ queryKey: getGetApiAdminSettingsQueryKey() });
  } catch (e) {
    toast(extractMessage(e));
  }
}

// ── Predefined actions (tenant-wide) ──────────────────────────────────
const predefinedActionsQuery = useGetApiAdminPredefinedActions();
const tenantActions = computed<PredefinedActionResponse[]>(
  () => (predefinedActionsQuery.data.value ?? []).filter((a: PredefinedActionResponse) => a.projectId == null),
);

interface EditableAction {
  id?: number;
  text: string;
  prompt: string;
  isNew?: boolean;
}
const editableActions = ref<EditableAction[]>([]);

watch(
  tenantActions,
  (actions) => {
    editableActions.value = actions.map((a) => ({
      id: a.id,
      text: a.text ?? '',
      prompt: a.prompt ?? '',
    }));
  },
  { immediate: true },
);

const createPredefined = usePostApiAdminPredefinedActions();
const updatePredefined = usePatchApiAdminPredefinedActionsId();
const deletePredefined = useDeleteApiAdminPredefinedActionsId();

function reloadPredefined() {
  void queryClient.invalidateQueries({ queryKey: getGetApiAdminPredefinedActionsQueryKey() });
}

function addTenantAction() {
  editableActions.value.push({ text: '', prompt: '', isNew: true });
}

async function saveTenantAction(action: EditableAction, index: number) {
  try {
    if (action.isNew || action.id == null) {
      await createPredefined.mutateAsync({
        data: {
          text: action.text,
          prompt: action.prompt,
          isActive: true,
          sortOrder: index,
        },
      });
    } else {
      await updatePredefined.mutateAsync({
        id: action.id,
        data: {
          text: action.text,
          prompt: action.prompt,
        },
      });
    }
    reloadPredefined();
  } catch (e) {
    toast(extractMessage(e));
  }
}

async function deleteTenantAction(action: EditableAction, index: number) {
  if (action.isNew || action.id == null) {
    editableActions.value.splice(index, 1);
    return;
  }
  try {
    await deletePredefined.mutateAsync({ id: action.id });
    reloadPredefined();
  } catch (e) {
    toast(extractMessage(e));
  }
}

// ── Invite teammates ──────────────────────────────────────────────────
const rolesQuery = useGetApiAdminRoles();
const nonAdminRoles = computed<RoleResponse[]>(
  () => ((rolesQuery.data.value ?? []) as RoleResponse[]).filter((r) => !r.grantsAdmin),
);

const invitesQuery = useGetApiAdminInvites();
const inviteList = computed<InviteResponse[]>(
  () => (invitesQuery.data.value ?? []) as InviteResponse[],
);

const inviteRoleId = ref<number | null>(null);
const inviteEmail = ref('');
const inviteExpiresDays = ref<number | undefined>(7);
const inviteMaxUses = ref<number | undefined>(undefined);
const createdUrl = ref<string | null>(null);

const createInvite = usePostApiAdminInvites();
const revokeInvite = useDeleteApiAdminInvitesId();

function reloadInvites() {
  void queryClient.invalidateQueries({ queryKey: getGetApiAdminInvitesQueryKey() });
}

async function onCreateInvite() {
  if (!inviteRoleId.value) return;
  try {
    const res = await createInvite.mutateAsync({
      data: {
        roleId: inviteRoleId.value ?? undefined,
        email: inviteEmail.value || undefined,
        expiresInDays: inviteExpiresDays.value ?? undefined,
        maxUses: inviteMaxUses.value ?? undefined,
      },
    }) as unknown as InviteResponse;
    createdUrl.value = res.url ?? null;
    toast(t('invite.created'));
    reloadInvites();
  } catch (e) {
    toast(extractMessage(e));
  }
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast(t('invite.copied'));
  } catch {
    toast(url);
  }
}

async function onRevoke(id: number) {
  try {
    await revokeInvite.mutateAsync({ id });
    toast(t('invite.revoked'));
    reloadInvites();
  } catch (e) {
    toast(extractMessage(e));
  }
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h2 class="text-lg font-semibold">{{ t('settings.title') }}</h2>

    <p v-if="isError" class="text-sm text-destructive">{{ t('settings.loadError') }}</p>

    <template v-if="settings || !isError">
      <!-- Section: Access -->
      <Card>
        <CardContent class="flex flex-col gap-6 p-6">
          <h3 class="text-sm font-semibold">{{ t('settings.accessSection') }}</h3>
          <!-- Signup toggle -->
          <div class="flex items-center justify-between gap-4">
            <div class="flex flex-col gap-1">
              <Label class="text-sm font-medium">{{ t('settings.signupEnabled') }}</Label>
              <p class="text-xs text-muted-foreground">{{ t('settings.signupEnabledDesc') }}</p>
            </div>
            <Switch
              :model-value="signupEnabled"
              :disabled="updateSettings.isPending.value"
              @update:model-value="(v: boolean) => { signupEnabled = v; }"
            />
          </div>
        </CardContent>
      </Card>

      <!-- Section: Email -->
      <Card>
        <CardContent class="flex flex-col gap-6 p-6">
          <h3 class="text-sm font-semibold">{{ t('settings.emailSection') }}</h3>

          <!-- emailEnabled -->
          <div class="flex items-center justify-between gap-4">
            <div class="flex flex-col gap-1">
              <Label class="text-sm font-medium">{{ t('settings.emailEnabled') }}</Label>
              <p class="text-xs text-muted-foreground">{{ t('settings.emailEnabledHint') }}</p>
            </div>
            <Switch
              :model-value="emailEnabled"
              :disabled="updateSettings.isPending.value"
              @update:model-value="(v: boolean) => { emailEnabled = v; }"
            />
          </div>

          <!-- emailFromEmail -->
          <div class="flex flex-col gap-2">
            <Label for="email-from" class="text-sm font-medium">{{ t('settings.emailFrom') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.emailFromHint') }}</p>
            <Input id="email-from" v-model="emailFromEmail" type="email" />
          </div>

          <!-- emailFromName -->
          <div class="flex flex-col gap-2">
            <Label for="email-from-name" class="text-sm font-medium">{{ t('settings.emailFromName') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.emailFromNameHint') }}</p>
            <Input id="email-from-name" v-model="emailFromName" />
          </div>

          <!-- emailDailyCap -->
          <div class="flex flex-col gap-2">
            <Label for="email-daily-cap" class="text-sm font-medium">{{ t('settings.emailDailyCap') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.emailDailyCapHint') }}</p>
            <Input id="email-daily-cap" v-model.number="emailDailyCap" type="number" :min="1" />
          </div>

          <!-- API key status (read-only) -->
          <div class="flex flex-col gap-1">
            <Label class="text-sm font-medium">{{ t('settings.emailApiKey') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.emailApiKeyHint') }}</p>
            <p class="text-sm mt-1">
              <span v-if="(settings as any)?.emailApiKeyConfigured" class="text-green-600 font-medium">
                ✓ {{ t('settings.emailApiKeyConfigured') }}
              </span>
              <span v-else class="text-destructive font-medium">
                ✗ {{ t('settings.emailApiKeyMissing') }}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- Section: Demo -->
      <Card>
        <CardContent class="flex flex-col gap-6 p-6">
          <h3 class="text-sm font-semibold">{{ t('settings.demoSection') }}</h3>

          <!-- demoMaxActive -->
          <div class="flex flex-col gap-2">
            <Label for="demo-max-active" class="text-sm font-medium">{{ t('settings.demoMaxActive') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.demoMaxActiveHint') }}</p>
            <Input id="demo-max-active" v-model.number="demoMaxActive" type="number" :min="1" />
          </div>

          <!-- demoTtlHours -->
          <div class="flex flex-col gap-2">
            <Label for="demo-ttl-hours" class="text-sm font-medium">{{ t('settings.demoTtlHours') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.demoTtlHoursHint') }}</p>
            <Input id="demo-ttl-hours" v-model.number="demoTtlHours" type="number" :min="1" />
          </div>

          <!-- demoPerEmailPerDay -->
          <div class="flex flex-col gap-2">
            <Label for="demo-per-email" class="text-sm font-medium">{{ t('settings.demoPerEmailPerDay') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.demoPerEmailPerDayHint') }}</p>
            <Input id="demo-per-email" v-model.number="demoPerEmailPerDay" type="number" :min="1" />
          </div>

          <!-- demoCommentCap -->
          <div class="flex flex-col gap-2">
            <Label for="demo-comment-cap" class="text-sm font-medium">{{ t('settings.demoCommentCap') }}</Label>
            <p class="text-xs text-muted-foreground">{{ t('settings.demoCommentCapHint') }}</p>
            <Input id="demo-comment-cap" v-model.number="demoCommentCap" type="number" :min="1" />
          </div>
        </CardContent>
      </Card>

      <!-- Section: Predefined actions -->
      <Card>
        <CardContent class="flex flex-col gap-4 p-6">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">{{ t('predefined.section') }}</h3>
            <Button type="button" variant="outline" size="sm" @click="addTenantAction">
              <PlusCircle class="h-4 w-4" /> {{ t('predefined.add') }}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">{{ t('predefined.tenantHelp') }}</p>
          <p v-if="editableActions.length === 0" class="text-sm text-muted-foreground italic">
            {{ t('predefined.empty') }}
          </p>
          <div
            v-for="(action, idx) in editableActions"
            :key="idx"
            class="flex flex-col gap-2 rounded-md border p-3"
          >
            <div class="flex flex-col gap-1">
              <Label :for="'pa-text-' + idx">{{ t('predefined.text') }}</Label>
              <Input :id="'pa-text-' + idx" v-model="action.text" />
            </div>
            <div class="flex flex-col gap-1">
              <Label :for="'pa-prompt-' + idx">{{ t('predefined.prompt') }}</Label>
              <textarea
                :id="'pa-prompt-' + idx"
                v-model="action.prompt"
                rows="2"
                class="flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm resize-none"
              />
            </div>
            <div class="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                @click="deleteTenantAction(action, idx)"
              >
                <Trash2 class="h-4 w-4 text-destructive" />
                {{ t('common.delete') }}
              </Button>
              <Button
                type="button"
                size="sm"
                @click="saveTenantAction(action, idx)"
              >
                {{ t('common.save') }}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Section: Invite teammates -->
      <Card>
        <CardContent class="flex flex-col gap-4 p-6">
          <div class="flex flex-col gap-1">
            <h3 class="text-sm font-semibold">{{ t('invite.section') }}</h3>
            <p class="text-xs text-muted-foreground">{{ t('invite.sectionHint') }}</p>
          </div>

          <!-- Create form -->
          <div class="flex flex-col gap-3 rounded-md border p-4">
            <!-- Role select -->
            <div class="flex flex-col gap-1">
              <Label for="invite-role">{{ t('invite.role') }}</Label>
              <select
                id="invite-role"
                v-model="inviteRoleId"
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option :value="null" disabled>— {{ t('invite.role') }} —</option>
                <option v-for="r in nonAdminRoles" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
            </div>

            <!-- Optional email -->
            <div class="flex flex-col gap-1">
              <Label for="invite-email">{{ t('invite.email') }}</Label>
              <Input id="invite-email" v-model="inviteEmail" type="email" />
            </div>

            <!-- Expires in days -->
            <div class="flex flex-col gap-1">
              <Label for="invite-expires">{{ t('invite.expiresDays') }}</Label>
              <Input id="invite-expires" v-model.number="inviteExpiresDays" type="number" :min="1" />
            </div>

            <!-- Max uses -->
            <div class="flex flex-col gap-1">
              <Label for="invite-maxuses">{{ t('invite.maxUses') }}</Label>
              <Input id="invite-maxuses" v-model.number="inviteMaxUses" type="number" :min="1" />
            </div>

            <Button
              type="button"
              :disabled="!inviteRoleId || createInvite.isPending.value"
              @click="onCreateInvite"
            >
              {{ t('invite.create') }}
            </Button>
          </div>

          <!-- Newly created URL -->
          <div v-if="createdUrl" class="flex items-center gap-2 rounded-md bg-muted p-3">
            <span class="flex-1 truncate text-sm font-mono">{{ createdUrl }}</span>
            <Button type="button" size="sm" variant="outline" @click="copyUrl(createdUrl!)">
              <Copy class="h-4 w-4 mr-1" />{{ t('invite.copy') }}
            </Button>
          </div>

          <!-- Active invites list -->
          <div v-if="invitesQuery.isError.value" class="text-sm text-destructive">
            {{ t('settings.loadError') }}
          </div>
          <p v-else-if="inviteList.length === 0" class="text-sm text-muted-foreground italic">
            {{ t('invite.empty') }}
          </p>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b text-left text-xs text-muted-foreground">
                  <th class="py-2 pr-4 font-medium">{{ t('invite.role') }}</th>
                  <th class="py-2 pr-4 font-medium">{{ t('login.email') }}</th>
                  <th class="py-2 pr-4 font-medium">{{ t('invite.expires') }}</th>
                  <th class="py-2 pr-4 font-medium">{{ t('invite.uses') }}</th>
                  <th class="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="inv in inviteList" :key="inv.id" class="border-b last:border-0">
                  <td class="py-2 pr-4">{{ inv.roleName ?? '—' }}</td>
                  <td class="py-2 pr-4">{{ inv.email ?? t('invite.anyone') }}</td>
                  <td class="py-2 pr-4">{{ formatDate(inv.expiresAt) }}</td>
                  <td class="py-2 pr-4">{{ inv.uses ?? 0 }} / {{ inv.maxUses ?? '∞' }}</td>
                  <td class="py-2">
                    <div class="flex items-center gap-1">
                      <Button
                        v-if="inv.url"
                        type="button"
                        size="sm"
                        variant="ghost"
                        @click="copyUrl(inv.url!)"
                      >
                        <Copy class="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        @click="onRevoke(inv.id!)"
                      >
                        <Link2Off class="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <!-- Save button -->
      <div class="flex justify-end">
        <Button :disabled="updateSettings.isPending.value" @click="saveSettings">
          {{ t('settings.save') }}
        </Button>
      </div>
    </template>
  </div>
</template>
