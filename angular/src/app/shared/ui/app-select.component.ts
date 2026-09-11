import {
  Component,
  input,
  output,
  signal,
  computed,
  viewChild,
  ElementRef,
} from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import { AppIconComponent } from './app-icon.component';

export interface SelectOption<T = any> {
  label: string;
  value: T;
}

/**
 * Select component: h-8 w-full rounded-md border border-border bg-background px-3 text-[14px],
 * trigger ends with 16px chevron, menu = Menu style. Input options, value, (valueChange).
 * Open animation: scale-[0.98] opacity-0 → 1 in 120ms ease-out.
 *
 * The panel goes through a CDK connected overlay rather than an absolutely-positioned child:
 * inside a dialog the scrolling body (`overflow-y-auto`) clipped the list and grew the dialog's
 * scrollbar. An overlay renders in the CDK container at the end of the body, so it floats over
 * the dialog and flips above the trigger when it would run past the viewport.
 */
@Component({
  selector: 'app-select',
  standalone: true,
  imports: [OverlayModule, AppIconComponent],
  template: `
    <!-- Trigger -->
    <button
      #trigger
      type="button"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      class="h-8 w-full rounded-md border border-border bg-background px-3 text-[14px] text-foreground flex items-center justify-between cursor-pointer hover:bg-gutter/50 transition-colors"
      (click)="toggleOpen()"
      [disabled]="disabled()"
      [attr.aria-expanded]="isOpen()"
      aria-haspopup="listbox"
    >
      <span class="truncate text-start">{{ selectedLabel() || 'Select option' }}</span>
      <app-icon
        name="chevron-down"
        [size]="16"
        class="flex-shrink-0 text-muted-foreground"
        [style.transform]="isOpen() ? 'rotate(180deg)' : ''"
        [style.transition]="'transform 120ms ease-out'"
      ></app-icon>
    </button>

    <!-- Menu panel, floated over any scroll container the select sits in -->
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="isOpen()"
      [cdkConnectedOverlayWidth]="triggerWidth()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayViewportMargin]="8"
      (overlayOutsideClick)="isOpen.set(false)"
      (detach)="isOpen.set(false)"
    >
      <div
        role="listbox"
        class="w-full min-w-[180px] max-h-[15rem] overflow-y-auto rounded-md border border-border bg-background p-1 shadow-menu"
        [style.animation]="'scaleIn 120ms ease-out forwards'"
      >
        @for (opt of options(); track opt.value) {
          <button
            type="button"
            role="option"
            [attr.aria-selected]="value() === opt.value"
            class="w-full h-8 px-2 rounded-[4px] text-[14px] flex items-center gap-2 text-foreground hover:bg-gutter transition-colors text-start"
            [class.bg-gutter]="value() === opt.value"
            [class.text-brand]="value() === opt.value"
            [class.font-medium]="value() === opt.value"
            (click)="selectOption(opt)"
          >
            {{ opt.label }}
          </button>
        }
      </div>
    </ng-template>
  `,
  host: {
    class: 'block',
    '(document:keydown.escape)': 'onEscape()',
  },
  styles: [`
    :host {
      display: block;
      position: relative;
    }

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
export class AppSelectComponent<T = any> {
  readonly options = input.required<SelectOption<T>[]>();
  readonly value = input<T | undefined>(undefined);
  readonly valueChange = output<T>();
  readonly disabled = input(false);

  readonly isOpen = signal(false);

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  /** Matches the panel to the trigger, remeasured each time it opens. */
  readonly triggerWidth = signal<number>(0);

  /** Below the trigger by default; flips above when the viewport runs out. */
  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  readonly selectedLabel = computed(() => {
    const opt = this.options().find((o) => o.value === this.value());
    return opt?.label ?? '';
  });

  toggleOpen(): void {
    if (this.disabled()) return;
    if (!this.isOpen()) {
      this.triggerWidth.set(this.trigger()?.nativeElement.offsetWidth ?? 0);
    }
    this.isOpen.update((v) => !v);
  }

  selectOption(opt: SelectOption<T>): void {
    this.valueChange.emit(opt.value);
    this.isOpen.set(false);
  }

  onEscape(): void {
    if (this.isOpen()) this.isOpen.set(false);
  }
}
