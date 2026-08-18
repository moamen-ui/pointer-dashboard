import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * The one empty state every table and list uses: a tinted icon, a short message and an
 * optional hint, with a slot for the action that fills the table ("Add role", …).
 *
 *   <app-empty-state icon="manage_accounts" [message]="'roles.empty' | transloco">
 *     <button mat-flat-button (click)="openAdd()">…</button>
 *   </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div class="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint">
        <mat-icon class="!h-7 !w-7 !text-[28px] !leading-7 text-brand">{{ icon() }}</mat-icon>
      </div>
      <p class="m-0 text-[0.95rem] font-semibold text-ink">{{ message() }}</p>
      @if (hint()) {
        <p class="m-0 max-w-sm text-[0.82rem] leading-relaxed text-muted">{{ hint() }}</p>
      }
      <div class="mt-2 empty:hidden"><ng-content /></div>
    </div>
  `,
})
export class EmptyStateComponent {
  /** Material icon name. Pick one that matches the table's subject. */
  readonly icon = input('inbox');
  readonly message = input.required<string>();
  readonly hint = input('');
}
