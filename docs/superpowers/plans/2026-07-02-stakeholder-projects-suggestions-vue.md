# Stakeholder Projects + Prompt Suggestions UI (Vue) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow non-admin stakeholders to access the Projects page, add per-row canEdit/canDelete/suggest UX, expose commentsCount+createdByName, add a "Suggest prompt" dialog, and add an admin Suggestions review section on SettingsPage.

**Architecture:** The router guard for the `projects` route is relaxed to `requiresAuth` (authenticated only, not admin). The Shell nav adds Projects for all authenticated users. ProjectsPage.vue is enhanced with conditional buttons per row (edit/delete/suggest/view), two new dialogs (delete confirm + suggest prompt), and two extra columns (comments count + created by). SettingsPage.vue gains a new Card section at the bottom (admin-only) that lists pending prompt suggestions with Approve/Reject. i18n keys added to en.json and ar.json.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), vue-query (@tanstack/vue-query), vue-i18n (`useI18n` / `t()`), `@moamen-ui/pointer-vue` 1.0.15 hooks, shadcn-vue components (Button, Dialog, Input, Label, Card, Table), lucide-vue-next icons, native `title=` for tooltips.

## Global Constraints

- Repo: `/Users/momen/Desktop/REPOS/pointer-dashboard`, branch `feat/email-ui`
- Touch only `vue/` directory and `vue/public/assets/i18n/{en,ar}.json`
- `@moamen-ui/pointer-vue` is exactly `1.0.15` — do NOT downgrade or reinstall
- No commit; `npm run build` (vue-tsc + vite) MUST pass clean
- Add `/opt/homebrew/opt/node@26/bin` to PATH for all commands
- Vue template gotcha: refs auto-unwrap in templates — write `x = v` not `x.value = v` in inline handlers
- Never write a literal `</script>` inside a `<script setup>` comment or string

---

## File Map

| File | Change |
|---|---|
| `vue/src/router/index.ts` | Remove `requiresAdmin` from `projects` route |
| `vue/src/features/shell/Shell.vue` | Move Projects link to all-authenticated nav group |
| `vue/src/features/projects/ProjectsPage.vue` | Major: delete + suggest dialogs, new columns, conditional buttons |
| `vue/src/features/settings/SettingsPage.vue` | Add Suggestions review Card at bottom (admin-only) |
| `vue/public/assets/i18n/en.json` | Merge `projects.*` + `suggestions.*` keys |
| `vue/public/assets/i18n/ar.json` | Merge `projects.*` + `suggestions.*` keys (Arabic) |

---

## Task 1: Relax the Projects router guard + show Projects link in nav for all authenticated users

**Files:**
- Modify: `vue/src/router/index.ts:49`
- Modify: `vue/src/features/shell/Shell.vue:28-33`

**Interfaces:**
- Produces: Projects route accessible to any `isAuthenticated` user (not just `isAdmin`)

- [ ] **Step 1: Open the router**

  Read `vue/src/router/index.ts`. Line 49 currently reads:
  ```ts
  { path: 'projects', name: 'projects', component: ProjectsPage, meta: { requiresAdmin: true } },
  ```
  Change it to:
  ```ts
  { path: 'projects', name: 'projects', component: ProjectsPage },
  ```
  (No meta at all — `requiresAuth` is inherited from the shell parent.)

- [ ] **Step 2: Move Projects link to all-authenticated nav in Shell.vue**

  In `vue/src/features/shell/Shell.vue`, the `ADMIN_NAV` array currently includes `{ to: '/projects', key: 'nav.projects', icon: Folder }`.
  Remove it from `ADMIN_NAV`. Add a new constant `ALL_NAV` between `ADMIN_NAV` and `SUPER_ADMIN_NAV`:
  ```ts
  const ALL_NAV = [
    { to: '/projects', key: 'nav.projects', icon: Folder },
  ];
  ```

  In the `<template>` in `Shell.vue`, add a new `<template>` block for `ALL_NAV` that renders for ALL authenticated users (no `v-if` guard) — place it just above the `<!-- Always visible: My profile -->` RouterLink:
  ```html
  <!-- Available to all authenticated users -->
  <RouterLink
    v-for="item in ALL_NAV"
    :key="item.to"
    :to="item.to"
    class="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/5"
    active-class="bg-brand-tint font-semibold !text-brand"
    @click="sidebarOpen = false"
  >
    <component :is="item.icon" class="h-5 w-5" />
    <span>{{ t(item.key) }}</span>
  </RouterLink>
  ```

