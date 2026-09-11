import { Component, input, signal } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import { AppButtonDirective } from '../ui/app-button.directive';
import { AppIconComponent } from '../ui/app-icon.component';
import type { Severity } from '../severity';

export interface RowActionItem {
  label: string;
  icon?: string;
  severity?: Severity;
  disabled?: boolean;
  tooltip?: string;
  onClick: () => void;
}

/**
 * The trailing per-row actions menu: a ghost kebab trigger and a 180px panel of 32px rows.
 * Permission and feature gating stays in the page's `items` callback, never in here.
 *
 * The panel goes through a CDK connected overlay so a row near the bottom of a scrolling table
 * still shows its full menu instead of having it clipped by the table's wrapper.
 */
@Component({
  selector: 'app-row-actions-menu',
  standalone: true,
  imports: [OverlayModule, AppButtonDirective, AppIconComponent],
  template: `
    @if (items().length > 0) {
      <button
        appButton
        variant="ghost"
        size="icon"
        cdkOverlayOrigin
        #origin="cdkOverlayOrigin"
        (click)="toggleOpen()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-expanded]="isOpen()"
        aria-haspopup="menu"
      >
        <app-icon name="more-vertical" [size]="16"></app-icon>
      </button>

      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="origin"
        [cdkConnectedOverlayOpen]="isOpen()"
        [cdkConnectedOverlayPositions]="positions"
        [cdkConnectedOverlayViewportMargin]="8"
        (overlayOutsideClick)="isOpen.set(false)"
        (detach)="isOpen.set(false)"
      >
        <div
          role="menu"
          class="min-w-[180px] rounded-md border border-border bg-background p-1 shadow-menu"
          [style.animation]="'scaleIn 120ms ease-out forwards'"
        >
          @for (item of items(); track $index) {
            @if (item.label === '---') {
              <div class="my-1 border-t border-border-muted" role="separator"></div>
            } @else {
              <button
                type="button"
                role="menuitem"
                class="w-full h-8 px-2 rounded-[4px] text-[14px] flex items-center gap-2 text-foreground hover:bg-gutter transition-colors disabled:cursor-not-allowed disabled:text-muted-foreground"
                [class.text-state-danger]="item.severity === 'danger'"
                [class.hover:bg-state-danger-tint]="item.severity === 'danger'"
                [disabled]="item.disabled"
                [title]="item.tooltip ?? ''"
                (click)="handleClick(item)"
              >
                @if (item.icon) {
                  <app-icon [name]="item.icon" [size]="16" class="flex-shrink-0"></app-icon>
                }
                <span class="text-start flex-1">{{ item.label }}</span>
              </button>
            }
          }
        </div>
      </ng-template>
    }
  `,
  host: {
    class: 'inline-block',
    '(document:keydown.escape)': 'isOpen.set(false)',
  },
  styles: [`
    @keyframes scaleIn {
      from {
        transform: scale(0.98);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
  `],
})
export class RowActionsMenuComponent {
  readonly items = input.required<RowActionItem[]>();
  readonly ariaLabel = input.required<string>();

  readonly isOpen = signal(false);

  /** Aligned to the kebab's end edge, flipping above it near the bottom of the viewport. */
  readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  toggleOpen(): void {
    this.isOpen.update((v) => !v);
  }

  handleClick(item: RowActionItem): void {
    if (item.disabled || !item.onClick) return;
    item.onClick();
    this.isOpen.set(false);
  }
}
