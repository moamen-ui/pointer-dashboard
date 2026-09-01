import { Component, computed, contentChildren, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { TabContentDirective } from './tab-content.directive';

export interface TabItem {
  value: string;
  label: string;
}

/**
 * Wraps `mat-tab-group` the way `<app-data-table>` wraps `mat-table`: this component owns
 * the real `<mat-tab-group>`/`<mat-tab>` elements in its own template and renders each tab's
 * body via `ngTemplateOutlet` from a caller-supplied `appTabContent` template — see that
 * directive's doc comment for why plain content projection into `<mat-tab-group>` doesn't
 * work here.
 *
 *   <app-tabs [tabs]="[{ value: 'code', label: 'Code' }, { value: 'ext', label: 'Extension' }]"
 *     [(activeTab)]="tab">
 *     <ng-template appTabContent="code">...</ng-template>
 *     <ng-template appTabContent="ext">...</ng-template>
 *   </app-tabs>
 */
@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule, MatTabsModule],
  template: `
    <mat-tab-group
      [selectedIndex]="selectedIndex()"
      (selectedIndexChange)="onIndexChange($event)"
      animationDuration="0ms"
    >
      @for (t of tabs(); track t.value) {
        <mat-tab [label]="t.label">
          <!-- mat-tab-group's own body padding is 0 — the top gap here is ours, not a
               piercing hack, since this div lives in our own template. -->
          <div class="pt-4">
            @if (contentFor(t.value); as tpl) {
              <ng-container [ngTemplateOutlet]="tpl" />
            }
          </div>
        </mat-tab>
      }
    </mat-tab-group>
  `,
})
export class TabsComponent {
  readonly tabs = input.required<TabItem[]>();
  readonly activeTab = input.required<string>();
  readonly activeTabChange = output<string>();

  private readonly contentTemplates = contentChildren(TabContentDirective, { descendants: true });

  readonly selectedIndex = computed(() => {
    const i = this.tabs().findIndex((t) => t.value === this.activeTab());
    return i < 0 ? 0 : i;
  });

  onIndexChange(index: number): void {
    const t = this.tabs()[index];
    if (t) this.activeTabChange.emit(t.value);
  }

  contentFor(value: string) {
    return this.contentTemplates().find((c) => c.tabValue === value)?.templateRef;
  }
}