- [ ] **Step 3: Verify build passes syntax-check**

  ```bash
  export PATH="/opt/homebrew/opt/node@26/bin:$PATH"
  cd /Users/momen/Desktop/REPOS/pointer-dashboard/vue
  node --check src/router/index.ts 2>&1 || true
  npx vue-tsc --noEmit 2>&1 | head -30
  ```

---

## Task 2: Merge i18n keys (en.json + ar.json)

**Files:**
- Modify: `vue/public/assets/i18n/en.json`
- Modify: `vue/public/assets/i18n/ar.json`

**Interfaces:**
- Produces: `t('projects.delete')`, `t('projects.deleted')`, `t('projects.deleteConfirm')`, `t('projects.deleteBlockedComments')`, `t('projects.comments')`, `t('projects.createdBy')`, `t('projects.viewPrompts')`, `t('projects.suggest')`, `t('suggestions.section')`, `t('suggestions.sent')`, `t('suggestions.canEditDirectly')`, `t('suggestions.approve')`, `t('suggestions.reject')`, `t('suggestions.approved')`, `t('suggestions.rejected')`, `t('suggestions.empty')`, `t('suggestions.by')`, `t('suggestions.project')`, `t('suggestions.pending', { count: n })`

- [ ] **Step 1: Add keys to en.json**

  In `vue/public/assets/i18n/en.json`, merge into the existing `"projects"` object (keep all existing keys, add the new ones):
  ```json
  "projects": {
    "title": "Projects",
    "addProject": "Add Project",
    "key": "Key",
    "name": "Name",
    "status": "Status",
    "actions": "Actions",
    "edit": "Edit",
    "editTitle": "Edit project",
    "saved": "Project updated.",
    "delete": "Delete",
    "deleted": "Project deleted",
    "deleteConfirm": "Delete this project? This cannot be undone.",
    "deleteBlockedComments": "This project has comments — only an admin can delete it.",
    "comments": "Comments",
    "createdBy": "Created by",
    "viewPrompts": "Predefined prompts",
    "suggest": "Suggest prompt"
  },
  ```
  And add a new top-level `"suggestions"` object (after `"invite"`, before the closing `}`):
  ```json
  "suggestions": {
    "section": "Prompt suggestions",
    "sent": "Suggestion sent for admin review",
    "canEditDirectly": "You can add this prompt directly.",
    "approve": "Approve",
    "reject": "Reject",
    "approved": "Suggestion approved",
    "rejected": "Suggestion rejected",
    "empty": "No pending suggestions.",
    "by": "Suggested by",
    "project": "Project",
    "pending": "{{count}} pending"
  }
  ```

- [ ] **Step 2: Add keys to ar.json**

  In `vue/public/assets/i18n/ar.json`, merge into the existing `"projects"` object:
  ```json
  "projects": {
    "title": "المشاريع",
    "addProject": "إضافة مشروع",
    "key": "المفتاح",
    "name": "الاسم",
    "status": "الحالة",
    "actions": "الإجراءات",
    "edit": "تعديل",
    "editTitle": "تعديل المشروع",
    "saved": "تم تحديث المشروع.",
    "delete": "حذف",
    "deleted": "تم حذف المشروع",
    "deleteConfirm": "حذف هذا المشروع؟ لا يمكن التراجع.",
    "deleteBlockedComments": "هذا المشروع يحتوي على تعليقات — يمكن للمشرف فقط حذفه.",
    "comments": "التعليقات",
    "createdBy": "أنشأه",
    "viewPrompts": "الموجّهات المعرّفة",
    "suggest": "اقترح موجّهًا"
  },
  ```
  And add a new top-level `"suggestions"` object (after `"invite"`, before the closing `}`):
  ```json
  "suggestions": {
    "section": "اقتراحات الموجّهات",
    "sent": "أُرسل الاقتراح لمراجعة المشرف",
    "canEditDirectly": "يمكنك إضافة هذا الموجّه مباشرة.",
    "approve": "اعتماد",
    "reject": "رفض",
    "approved": "تم اعتماد الاقتراح",
    "rejected": "تم رفض الاقتراح",
    "empty": "لا توجد اقتراحات معلّقة.",
    "by": "اقترحه",
    "project": "المشروع",
    "pending": "{{count}} معلّق"
  }
  ```

