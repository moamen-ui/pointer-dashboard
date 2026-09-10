import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { AppIconComponent } from './app-icon.component';

export type DiffstatTone = 'open' | 'ready' | 'completed' | 'archived' | 'danger' | 'neutral';

export interface DiffstatItem {
  /** Lowercase-as-given label rendered after the number (already translated). */
  label: string;
  count: number | string;
  /** Diff hue for the number; `neutral` (default) renders it in ink. */
  tone?: DiffstatTone;
  /** Optional 12px lucide icon rendered before the number (e.g. `lock` for private comments). */
  icon?: string;
  /** Optional hover text (e.g. the private-comments tooltip). */
  title?: string;
}

const TONE_CLASS: Record<DiffstatTone, string> = {
  open: 'text-state-open',
  ready: 'text-state-ready',
  completed: 'text-state-completed',
  archived: 'text-state-archived',
  danger: 'text-state-danger',
  neutral: 'text-foreground',
};

/**
 * Diffstat line (§3): `6 comments · 2 open · 1 ready …` — mono numbers in their state hue,
 * sans labels in muted ink, faint middots between items. Same markup as React's DiffstatLine.
 */
@Component({
  selector: 'app-diffstat',
  // A custom element defaults to display:inline, which drops vertical margins from
  // `space-y-*` and breaks width; blockify the host.
  host: { class: 'block' },
  standalone: true,
  imports: [AppIconComponent],
  template: `
    <div class="text-[14px] flex flex-wrap items-center gap-2 text-muted-foreground mb-6">
      @for (item of items(); track $index; let last = $last) {
        <span class="inline-flex items-center gap-1" [attr.title]="item.title ?? null">
          @if (item.icon) {
            <app-icon [name]="item.icon" [size]="12" class="text-muted-foreground"></app-icon>
          }
          <span class="font-mono tabular-nums" [class]="toneClass(item.tone)">{{ item.count }}</span>
          <span>{{ item.label }}</span>
        </span>
        @if (!last) {
          <span class="text-faint-foreground" aria-hidden="true">·</span>
        }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppDiffstatComponent {
  readonly items = input<DiffstatItem[]>([]);

  toneClass(tone?: DiffstatTone): string {
    return TONE_CLASS[tone ?? 'neutral'];
  }
}
