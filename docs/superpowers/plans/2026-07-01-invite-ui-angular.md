# Invite Dashboard UI (Angular) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Invite teammates" card to the Settings page and an anonymous `/join?code=` accept page in the Angular dashboard.

**Architecture:** Part A adds a new mat-card section at the bottom of `settings.component.ts` that uses `getApiAdminInvitesResource` + `InvitesService` (create/revoke) and `getApiAdminRolesResource` (filtered to non-admin). Part B creates a new standalone component `join.component.ts` registered as an anonymous route `/join`, using `getApiInvitesCodeResource` for preview and `InvitesService.postApiAuthRegisterInvite` + `AuthService.loginWithToken` for accept.

**Tech Stack:** Angular 17+ standalone components, Angular Material (mat-card, mat-form-field, mat-select, mat-table, mat-button, mat-progress-bar, mat-snack-bar), Reactive Forms, `@jsverse/transloco`, `@moamen-ui/pointer-angular` (InvitesService, RolesService, getApiAdminInvitesResource, getApiInvitesCodeResource), signals + computed, viewChild.

## Global Constraints

- Do NOT commit.
- `npm run build` must pass clean (run from `/Users/momen/Desktop/REPOS/pointer-dashboard/angular`).
- PATH must include `/opt/homebrew/opt/node@26/bin`.
- Only touch `angular/` directory + its i18n files.
- Package `@moamen-ui/pointer-angular` is locked at `1.0.14` — do NOT change it.
- i18n key namespace: `invite.*` — merge into existing `en.json` and `ar.json` without removing existing keys.
- Use `TranslocoModule` (pipe `| transloco`) not `TranslatePipe` (which is Angular i18n).
- Use signals + `viewChild()`, NOT `@ViewChild` decorator.
- All components are standalone.
- Follow existing pattern: `inject()`, `signal()`, `computed()`, `resource.reload()`.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `angular/src/app/features/settings/settings.component.ts` | Modify | Add invite card section (create form + active list) |
| `angular/src/app/features/auth/join.component.ts` | Create | Anonymous `/join?code=` accept page |
| `angular/src/app/app.routes.ts` | Modify | Register anonymous `join` route |
| `angular/public/assets/i18n/en.json` | Modify | Merge `invite.*` keys |
| `angular/public/assets/i18n/ar.json` | Modify | Merge `invite.*` Arabic keys |

---

### Task 1: Merge i18n keys into en.json and ar.json

**Files:**
- Modify: `angular/public/assets/i18n/en.json`
- Modify: `angular/public/assets/i18n/ar.json`

**Interfaces:**
- Produces: i18n keys `invite.*` available to all components

- [ ] **Step 1: Add `invite` block to en.json**

Open `angular/public/assets/i18n/en.json`. Add the following after the closing `}` of the `"profile"` block (before the final `}`):

```json
  ,
  "invite": {
    "section": "Invite teammates",
    "sectionHint": "Generate a link that lets a teammate join this workspace with a chosen role. Invited teammates skip the approval queue.",
    "role": "Role",
    "email": "Restrict to email (optional)",
    "expiresDays": "Expires in (days)",
    "maxUses": "Max uses (optional)",
    "create": "Create invite",
    "created": "Invite created",
    "copy": "Copy link",
    "copied": "Link copied",
    "revoke": "Revoke",
    "revoked": "Invite revoked",
    "empty": "No active invites.",
    "anyone": "Anyone with the link",
    "uses": "Uses",
    "expires": "Expires",
    "joinTitle": "Join {{workspace}}",
    "joinRole": "You'll join as {{role}}.",
    "password": "Password",
    "confirmPassword": "Confirm password",
    "displayName": "Display name",
    "join": "Join workspace",
    "joined": "Welcome! You're now a member.",
    "invalidLink": "This invite link is missing its code.",
    "invalidOrExpired": "This invite is invalid, expired, or already used.",
    "passwordMismatch": "Passwords do not match."
  }
```