- [ ] **Step 3: Verify JSON is valid**

  ```bash
  export PATH="/opt/homebrew/opt/node@26/bin:$PATH"
  node -e "JSON.parse(require('fs').readFileSync('/Users/momen/Desktop/REPOS/pointer-dashboard/vue/public/assets/i18n/en.json','utf8'))" && echo "en OK"
  node -e "JSON.parse(require('fs').readFileSync('/Users/momen/Desktop/REPOS/pointer-dashboard/vue/public/assets/i18n/ar.json','utf8'))" && echo "ar OK"
  ```

---

## Task 3: ProjectsPage.vue — add Delete + Suggest functionality + new columns

**Files:**
- Modify: `vue/src/features/projects/ProjectsPage.vue`

**Interfaces:**
- Consumes from Task 2: `t('projects.delete')`, `t('projects.deleted')`, `t('projects.deleteConfirm')`, `t('projects.deleteBlockedComments')`, `t('projects.comments')`, `t('projects.createdBy')`, `t('projects.viewPrompts')`, `t('projects.suggest')`, `t('suggestions.sent')`, `t('suggestions.canEditDirectly')`
- Consumes symbols: `useDeleteApiAdminProjectsId` (path param `{ id }`), `usePostApiProjectsIdPredefinedActionSuggestions` (path param `{ id }`, body `CreateSuggestionRequest { text, prompt }`), `useGetApiAdminProjects`, `getGetApiAdminProjectsQueryKey`, `ProjectResponse`, `CreateSuggestionRequest`, `PredefinedActionResponse`
- Produces: Updated ProjectsPage.vue with delete/suggest/view-prompts UX

### Step-by-step

- [ ] **Step 1: Add new imports to `<script setup>`**

  In `ProjectsPage.vue`, extend the existing `@moamen-ui/pointer-vue` import block to add:
  ```ts
  import {
    useGetApiAdminProjects,
    usePostApiAdminProjects,
    usePatchApiAdminProjectsId,
    getGetApiAdminProjectsQueryKey,
    getApiProjectsKeyExport,
    usePostApiProjectsKeyImport,
    useDeleteApiAdminProjectsId,
    usePostApiProjectsIdPredefinedActionSuggestions,
    type ProjectResponse,
    type ImportResultDto,
    type ExportFileDto,
    type PredefinedActionResponse,
    type CreateSuggestionRequest,
  } from '@moamen-ui/pointer-vue';
  ```
  (Replace the existing import block with the above.)

- [ ] **Step 2: Add Delete mutation + handler logic**

  After the existing `patchProject = usePatchApiAdminProjectsId()` line in `<script setup>`, add:
  ```ts
  // ── Delete project ────────────────────────────────────────────────────
  const deleteProject = useDeleteApiAdminProjectsId();

  async function confirmDelete(project: ProjectResponse) {
    const ok = await confirm({
      message: t('projects.deleteConfirm'),
      confirmLabel: t('projects.delete'),
      confirmVariant: 'destructive',
    });
    if (!ok) return;
    busy.value = true;
    try {
      await deleteProject.mutateAsync({ id: project.id! });
      busy.value = false;
      toast(t('projects.deleted'));
      reload();
    } catch (e) {
      fail(e);
    }
  }
  ```

- [ ] **Step 3: Add Suggest mutation + dialog state + handler**

  After the `confirmDelete` function, add:
  ```ts
  // ── Suggest prompt ────────────────────────────────────────────────────
  const suggestMutation = usePostApiProjectsIdPredefinedActionSuggestions();
  const suggestOpen = ref(false);
  const suggestTargetProject = ref<ProjectResponse | null>(null);
  const suggestForm = reactive<CreateSuggestionRequest>({ text: '', prompt: '' });

  function openSuggest(project: ProjectResponse) {
    suggestTargetProject.value = project;
    suggestForm.text = '';
    suggestForm.prompt = '';
    suggestOpen.value = true;
  }

  async function submitSuggest() {
    if (!suggestTargetProject.value) return;
    busy.value = true;
    try {
      await suggestMutation.mutateAsync({
        id: suggestTargetProject.value.id!,
        data: { text: suggestForm.text, prompt: suggestForm.prompt },
      });
      busy.value = false;
      suggestOpen.value = false;
      toast(t('suggestions.sent'));
    } catch (e) {
      busy.value = false;
      // Check for 403 — user can actually edit directly
      const status = (e as any)?.response?.status;
      if (status === 403) {
        toast(t('suggestions.canEditDirectly'));
      } else {
        toast(extractMessage(e));
      }
    }
  }
  ```

