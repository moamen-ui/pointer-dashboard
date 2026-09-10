import { Component, input } from '@angular/core';

/**
 * Empty state for tables and sections — never a centered icon circle.
 * In tables: three ghost rows with copy in the first and optional action at the end.
 * In sections: one line of copy plus action.
 *
 *   <app-empty-state [message]="'roles.empty' | transloco" [hint]="'roles.emptyHint'">
 *     <button appButton variant="primary" size="sm" (click)="openAdd()">Add role</button>
 *   </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [],
  template: `
    <!-- For table: ghost rows (new design) -->
    @if (inTable()) {
      <div class="divide-y divide-border-muted">
        <div class="h-11 border-t border-dashed border-border-muted flex items-center px-3 gap-3">
          <div class="flex-1">
            <p class="text-[14px] text-muted-foreground">{{ message() }}</p>
            @if (hint()) {
              <p class="text-[13px] text-faint-foreground mt-1">{{ hint() }}</p>
            }
          </div>
          <div class="flex-shrink-0">
            <ng-content />
          </div>
        </div>
        <div class="h-11 border-t border-dashed border-border-muted"></div>
        <div class="h-11 border-t border-dashed border-border-muted"></div>
      </div>
    } @else if (icon()) {
      <!-- Legacy: centered icon circle (for backward compatibility) -->
      <div class="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <div class="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint">
          <!-- Render icon as text (Material ligature name) — Material Icons font must be loaded -->
          <span class="text-brand text-[28px]">{{ icon() }}</span>
        </div>
        <p class="m-0 text-[0.95rem] font-semibold text-foreground">{{ message() }}</p>
        @if (hint()) {
          <p class="m-0 max-w-sm text-[0.82rem] leading-relaxed text-muted-foreground">{{ hint() }}</p>
        }
        <div class="mt-2"><ng-content /></div>
      </div>
    } @else {
      <!-- For sections: text only (new design) -->
      <div class="py-6 text-center">
        <p class="text-[14px] text-muted-foreground">{{ message() }}</p>
        @if (hint()) {
          <p class="text-[13px] text-faint-foreground mt-1">{{ hint() }}</p>
        }
        <div class="mt-4">
          <ng-content />
        </div>
      </div>
    }
  `,
})
export class EmptyStateComponent {
  readonly message = input.required<string>();
  readonly hint = input('');
  readonly icon = input('');
  readonly inTable = input(false);
}
