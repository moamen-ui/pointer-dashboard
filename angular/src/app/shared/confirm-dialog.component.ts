import { Component, computed, inject } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import type { Severity } from './severity';
import { AppDialogComponent } from './ui/app-dialog.component';
import { AppButtonDirective } from './ui/app-button.directive';

export interface ConfirmData {
  /** Dialog title (defaults to common.confirm). */
  title?: string;
  /** Body message (already-translated text). */
  message: string;
  /** Confirm button label (defaults to common.confirm). */
  confirmLabel?: string;
  /** Cancel button label (defaults to common.cancel). */
  cancelLabel?: string;
  /** Confirm button severity — the full shared vocabulary, not just Material's primary/warn. */
  confirmColor?: Severity;
}

/**
 * Reusable confirmation dialog using CDK Dialog and AppDialogComponent.
 * Prefer `ConfirmService.confirm()` over opening this directly — it wraps the same
 * `AppDialogService.open(...).closed()` call in a one-line API.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [AppDialogComponent, AppButtonDirective, TranslocoModule],
  template: `
    <app-dialog [title]="title()">
      <ng-template appDialogBody>
        <p class="m-0 min-w-80 whitespace-pre-line text-[14px]">{{ data.message }}</p>
      </ng-template>
      <ng-template appDialogFooter>
        <button
          appButton
          variant="secondary"
          size="sm"
          (click)="onCancel()"
        >
          {{ data.cancelLabel || ('common.cancel' | transloco) }}
        </button>
        <button
          appButton
          [variant]="buttonVariant()"
          size="sm"
          (click)="onConfirm()"
        >
          {{ data.confirmLabel || ('common.confirm' | transloco) }}
        </button>
      </ng-template>
    </app-dialog>
  `,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean>);
  private readonly transloco = inject(TranslocoService);

  protected readonly title = computed(() =>
    this.data.title || this.transloco.translate('common.confirm')
  );

  protected readonly buttonVariant = computed<'primary' | 'destructive'>(() => {
    const severity = this.data.confirmColor ?? 'primary';
    return severity === 'danger' ? 'destructive' : 'primary';
  });

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