- [ ] **Step 4: Add View-Prompts (read-only dialog) state**

  After `submitSuggest`, add:
  ```ts
  // ── View prompts (read-only) ──────────────────────────────────────────
  const viewPromptsOpen = ref(false);
  const viewPromptsProject = ref<ProjectResponse | null>(null);

  function openViewPrompts(project: ProjectResponse) {
    viewPromptsProject.value = project;
    viewPromptsOpen.value = true;
  }
  ```

- [ ] **Step 5: Update the table header row to add Comments + Created by columns**

  In the `<template>`, find the `<TableHeader>` block and replace:
  ```html
  <TableHeader>
    <TableRow>
      <TableHead>{{ t('projects.key') }}</TableHead>
      <TableHead>{{ t('projects.name') }}</TableHead>
      <TableHead>{{ t('projects.status') }}</TableHead>
      <TableHead>{{ t('projects.actions') }}</TableHead>
    </TableRow>
  </TableHeader>
  ```
  with:
  ```html
  <TableHeader>
    <TableRow>
      <TableHead>{{ t('projects.key') }}</TableHead>
      <TableHead>{{ t('projects.name') }}</TableHead>
      <TableHead>{{ t('projects.createdBy') }}</TableHead>
      <TableHead>{{ t('projects.comments') }}</TableHead>
      <TableHead>{{ t('projects.status') }}</TableHead>
      <TableHead>{{ t('projects.actions') }}</TableHead>
    </TableRow>
  </TableHeader>
  ```

- [ ] **Step 6: Update the per-row cells to add Comments + Created by + conditional action buttons**

  Find the `<TableRow v-for="project in projects"` block in the template. Replace the entire row (from `<TableRow v-for...` through its closing `</TableRow>`) with:
  ```html
  <TableRow v-for="project in projects" :key="project.id">
    <TableCell>
      <code class="rounded bg-muted px-1.5 py-0.5 text-xs">{{ project.key }}</code>
    </TableCell>
    <TableCell>{{ project.name }}</TableCell>
    <TableCell class="text-sm text-muted-foreground">{{ project.createdByName ?? '—' }}</TableCell>
    <TableCell class="text-sm text-muted-foreground">{{ project.commentsCount ?? 0 }}</TableCell>
    <TableCell>
      <span :class="cn('chip', project.isActive ? 'chip-active' : 'chip-disabled')">
        {{ t(project.isActive ? 'common.active' : 'common.disabled') }}
      </span>
    </TableCell>
    <TableCell class="flex flex-wrap items-center gap-2">
      <Button
        :variant="project.isActive ? 'destructive' : 'default'"
        size="sm"
        :disabled="loading"
        @click="toggleActive(project)"
      >
        <component :is="project.isActive ? Ban : CheckCircle2" class="h-4 w-4" />
        {{ project.isActive ? t('common.disable') : t('common.enable') }}
      </Button>
      <!-- Edit: only when canEdit -->
      <Button
        v-if="project.canEdit"
        variant="outline"
        size="sm"
        :disabled="loading"
        @click="openEdit(project)"
      >
        <Pencil class="h-4 w-4" /> {{ t('projects.edit') }}
      </Button>
      <!-- View prompts (read-only): when !canEdit -->
      <Button
        v-if="!project.canEdit"
        variant="outline"
        size="sm"
        :disabled="loading"
        @click="openViewPrompts(project)"
      >
        <Pencil class="h-4 w-4" /> {{ t('projects.viewPrompts') }}
      </Button>
      <!-- Suggest prompt: when !canEdit -->
      <Button
        v-if="!project.canEdit"
        variant="outline"
        size="sm"
        :disabled="loading"
        @click="openSuggest(project)"
      >
        <PlusCircle class="h-4 w-4" /> {{ t('projects.suggest') }}
      </Button>
      <!-- Delete: when canDelete (enabled), or disabled with tooltip when !canDelete -->
      <Button
        v-if="project.canDelete"
        variant="destructive"
        size="sm"
        :disabled="loading"
        @click="confirmDelete(project)"
      >
        <Trash2 class="h-4 w-4" /> {{ t('projects.delete') }}
      </Button>
      <Button
        v-else
        variant="outline"
        size="sm"
        disabled
        :title="t('projects.deleteBlockedComments')"
      >
        <Trash2 class="h-4 w-4" /> {{ t('projects.delete') }}
      </Button>
      <Button variant="outline" size="sm" :disabled="loading" @click="exportProject(project)">
        <Download class="h-4 w-4" /> {{ t('exportImport.export') }}
      </Button>
      <Button v-if="isSuperAdmin" variant="outline" size="sm" :disabled="loading" @click="openImport(project)">
        <Upload class="h-4 w-4" /> {{ t('exportImport.import') }}
      </Button>
    </TableCell>
  </TableRow>
  ```