- [ ] **Step 2: Add `invite` block to ar.json**

Open `angular/public/assets/i18n/ar.json`. Add the following after the closing `}` of the `"profile"` block (before the final `}`):

```json
  ,
  "invite": {
    "section": "دعوة أعضاء الفريق",
    "sectionHint": "أنشئ رابطًا يتيح لعضو الفريق الانضمام إلى مساحة العمل بدور محدد. الأعضاء المدعوّون يتخطّون قائمة الموافقة.",
    "role": "الدور",
    "email": "تقييد ببريد محدد (اختياري)",
    "expiresDays": "تنتهي خلال (أيام)",
    "maxUses": "أقصى عدد استخدامات (اختياري)",
    "create": "إنشاء دعوة",
    "created": "تم إنشاء الدعوة",
    "copy": "نسخ الرابط",
    "copied": "تم نسخ الرابط",
    "revoke": "إلغاء",
    "revoked": "تم إلغاء الدعوة",
    "empty": "لا توجد دعوات نشطة.",
    "anyone": "أي شخص لديه الرابط",
    "uses": "الاستخدامات",
    "expires": "تنتهي",
    "joinTitle": "انضم إلى {{workspace}}",
    "joinRole": "ستنضم بدور {{role}}.",
    "password": "كلمة المرور",
    "confirmPassword": "تأكيد كلمة المرور",
    "displayName": "الاسم المعروض",
    "join": "انضمّ إلى مساحة العمل",
    "joined": "أهلًا بك! أصبحت عضوًا الآن.",
    "invalidLink": "رابط الدعوة يفتقد الرمز.",
    "invalidOrExpired": "هذه الدعوة غير صالحة أو منتهية أو مستخدمة بالفعل.",
    "passwordMismatch": "كلمتا المرور غير متطابقتين."
  }
```

- [ ] **Step 3: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('/Users/momen/Desktop/REPOS/pointer-dashboard/angular/public/assets/i18n/en.json','utf8')); console.log('en.json OK')"
node -e "JSON.parse(require('fs').readFileSync('/Users/momen/Desktop/REPOS/pointer-dashboard/angular/public/assets/i18n/ar.json','utf8')); console.log('ar.json OK')"
```

Expected: `en.json OK` and `ar.json OK` on stdout.

---

### Task 2: Add "Invite teammates" card to Settings page (Part A)

**Files:**
- Modify: `angular/src/app/features/settings/settings.component.ts`

**Interfaces:**
- Consumes: `InvitesService` (from `@moamen-ui/pointer-angular`) — methods: `postApiAdminInvites(body: CreateInviteRequest)`, `deleteApiAdminInvitesId(id: number)`
- Consumes: `getApiAdminInvitesResource()` (from `@moamen-ui/pointer-angular`) — returns `HttpResourceRef<InviteResponse[] | undefined>`
- Consumes: `getApiAdminRolesResource()` — already imported in `roles.component.ts`, import here too
- Consumes: `RolesService` — already in node_modules, for consistent pattern
- Types needed: `InviteResponse`, `CreateInviteRequest`, `RoleResponse`
- Produces: A new `mat-card` section below the predefined-actions section, with create form + active list

**Key API shapes (from `@moamen-ui/pointer-angular`):**
- `CreateInviteRequest { roleId?: number | null; email?: string | null; expiresInDays?: number | null; maxUses?: number | null }`
- `InviteResponse { id?: number; code?: string | null; url?: string | null; roleId?: number | null; roleName?: string | null; email?: string | null; expiresAt?: string; maxUses?: number | null; uses?: number }`
- `RoleResponse { id?: number; name?: string | null; grantsAdmin?: boolean; isActive?: boolean; isSystem?: boolean }`

- [ ] **Step 1: Add imports and inject services**

At the top of `settings.component.ts`, add to the existing import from `@moamen-ui/pointer-angular`:

```typescript
import {
  SettingsService,
  PredefinedActionsService,
  InvitesService,
  getApiAdminSettingsResource,
  getApiAdminPredefinedActionsResource,
  getApiAdminInvitesResource,
  getApiAdminRolesResource,
} from '@moamen-ui/pointer-angular';
import type { SettingsResponse, PredefinedActionResponse, InviteResponse, RoleResponse } from '@moamen-ui/pointer-angular';
```

Also add `MatSelectModule` and `MatProgressBarModule` are already there; also add `MatTableModule` to the imports array in `@Component`. Actually the component already has `MatProgressBarModule` — add `MatSelectModule` to the `imports` array in the component decorator.

- [ ] **Step 2: Add invite signals/resources to the component class**

In the `SettingsComponent` class, below the existing `newActionBusy = signal(false);` line, add:

```typescript
  // --- Invite teammates ---

  private invitesService = inject(InvitesService);

  invitesResource = getApiAdminInvitesResource();
  rolesResource = getApiAdminRolesResource();

  invites = computed(() => (this.invitesResource.value() ?? []) as InviteResponse[]);
  nonAdminRoles = computed(() =>
    ((this.rolesResource.value() ?? []) as RoleResponse[]).filter((r) => !r.grantsAdmin && r.isActive),
  );

  // Create invite form state
  inviteRoleId = signal<number | null>(null);
  inviteEmail = signal('');
  inviteExpiresInDays = signal<number | null>(7);
  inviteMaxUses = signal<number | null>(null);
  inviteCreating = signal(false);
  inviteCreatedUrl = signal<string | null>(null);
