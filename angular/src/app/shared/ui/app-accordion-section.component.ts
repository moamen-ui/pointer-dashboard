import { Component, input } from '@angular/core';
import { AppIconComponent } from './app-icon.component';

@Component({
  selector: 'app-accordion-section',
  // A custom element defaults to display:inline, which drops vertical margins from
  // `space-y-*` and breaks width; blockify the host.
  host: { class: 'block' },
  standalone: true,
  imports: [AppIconComponent],
  template: `
    <details [open]="defaultOpen()" class="group rounded-md border border-border bg-background">
      <summary
        class="flex cursor-pointer list-none items-center gap-2 h-11 px-4 text-[14px] font-medium [&::-webkit-details-marker]:hidden hover:bg-gutter transition-colors"
      >
        <span class="flex flex-1 items-center gap-2">{{ title() }}</span>
        <app-icon
          name="chevron-down"
          [size]="16"
          class="shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180"
        />
      </summary>
      <div class="flex flex-col gap-4 border-t border-border-muted px-4 pb-4 pt-1">
        <ng-content></ng-content>
      </div>
    </details>
  `,
})
export class AppAccordionSectionComponent {
  readonly title = input('');
  readonly defaultOpen = input(false);
}
