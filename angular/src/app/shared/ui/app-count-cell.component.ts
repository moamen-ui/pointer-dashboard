import {
  Component,
  ElementRef,
  inject,
  input,
  signal,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AppIconComponent } from './app-icon.component';

export type StateColor = 'open' | 'ready' | 'completed' | 'archived' | 'danger';

const STATE_ICONS: Record<StateColor, string> = {
  open: 'circle',
  ready: 'clock',
  completed: 'check-circle',
  archived: 'archive',
  danger: 'x-circle',
};

/** Count cell: mono tabular number in its state hue, with the state glyph only once the
 *  count is above zero. A changed count flashes its tint for 600ms. */
@Component({
  selector: 'app-count-cell',
  standalone: true,
  imports: [AppIconComponent],
  template: `
    <span
      class="inline-flex items-center gap-1 font-mono text-[14px]"
      [class.text-state-open]="state() === 'open' && count() > 0"
      [class.text-state-ready]="state() === 'ready' && count() > 0"
      [class.text-state-completed]="state() === 'completed' && count() > 0"
      [class.text-state-archived]="state() === 'archived' && count() > 0"
      [class.text-state-danger]="state() === 'danger' && count() > 0"
      [class.text-faint-foreground]="count() === 0"
      [attr.data-tour]="dataToast()"
    >
      @if (count() > 0) {
        <app-icon [name]="STATE_ICONS[state()]" [size]="12" class="flex-shrink-0"></app-icon>
      }
      <span class="tabular-nums">{{ count() }}</span>
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppCountCellComponent {
  readonly count = input(0);
  readonly state = input<StateColor>('open');
  readonly dataToast = input('');

  protected STATE_ICONS = STATE_ICONS;

  private readonly el = inject(ElementRef);
  private readonly previousCount = signal(0);

  constructor() {
    effect(() => {
      const current = this.count();
      const prev = this.previousCount();

      if (current !== prev && prev !== 0) {
        const el = this.el.nativeElement as HTMLElement;
        el.classList.add('ds-flash');
        el.style.cssText = `--flash-tint: var(--state-${this.state()}-tint)`;

        setTimeout(() => {
          el.classList.remove('ds-flash');
          el.style.cssText = '';
        }, 600);
      }

      this.previousCount.set(current);
    });
  }
}
