import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';

export interface ConfirmData {
  /** Dialog title (defaults to common.confirm). */
  title?: string;
  /** Body message (already-translated text). */
  message: string;
  /** Confirm button label (defaults to common.confirm). */
  confirmLabel?: string;
  /** Cancel button label (defaults to common.cancel). */
  cancelLabel?: string;
  /** Confirm button color. */
  confirmColor?: 'primary' | 'warn';
}

/**
 * Reusable Material confirmation dialog. Open via MatDialog and read the result:
 *   dialog.open(ConfirmDialogComponent, { data }).afterClosed() // → true | false | undefined
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, TranslocoModule],
  template: `
    <h2 mat-dialog-title>{{ data.title || ('common.confirm' | transloco) }}</h2>
    <mat-dialog-content>
      <p class="m-0 min-w-80 whitespace-pre-line">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">
        {{ data.cancelLabel || ('common.cancel' | transloco) }}
      </button>
      <button mat-flat-button [color]="data.confirmColor || 'primary'" [mat-dialog-close]="true">
        {{ data.confirmLabel || ('common.confirm' | transloco) }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
}
