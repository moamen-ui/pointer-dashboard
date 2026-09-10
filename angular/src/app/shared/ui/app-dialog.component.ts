import { Component, contentChild, input, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/**
 * Dialog shell: header (title + optional description), an optional body template and an optional
 * footer template, projected by ref so pages keep their own markup inline.
 */
@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div class="px-5 pt-5 pb-3">
      <h2 class="text-[16px] font-semibold leading-6 text-foreground">{{ title() }}</h2>
      @if (description()) {
        <p class="text-[14px] text-muted-foreground mt-1">{{ description() }}</p>
      }
    </div>

    @if (bodyTemplate()) {
      <div class="px-5 py-2 space-y-4">
        <ng-container *ngTemplateOutlet="bodyTemplate()!"></ng-container>
      </div>
    }

    @if (footerTemplate()) {
      <div class="px-5 pb-5 pt-3 flex justify-end gap-2">
        <ng-container *ngTemplateOutlet="footerTemplate()!"></ng-container>
      </div>
    }
  `,
})
export class AppDialogComponent {
  readonly title = input('');
  readonly description = input<string | undefined>(undefined);

  readonly bodyTemplate = contentChild<TemplateRef<unknown>>('appDialogBody');
  readonly footerTemplate = contentChild<TemplateRef<unknown>>('appDialogFooter');
}

/**
 * Template reference for the dialog body section.
 * Use as: <ng-template appDialogBody> ... </ng-template>
 */
export const appDialogBody = 'appDialogBody';

/**
 * Template reference for the dialog footer section.
 * Use as: <ng-template appDialogFooter> ... </ng-template>
 */
export const appDialogFooter = 'appDialogFooter';
