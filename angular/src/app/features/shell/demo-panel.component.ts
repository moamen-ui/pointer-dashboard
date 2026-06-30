import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

interface DemoSession {
  email?: string | null;
  password?: string | null;
  projectKey?: string | null;
  serverUrl?: string | null;
  expiresAt?: string;
}

const DEMO_SESSION_KEY = 'pointer_demo';

/**
 * Dismissible banner shown in the shell while a demo session (stored in
 * sessionStorage under `pointer_demo`) is active. Surfaces the demo project key,
 * a copy-paste widget snippet, the widget login, and a live countdown to expiry.
 */
@Component({
  selector: 'app-demo-panel',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, TranslocoModule],
  template: `
    @if (session(); as s) {
      <div class="mb-4 rounded-xl border border-brand/40 bg-brand-tint p-4 text-ink">
        <div class="flex items-start gap-2">
          <mat-icon class="text-brand">science</mat-icon>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="text-[1rem] font-bold">{{ 'demo.panelTitle' | transloco }}</span>
              <span class="ms-auto text-[0.85rem] text-muted">{{ countdownLabel() }}</span>
            </div>
            <p class="mt-1 mb-3 text-[0.85rem] text-muted">{{ 'demo.panelIntro' | transloco }}</p>

            <div class="grid gap-3 md:grid-cols-2">
              <div>
                <div class="text-[0.75rem] font-semibold uppercase text-muted">{{ 'demo.projectKey' | transloco }}</div>
                <code class="mt-1 inline-block rounded bg-app px-2 py-1 text-[0.85rem]">{{ s.projectKey }}</code>
              </div>
              <div>
                <div class="text-[0.75rem] font-semibold uppercase text-muted">{{ 'demo.widgetLogin' | transloco }}</div>
                <div class="mt-1 text-[0.85rem]">
                  <span class="font-medium">{{ s.email }}</span>
                  <span class="text-muted"> · </span>
                  <code class="rounded bg-app px-1.5 py-0.5">{{ s.password }}</code>
                </div>
              </div>
            </div>

            <!-- Setup steps as a one-at-a-time slider with Prev/Next -->
            <div class="mt-4 rounded-lg border border-app-border bg-app/40 p-3">
              @if (step() === 1) {
                <div>
                  <div class="text-[0.8rem] font-semibold">{{ 'demo.step1Title' | transloco }}</div>
                  <div class="text-[0.75rem] text-muted">{{ 'demo.step1Hint' | transloco }}</div>
                  <div class="mt-1 flex items-start gap-2">
                    <pre class="m-0 flex-1 overflow-x-auto rounded bg-app px-2 py-1.5 text-[0.8rem]"><code>{{ embedSnippet() }}</code></pre>
                    <button mat-stroked-button class="border-app-border" type="button" (click)="copy(embedSnippet())">
                      <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                    </button>
                  </div>
                </div>
              } @else if (step() === 2) {
                <div>
                  <div class="text-[0.8rem] font-semibold">{{ 'demo.step2Title' | transloco }}</div>
                  <div class="text-[0.75rem] text-muted">{{ 'demo.step2Hint' | transloco }}</div>
                  <div class="mt-1 flex items-center gap-2">
                    <code class="flex-1 overflow-x-auto whitespace-nowrap rounded bg-app px-2 py-1.5 text-[0.8rem]">{{ installCmd() }}</code>
                    <button mat-stroked-button class="border-app-border" type="button" (click)="copy(installCmd())">
                      <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                    </button>
                  </div>
                </div>
              } @else if (step() === 3) {
                <div>
                  <div class="text-[0.8rem] font-semibold">{{ 'demo.step3Title' | transloco }}</div>
                  <div class="text-[0.75rem] text-muted">{{ 'demo.step3Hint' | transloco }}</div>
                  <div class="mt-1 flex items-start gap-2">
                    <pre class="m-0 flex-1 overflow-x-auto rounded bg-app px-2 py-1.5 text-[0.8rem]"><code>{{ credsBlock() }}</code></pre>
                    <button mat-stroked-button class="border-app-border" type="button" (click)="copy(credsBlock())">
                      <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                    </button>
                  </div>
                </div>
              } @else {
                <div>
                  <div class="text-[0.8rem] font-semibold">{{ 'demo.step4Title' | transloco }}</div>
                  <div class="text-[0.75rem] text-muted">{{ 'demo.step4Hint' | transloco }}</div>
                  <div class="mt-1 flex items-center gap-2">
                    <code class="flex-1 overflow-x-auto whitespace-nowrap rounded bg-app px-2 py-1.5 text-[0.8rem]">{{ aiPrompt }}</code>
                    <button mat-stroked-button class="border-app-border" type="button" (click)="copy(aiPrompt)">
                      <mat-icon>content_copy</mat-icon> {{ 'demo.copy' | transloco }}
                    </button>
                  </div>
                </div>
              }

              <div class="mt-3 flex items-center gap-2">
                <button mat-stroked-button class="border-app-border" type="button" [disabled]="step() === 1" (click)="prev()">
                  <mat-icon>chevron_left</mat-icon> {{ 'demo.back' | transloco }}
                </button>
                <span class="text-[0.8rem] text-muted">{{ step() }} / 4</span>
                <button mat-stroked-button class="ms-auto border-app-border" type="button" [disabled]="step() === 4" (click)="next()">
                  {{ 'demo.next' | transloco }} <mat-icon>chevron_right</mat-icon>
                </button>
              </div>
            </div>
          </div>
          <button mat-icon-button type="button" [attr.aria-label]="'demo.dismiss' | transloco" (click)="dismiss()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
    }
  `,
})
export class DemoPanelComponent implements OnDestroy {
  private snack = inject(MatSnackBar);
  private transloco = inject(TranslocoService);