- [ ] **Step 7: Add the Suggest prompt dialog to the template**

  After the closing `</Dialog>` of the Import dialog, add:
  ```html
  <!-- Suggest prompt dialog -->
  <Dialog v-model:open="suggestOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('projects.suggest') }}</DialogTitle>
      </DialogHeader>
      <form class="flex flex-col gap-3 pt-2" @submit.prevent="submitSuggest">
        <div class="flex flex-col gap-2">
          <Label for="suggest-text">{{ t('predefined.text') }}</Label>
          <Input id="suggest-text" v-model="suggestForm.text" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="suggest-prompt">{{ t('predefined.prompt') }}</Label>
          <textarea
            id="suggest-prompt"
            v-model="suggestForm.prompt"
            rows="3"
            class="flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm resize-none"
          />
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="suggestOpen = false">{{ t('common.cancel') }}</Button>
        <Button :disabled="!suggestForm.text || loading" @click="submitSuggest">
          {{ t('projects.suggest') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  ```

- [ ] **Step 8: Add the View Prompts (read-only) dialog to the template**

  After the Suggest dialog, add:
  ```html
  <!-- View predefined prompts (read-only) dialog -->
  <Dialog v-model:open="viewPromptsOpen">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ t('projects.viewPrompts') }}</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-3 pt-2">
        <p
          v-if="!viewPromptsProject?.predefinedActions?.length"
          class="text-sm text-muted-foreground italic"
        >
          {{ t('predefined.empty') }}
        </p>
        <div
          v-for="(action, idx) in (viewPromptsProject?.predefinedActions ?? [])"
          :key="action.id ?? idx"
          class="flex flex-col gap-1 rounded-md border p-2"
        >
          <div class="flex flex-col gap-1">
            <Label>{{ t('predefined.text') }}</Label>
            <p class="text-sm">{{ action.text }}</p>
          </div>
          <div class="flex flex-col gap-1">
            <Label>{{ t('predefined.prompt') }}</Label>
            <p class="text-sm text-muted-foreground whitespace-pre-wrap">{{ action.prompt }}</p>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="viewPromptsOpen = false">{{ t('common.cancel') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  ```

- [ ] **Step 9: Run TypeScript check**

  ```bash
  export PATH="/opt/homebrew/opt/node@26/bin:$PATH"
  cd /Users/momen/Desktop/REPOS/pointer-dashboard/vue
  npx vue-tsc --noEmit 2>&1 | head -40
  ```
  Expected: no errors from ProjectsPage.vue.

---

## Task 4: SettingsPage.vue — add Suggestions review section (admin-only)

**Files:**
- Modify: `vue/src/features/settings/SettingsPage.vue`