```

- [ ] **Step 3: Add createInvite() and revokeInvite() methods**

At the end of the class (before the closing `}`), add:

```typescript
  createInvite(): void {
    const roleId = this.inviteRoleId();
    if (!roleId) return;
    this.inviteCreating.set(true);
    this.inviteCreatedUrl.set(null);
    const body = {
      roleId,
      email: this.inviteEmail() || null,
      expiresInDays: this.inviteExpiresInDays(),
      maxUses: this.inviteMaxUses(),
    };
    this.invitesService.postApiAdminInvites(body).subscribe({
      next: (res: InviteResponse) => {
        this.inviteCreating.set(false);
        this.inviteCreatedUrl.set(res.url ?? null);
        this.snack.open(this.transloco.translate('invite.created'), 'OK', { duration: 3000 });
        this.invitesResource.reload();
      },
      error: (e: unknown) => {
        this.inviteCreating.set(false);
        this.snack.open(extractMessage(e), 'OK', { duration: 4000 });
      },
    });
  }

  copyInviteUrl(url: string): void {
    navigator.clipboard.writeText(url).then(() => {
      this.snack.open(this.transloco.translate('invite.copied'), 'OK', { duration: 2000 });
    });
  }

  revokeInvite(invite: InviteResponse): void {
    if (!invite.id) return;
    this.invitesService.deleteApiAdminInvitesId(invite.id).subscribe({
      next: () => {
        this.snack.open(this.transloco.translate('invite.revoked'), 'OK', { duration: 3000 });
        this.invitesResource.reload();
      },
      error: (e: unknown) => this.snack.open(extractMessage(e), 'OK', { duration: 4000 }),
    });
  }
