import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import { AppIconComponent } from './app-icon.component';

export interface MenuItem {
  label: string;
  icon?: string;
  severity?: 'neutral' | 'danger' | 'primary';
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Menu: min-w-[180px] panel on the canvas with a hairline frame and the menu shadow; items are
 * 32px rows with a 4px radius that hover on the gutter, destructive items in the danger hue, and
 * `---` renders a separator.
 *
 * The panel goes through a CDK connected overlay so it floats over any scrolling ancestor (a table
 * wrapper or a dialog body) instead of being clipped by it, and flips above the trigger near the
 * bottom of the viewport.
 */
@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [OverlayModule, AppIconComponent],
  template: `
    <!-- Trigger slot -->
    <div #trigger cdkOverlayOrigin #origin="cdkOverlayOrigin" (click)="toggleOpen()">
      <ng-content select="[appMenuTrigger]" />
    </div>

    <!-- Menu panel -->
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
export class AppMenuComponent {
  readonly items = input.required<MenuItem[]>();
  readonly itemClicked = output<MenuItem>();

  readonly isOpen = signal(false);

  private readonly trigger = viewChild<ElementRef<HTMLElement>>('trigger');

  /** Aligned to the trigger's end edge, flipping above it when the viewport runs out. */
  readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  protected readonly hasTrigger = computed(() => !!this.trigger());

  toggleOpen(): void {
    this.isOpen.update((v) => !v);
  }

  handleClick(item: MenuItem): void {
    if (item.disabled || !item.onClick) return;
    item.onClick();
    this.isOpen.set(false);
    this.itemClicked.emit(item);
  }
}
