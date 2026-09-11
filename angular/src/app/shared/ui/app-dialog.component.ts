import { Component, Directive, TemplateRef, contentChild, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/**
 * Marks an `<ng-template appDialogBody>` as the dialog's body slot.
 * Use as: <ng-template appDialogBody> ... </ng-template>
 */
@Directive({ selector: 'ng-template[appDialogBody]', standalone: true })
export class AppDialogBodyDirective {}

/**
 * Marks an `<ng-template appDialogFooter>` as the dialog's footer slot.
 * Use as: <ng-template appDialogFooter> ... </ng-template>
 */
@Directive({ selector: 'ng-template[appDialogFooter]', standalone: true })
export class AppDialogFooterDirective {}

/**
 * Dialog shell: header (title + optional description), an optional body template and an optional
 * footer template, projected by ref so pages keep their own markup inline.
 *
 * The body/footer slots are matched by the `appDialogBody`/`appDialogFooter` attribute directives
 * above (content-query by directive type, `read: TemplateRef`) — not by a template reference
 * variable, since `<ng-template appDialogBody>` has no `#appDialogBody` ref for `contentChild()`'s
 * string-locator form to find. Any consumer template using these attributes must import the two
 * directives itself (standalone components only resolve selectors they import).
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

  readonly bodyTemplate = contentChild(AppDialogBodyDirective, { read: TemplateRef });
  readonly footerTemplate = contentChild(AppDialogFooterDirective, { read: TemplateRef });
}