```

- [ ] **Step 4: Add the invite card to the template**

In the component template, after the closing `</div>` of the predefined-actions section (`<!-- Predefined actions section -->`), add a new section:

```html
      <!-- Invite teammates section -->
      <div class="mt-8 max-w-2xl">
        <mat-card class="p-4">
          <h3 class="m-0 mb-1 text-base font-semibold">{{ 'invite.section' | transloco }}</h3>
          <p class="mb-4 text-[0.85rem] text-muted">{{ 'invite.sectionHint' | transloco }}</p>

          <!-- Create invite form -->
          <div class="flex flex-col gap-3 rounded border border-app-border p-3">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'invite.role' | transloco }}</mat-label>
              <mat-select [ngModel]="inviteRoleId()" (ngModelChange)="inviteRoleId.set($event)">
                @for (r of nonAdminRoles(); track r.id) {
                  <mat-option [value]="r.id">{{ r.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'invite.email' | transloco }}</mat-label>
              <input matInput type="email"
                [ngModel]="inviteEmail()"
                (ngModelChange)="inviteEmail.set($event)" />
            </mat-form-field>

            <div class="flex gap-3">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="flex-1">
                <mat-label>{{ 'invite.expiresDays' | transloco }}</mat-label>
                <input matInput type="number" min="1"
                  [ngModel]="inviteExpiresInDays()"
                  (ngModelChange)="inviteExpiresInDays.set($event ? +$event : null)" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="flex-1">
                <mat-label>{{ 'invite.maxUses' | transloco }}</mat-label>
                <input matInput type="number" min="1"
                  [ngModel]="inviteMaxUses()"
                  (ngModelChange)="inviteMaxUses.set($event ? +$event : null)" />
              </mat-form-field>
            </div>

            <div>
              <button mat-flat-button color="primary"
                [disabled]="!inviteRoleId() || inviteCreating()"
                (click)="createInvite()">
                {{ 'invite.create' | transloco }}
              </button>
            </div>

            @if (inviteCreatedUrl()) {
              <div class="flex items-center gap-2 rounded bg-slate-50 p-2 text-[0.85rem] break-all">
                <span class="flex-1">{{ inviteCreatedUrl() }}</span>
                <button mat-stroked-button (click)="copyInviteUrl(inviteCreatedUrl()!)">
                  {{ 'invite.copy' | transloco }}
                </button>
              </div>
            }
          </div>

          <!-- Active invites list -->
          <div class="mt-4">
            @if (invitesResource.isLoading()) {
              <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            }

            @if (!invitesResource.isLoading() && invites().length === 0) {
              <p class="text-[0.85rem] text-muted">{{ 'invite.empty' | transloco }}</p>
            }

            @for (inv of invites(); track inv.id) {
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2 rounded border border-app-border p-3 text-[0.85rem]">
                <div class="flex flex-col gap-0.5">
                  <div><span class="font-medium">{{ inv.roleName }}</span></div>
                  <div class="text-muted">
                    {{ inv.email || ('invite.anyone' | transloco) }}
                  </div>
                  <div class="text-muted">
                    {{ 'invite.expires' | transloco }}: {{ inv.expiresAt | date:'mediumDate' }}
                    &nbsp;·&nbsp;
                    {{ 'invite.uses' | transloco }}: {{ inv.uses }}/{{ inv.maxUses ?? '∞' }}
                  </div>
                </div>
                <div class="flex gap-2">
                  <button mat-stroked-button (click)="copyInviteUrl(inv.url!)">
                    {{ 'invite.copy' | transloco }}
                  </button>
                  <button mat-stroked-button color="warn" (click)="revokeInvite(inv)">
                    {{ 'invite.revoke' | transloco }}
                  </button>
                </div>
              </div>
            }
          </div>
        </mat-card>
      </div>
```

- [ ] **Step 5: Add missing imports to the component decorator**

In the `@Component` `imports` array, add:
- `MatSelectModule` (import from `@angular/material/select`)
- `DatePipe` (import from `@angular/common`) — needed for `| date` pipe
- `FormsModule` is already there

Add at the top of the file:
```typescript
import { DatePipe } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
```

Add `DatePipe` and `MatSelectModule` to the `imports` array in `@Component`.

- [ ] **Step 6: Syntax check**

```bash
export PATH="/opt/homebrew/opt/node@26/bin:$PATH" && node --check /Users/momen/Desktop/REPOS/pointer-dashboard/angular/src/app/features/settings/settings.component.ts
```

Expected: no output (no errors).

---

### Task 3: Create the anonymous /join component (Part B)

**Files:**
- Create: `angular/src/app/features/auth/join.component.ts`

**Interfaces:**
- Consumes: `InvitesService.postApiAuthRegisterInvite(body: AcceptInviteRequest)` → returns `LoginResponse { token?: string; user?: MeResponse }`
- Consumes: `getApiInvitesCodeResource(code: Signal<string>)` → `HttpResourceRef<InvitePreviewResponse | undefined>`
- Consumes: `AuthService.loginWithToken(token: string)` → `Observable<MeResponse>` (from `../../core/auth/auth.service`)
- Types: `InvitePreviewResponse { workspaceName?: string | null; roleName?: string | null; emailLocked?: boolean }`, `AcceptInviteRequest`, `LoginResponse`
- Produces: Standalone component `JoinComponent` with selector `app-join`

- [ ] **Step 1: Create join.component.ts**

Create the file `/Users/momen/Desktop/REPOS/pointer-dashboard/angular/src/app/features/auth/join.component.ts`:

```typescript
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  InvitesService,
  getApiInvitesCodeResource,
} from '@moamen-ui/pointer-angular';
import type {
  AcceptInviteRequest,
  InvitePreviewResponse,
  LoginResponse,
} from '@moamen-ui/pointer-angular';
import { AuthService } from '../../core/auth/auth.service';
import { extractMessage } from '../../core/api/extract-message';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const pwd = control.get('password');
  const confirm = control.get('confirmPassword');
  if (!pwd || !confirm) return null;
  return pwd.value === confirm.value ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressBarModule,
    TranslocoModule,
  ],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-100">
      <mat-card class="flex w-[420px] max-w-[92vw] flex-col gap-3 p-6">

        @if (!code()) {
          <p class="text-[0.95rem] text-warn">{{ 'invite.invalidLink' | transloco }}</p>
          <a mat-button routerLink="/login" class="mt-1 text-center text-[0.9rem]">
            {{ 'auth.backToLogin' | transloco }}
          </a>
        } @else if (previewResource.isLoading()) {
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        } @else if (previewResource.error()) {
          <p class="text-[0.95rem] text-warn">{{ 'invite.invalidOrExpired' | transloco }}</p>
          <a mat-button routerLink="/login" class="mt-1 text-center text-[0.9rem]">
            {{ 'auth.backToLogin' | transloco }}
          </a>
        } @else if (preview()) {
          <h1 class="my-[0.67em] text-[1.8em] font-bold">
            {{ 'invite.joinTitle' | transloco: { workspace: preview()!.workspaceName ?? '' } }}
          </h1>
          @if (preview()!.roleName) {
            <p class="m-0 text-[0.95rem] text-muted">
              {{ 'invite.joinRole' | transloco: { role: preview()!.roleName } }}
            </p>
          }

          @if (errorMsg()) {
            <p class="text-[0.9rem] text-red-600">{{ errorMsg() }}</p>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-3">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'invite.email' | transloco }}</mat-label>
              <input matInput type="email" formControlName="email" />
              @if (form.get('email')?.hasError('required')) {
                <mat-error>{{ 'invite.email' | transloco }}</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'invite.displayName' | transloco }}</mat-label>
              <input matInput formControlName="displayName" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'invite.password' | transloco }}</mat-label>
              <input matInput type="password" formControlName="password" />
              @if (form.get('password')?.hasError('minlength')) {
                <mat-error>{{ 'invite.password' | transloco }} (min 8)</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'invite.confirmPassword' | transloco }}</mat-label>
              <input matInput type="password" formControlName="confirmPassword" />
              @if (form.hasError('passwordsMismatch') && form.get('confirmPassword')?.touched) {
                <mat-error>{{ 'invite.passwordMismatch' | transloco }}</mat-error>
              }
            </mat-form-field>

            <button
              mat-flat-button
              color="primary"
              class="mt-1"
              [disabled]="form.invalid || joining()">
              {{ 'invite.join' | transloco }}
            </button>
          </form>
        }

      </mat-card>
    </div>
  `,
})
export class JoinComponent implements OnInit {
  private fb = inject(FormBuilder);
  private invitesService = inject(InvitesService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private transloco = inject(TranslocoService);

  code = signal<string>('');
  joining = signal(false);
  errorMsg = signal<string | null>(null);

  previewResource = getApiInvitesCodeResource(this.code);

  preview = computed(() => this.previewResource.value() as InvitePreviewResponse | undefined);

  form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      displayName: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator },
  );

  ngOnInit(): void {
    const c = this.route.snapshot.queryParamMap.get('code');
    if (c) this.code.set(c);
  }

  submit(): void {
    if (this.form.invalid || !this.code()) return;

    if (this.form.hasError('passwordsMismatch')) {
      this.errorMsg.set(this.transloco.translate('invite.passwordMismatch'));
      return;
    }

    this.joining.set(true);
    this.errorMsg.set(null);

    const { email, password, displayName } = this.form.getRawValue();
    const body: AcceptInviteRequest = {
      code: this.code(),
      email,
      password,
      displayName,
    };

    this.invitesService.postApiAuthRegisterInvite(body).subscribe({
      next: (res: LoginResponse) => {
        this.authService.loginWithToken(res.token!).subscribe({
          next: (user) => {
            this.joining.set(false);
            void this.router.navigateByUrl(user.isAdmin ? '/overview' : '/profile');
          },
          error: (e: unknown) => {
            this.joining.set(false);
            this.errorMsg.set(extractMessage(e));
          },
        });
      },
      error: (e: unknown) => {
        this.joining.set(false);
        this.errorMsg.set(extractMessage(e));
      },
    });
  }
}
```