**Interfaces:**
- Consumes from Task 2: `t('suggestions.section')`, `t('suggestions.approve')`, `t('suggestions.reject')`, `t('suggestions.approved')`, `t('suggestions.rejected')`, `t('suggestions.empty')`, `t('suggestions.by')`, `t('suggestions.project')`, `t('suggestions.pending', { count })`
- Consumes symbols: `useGetApiAdminPredefinedActionSuggestions`, `getGetApiAdminPredefinedActionSuggestionsQueryKey`, `usePostApiAdminPredefinedActionSuggestionsIdApprove`, `usePostApiAdminPredefinedActionSuggestionsIdReject`, `SuggestionResponse`
- Consumes composable: `useAuth` (for `isAdmin`)

- [ ] **Step 1: Add new imports to SettingsPage.vue `<script setup>`**

  In `SettingsPage.vue`, extend the `@moamen-ui/pointer-vue` import block to add:
  ```ts
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
    useGetApiAdminPredefinedActionSuggestions,
    getGetApiAdminPredefinedActionSuggestionsQueryKey,
    usePostApiAdminPredefinedActionSuggestionsIdApprove,
    usePostApiAdminPredefinedActionSuggestionsIdReject,
    type SettingsResponse,
    type PredefinedActionResponse,
    type RoleResponse,
    type InviteResponse,
    type SuggestionResponse,
  } from '@moamen-ui/pointer-vue';
  ```

- [ ] **Step 2: Add useAuth import**

  SettingsPage.vue currently does NOT import `useAuth`. Add it alongside the existing composable imports:
  ```ts
  import { useAuth } from '@/composables/useAuth';
  ```
  And instantiate it near the top of `<script setup>` (after `const { t } = useI18n()`):
  ```ts
  const { isAdmin } = useAuth();
  ```

- [ ] **Step 3: Add suggestions query + approve/reject mutations**

  After the `onRevoke` and `formatDate` functions, before the closing `</script>`, add:
  ```ts
  // ── Suggestions review (admin-only) ───────────────────────────────────
  const suggestionsQuery = useGetApiAdminPredefinedActionSuggestions();
  const pendingSuggestions = computed<SuggestionResponse[]>(
    () => ((suggestionsQuery.data.value ?? []) as SuggestionResponse[]).filter(
      (s: SuggestionResponse) => s.status === 'Pending',
    ),
  );

  const approveSuggestion = usePostApiAdminPredefinedActionSuggestionsIdApprove();
  const rejectSuggestion = usePostApiAdminPredefinedActionSuggestionsIdReject();

  function reloadSuggestions() {
    void queryClient.invalidateQueries({
      queryKey: getGetApiAdminPredefinedActionSuggestionsQueryKey(),
    });
  }

  async function onApproveSuggestion(s: SuggestionResponse) {
    try {
      await approveSuggestion.mutateAsync({ id: s.id! });
      toast(t('suggestions.approved'));
      reloadSuggestions();
    } catch (e) {
      toast(extractMessage(e));
    }
  }

  async function onRejectSuggestion(s: SuggestionResponse) {
    try {
      await rejectSuggestion.mutateAsync({ id: s.id! });
      toast(t('suggestions.rejected'));
      reloadSuggestions();
    } catch (e) {
      toast(extractMessage(e));
    }
  }
  ```

- [ ] **Step 4: Add the Suggestions review Card to the template**

  In `SettingsPage.vue` template, just before the final `<!-- Save button -->` div, add:
  ```html
  <!-- Section: Prompt suggestions review (admin-only) -->
  <Card v-if="isAdmin">
    <CardContent class="flex flex-col gap-4 p-6">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">{{ t('suggestions.section') }}</h3>
        <span
          v-if="pendingSuggestions.length > 0"
          class="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white"
        >
          {{ t('suggestions.pending', { count: pendingSuggestions.length }) }}
        </span>
      </div>
      <p v-if="suggestionsQuery.isLoading.value" class="text-sm text-muted-foreground">…</p>
      <p v-else-if="pendingSuggestions.length === 0" class="text-sm text-muted-foreground italic">
        {{ t('suggestions.empty') }}
      </p>
      <div
        v-else
        v-for="s in pendingSuggestions"
        :key="s.id"
        class="flex flex-col gap-2 rounded-md border p-3"
      >
        <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{{ t('suggestions.project') }}: <strong>{{ s.projectName ?? s.projectKey }}</strong></span>
          <span>·</span>
          <span>{{ t('suggestions.by') }}: <strong>{{ s.suggestedByName }}</strong></span>
        </div>
        <div class="flex flex-col gap-1">
          <p class="text-sm font-medium">{{ s.text }}</p>
          <p class="text-xs text-muted-foreground whitespace-pre-wrap">{{ s.prompt }}</p>
        </div>
        <div class="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            :disabled="rejectSuggestion.isPending.value"
            @click="onRejectSuggestion(s)"
          >
            {{ t('suggestions.reject') }}
          </Button>
          <Button
            type="button"
            size="sm"
            :disabled="approveSuggestion.isPending.value"
            @click="onApproveSuggestion(s)"
          >
            {{ t('suggestions.approve') }}
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
  ```