  private now = signal(Date.now());
  private timer = setInterval(() => this.now.set(Date.now()), 1000);
  session = signal<DemoSession | null>(this.read());

  // Step 1: script that defines <pointer-feedback> + the mounted element.
  embedSnippet = computed(() => {
    const s = this.session();
    if (!s) return '';
    const srv = s.serverUrl ?? '';
    return `<script src="${srv}/pointer.js" defer></script>\n<pointer-feedback project="${s.projectKey ?? ''}" server="${srv}"></pointer-feedback>`;
  });

  // Step 2: one-line installer — pulls the pointer-init + pointer-feedback skills
  // and scaffolds .pointer/credentials.env (+ .example), gitignored.
  installCmd = computed(() => {
    const s = this.session();
    if (!s) return '';
    return `curl -fsSL ${s.serverUrl ?? ''}/install.sh | sh`;
  });

  // Step 3: paste into .pointer/credentials.env — pre-filled with this demo's widget login.
  credsBlock = computed(() => {
    const s = this.session();
    if (!s) return '';
    return `POINTER_EMAIL=${s.email ?? ''}\nPOINTER_PASSWORD=${s.password ?? ''}`;
  });

  // Step 4: an example prompt to paste into the AI tool (kept English — the skill triggers on it).
  readonly aiPrompt = 'What are the new Pointer comments?';

  // Setup-steps slider (1..4).
  step = signal(1);
  next(): void { this.step.update((n) => Math.min(4, n + 1)); }
  prev(): void { this.step.update((n) => Math.max(1, n - 1)); }

  countdownLabel = computed(() => {
    const s = this.session();
    if (!s?.expiresAt) return '';
    const remaining = new Date(s.expiresAt).getTime() - this.now();
    if (remaining <= 0) return this.transloco.translate('demo.expired');
    const totalMinutes = Math.floor(remaining / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return this.transloco.translate('demo.expiresIn', { hours, minutes });
  });

  private read(): DemoSession | null {
    try {
      return JSON.parse(sessionStorage.getItem(DEMO_SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(
      () => this.snack.open(this.transloco.translate('demo.copied'), 'OK', { duration: 2000 }),
      () => this.snack.open(this.transloco.translate('demo.copyFailed'), 'OK', { duration: 3000 })
    );
  }

  dismiss(): void {
    sessionStorage.removeItem(DEMO_SESSION_KEY);
    this.session.set(null);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
