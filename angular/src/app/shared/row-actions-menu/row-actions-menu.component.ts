import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SeverityDirective } from '../severity.directive';
import type { Severity } from '../severity';

export interface RowActionItem {
  label: string;
  /** Material icon ligature name. */
  icon?: string;
  severity?: Severity;
  disabled?: boolean;
  /** Shown on the item when `disabled` (e.g. "requires the app URL to be set"). */
  tooltip?: string;
  onClick: () => void;
}

/**
 * The kebab-menu trigger + item list every table's "Actions" column renders. Pass the row's
 * *already permission/feature-gated* item list — this component only owns menu chrome/styling,
 * never business rules about which items exist:
 *
 *   <app-row-actions-menu [items]="actionsFor(row)" [ariaLabel]="'roles.actions' | transloco" />
 */
@Component({
  selector: 'app-row-actions-menu',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, SeverityDirective],
  template: `
    @if (items().length > 0) {
      <button mat-icon-button [matMenuTriggerFor]="menu" [attr.aria-label]="ariaLabel()">
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        @for (item of items(); track $index) {
          <!-- Wrapped in a span: Chromium/Safari send no pointer events to disabled native
               buttons, so matTooltip on the button itself would never fire — this is Material's
               own documented workaround for tooltips on disabled controls. -->
          <span
            [matTooltip]="item.tooltip ?? ''"
            [matTooltipDisabled]="!item.disabled || !item.tooltip"
          >
            <button
              mat-menu-item
              [appSeverity]="item.severity ?? 'neutral'"
              [disabled]="!!item.disabled"
              (click)="item.onClick()"
            >
              @if (item.icon) {
                <mat-icon [appSeverity]="item.severity ?? 'neutral'">{{ item.icon }}</mat-icon>
              }
              {{ item.label }}
            </button>
          </span>
        }
      </mat-menu>
    }
  `,
})
export class RowActionsMenuComponent {
  readonly items = input.required<RowActionItem[]>();
  /** Required (not defaulted) so a caller can't accidentally ship an untranslated "Actions". */
  readonly ariaLabel = input.required<string>();
}