- [ ] **Step 5: Check for `SuggestionStatus` — filter by the actual string value**

  Verify the `SuggestionStatus` enum value for "pending" in the dist:
  ```bash
  export PATH="/opt/homebrew/opt/node@26/bin:$PATH"
  cat /Users/momen/Desktop/REPOS/pointer-dashboard/vue/node_modules/@moamen-ui/pointer-vue/dist/model/suggestionStatus.d.ts
  ```
  If the value is not `'Pending'` (e.g., it is `'pending'` lowercase), update the filter in Step 3 to use the correct string. The filter line is:
  ```ts
  (s: SuggestionResponse) => s.status === 'Pending',
  ```

- [ ] **Step 6: Run TypeScript check**

  ```bash
  export PATH="/opt/homebrew/opt/node@26/bin:$PATH"
  cd /Users/momen/Desktop/REPOS/pointer-dashboard/vue
  npx vue-tsc --noEmit 2>&1 | head -40
  ```
  Expected: no errors from SettingsPage.vue.

---

## Task 5: Full build verification

**Files:** (no new edits — just run build)

- [ ] **Step 1: Run the full build**

  ```bash
  export PATH="/opt/homebrew/opt/node@26/bin:$PATH"
  cd /Users/momen/Desktop/REPOS/pointer-dashboard/vue
  npm run build 2>&1
  ```
  Expected: exit code 0, `dist/` updated with no TypeScript or Vite errors.

- [ ] **Step 2: Report**

  Confirm build succeeds and report:
  - Files changed (list all 6 files modified)
  - Symbols used from `@moamen-ui/pointer-vue`
  - Build result (success/failure)

---

## Self-Review Checklist

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| A. Non-admins reach Projects (router + nav) | Task 1 |
| B. Edit only when `canEdit` | Task 3 Step 6 |
| B. Delete with `useDeleteApiAdminProjectsId` when `canDelete` | Task 3 Steps 2, 6 |
| B. Delete disabled+tooltip `projects.deleteBlockedComments` when `!canDelete` | Task 3 Step 6 |
| B. `commentsCount` + `createdByName` columns | Task 3 Steps 5, 6 |
| B. View predefined prompts read-only when `!canEdit` | Task 3 Steps 4, 8 |
| C. Suggest prompt dialog when `!canEdit` | Task 3 Steps 3, 7 |
| C. `usePostApiProjectsIdPredefinedActionSuggestions` | Task 3 Step 3 |
| C. Toast `suggestions.sent` on success | Task 3 Step 3 |
| C. 403 → toast `suggestions.canEditDirectly` | Task 3 Step 3 |
| D. Suggestions section on SettingsPage (admin-only) | Task 4 |
| D. `useGetApiAdminPredefinedActionSuggestions` list | Task 4 Step 3 |
| D. Approve/Reject with correct hooks | Task 4 Steps 3, 4 |
| D. Pending badge on section header | Task 4 Step 4 |
| i18n en + ar `projects.*` + `suggestions.*` | Task 2 |
| `npm run build` clean | Task 5 |

**No placeholders present** — all code shown is complete and runnable.

**Type consistency:** `SuggestionResponse` is the exact type exported at `dist/model/suggestionResponse.d.ts`. `CreateSuggestionRequest` is at `dist/model/createSuggestionRequest.d.ts`. `useDeleteApiAdminProjectsId({ id })` and all hooks verified in `dist/projects/projects.js` and `dist/suggestions/suggestions.js`.

**Vue template gotchas applied:**
- Inline handlers use `suggestOpen = false` (not `suggestOpen.value = false`)
- No literal `</script>` in comments or strings in any `.vue` file
