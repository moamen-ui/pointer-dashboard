import { Component, input, output, signal, computed } from '@angular/core';

export interface TabItem {
  id: string | number;
  label: string;
}

/**
 * Tabs component: underline style per §3 of the build brief.
 * Underline tabs: h-9 flex gap-4 border-b border-border; tab text-[14px] text-muted-foreground pb-2 border-b-2 border-transparent -mb-px;
 * active: text-foreground border-brand font-medium.
 */
@Component({
  selector: 'app-tabs',
  // A custom element defaults to display:inline, which drops vertical margins from
  // `space-y-*` and breaks width; blockify the host.
  host: { class: 'block' },
  standalone: true,
  imports: [],
  template: `
    <div class="h-9 flex gap-4 border-b border-border overflow-x-auto">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          (click)="selectedId.set(tab.id)"
          [class.text-foreground]="selectedId() === tab.id"
          [class.text-muted-foreground]="selectedId() !== tab.id"
          [class.font-medium]="selectedId() === tab.id"
          [class.border-brand]="selectedId() === tab.id"
          [class.border-transparent]="selectedId() !== tab.id"
          class="pb-2 border-b-2 -mb-px text-[14px] transition-colors hover:text-foreground"
          [attr.aria-selected]="selectedId() === tab.id"
        >
          {{ tab.label }}
        </button>
      }
    </div>
    <ng-content></ng-content>
  `,
})
export class AppTabsComponent {
  readonly tabs = input.required<TabItem[]>();
  readonly selected = output<string | number>();

  selectedId = signal<string | number>(0);

  constructor() {
    // Initialize selectedId when tabs input changes
    import('@angular/core').then(({ effect }) => {
      effect(() => {
        const tabList = this.tabs();
        if (tabList.length > 0 && !tabList.find((t) => t.id === this.selectedId())) {
          this.selectedId.set(tabList[0].id);
        }
      });
    });
  }
}