- [ ] **Step 2: Syntax check**

```bash
export PATH="/opt/homebrew/opt/node@26/bin:$PATH" && node --check /Users/momen/Desktop/REPOS/pointer-dashboard/angular/src/app/features/auth/join.component.ts
```

Expected: no output (no errors).

---

### Task 4: Register the /join anonymous route

**Files:**
- Modify: `angular/src/app/app.routes.ts`

**Interfaces:**
- Consumes: `JoinComponent` from `./features/auth/join.component`
- Produces: Anonymous `join` route (no `canActivate`, same as `forgot` and `reset`)

- [ ] **Step 1: Add the join route**

In `app.routes.ts`, add a new entry after the `reset` route (line ~38, after the `reset` entry closes):

```typescript
  {
    path: 'join',
    loadComponent: () =>
      import('./features/auth/join.component').then((m) => m.JoinComponent),
  },
```

The `routes` array should then have four consecutive anonymous entries: `login`, `signup`, `forgot`, `reset`, `join`, then the authenticated shell.

- [ ] **Step 2: Syntax check**

```bash
export PATH="/opt/homebrew/opt/node@26/bin:$PATH" && node --check /Users/momen/Desktop/REPOS/pointer-dashboard/angular/src/app/app.routes.ts
```

Expected: no output.

---

### Task 5: Run the build and fix any TypeScript errors

**Files:**
- Any file that has a type error

- [ ] **Step 1: Run build**

```bash
export PATH="/opt/homebrew/opt/node@26/bin:$PATH" && cd /Users/momen/Desktop/REPOS/pointer-dashboard/angular && npm run build 2>&1 | tail -60
```

Expected: `Build at: ... - Hash: ...` with no `ERROR` lines.

- [ ] **Step 2: Fix any TypeScript errors if present**

Common issues to watch for:
- `getApiInvitesCodeResource` requires a `Signal<string>` — if the code signal is initialized to `''` (empty string), the resource may fire with an empty string before `ngOnInit` sets it. This is OK because the template guards with `@if (!code())` so empty string means "no code" path is shown.
- The `| date` pipe in settings.component.ts requires `DatePipe` in standalone `imports` array.
- If `MatSelectModule` is missing from `settings.component.ts` imports array, mat-select won't resolve.

Re-run build after each fix until clean.
