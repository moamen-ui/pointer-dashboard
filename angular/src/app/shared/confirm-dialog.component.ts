import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import type { Severity } from './severity';

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
 * Reusable Material confirmation dialog. Prefer `ConfirmService.confirm()` over opening this
 * directly — it wraps the same `MatDialog.open(...).afterClosed()` call in a one-line API.
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
      <button
        mat-flat-button
        [color]="materialColor()"
        [class]="tintClass()"
        [mat-dialog-close]="true"
      >
        {{ data.confirmLabel || ('common.confirm' | transloco) }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);

  /** Material only has native primary/warn button roles — everything else falls back to a
   *  Tailwind background tint via `tintClass()` instead. */
  protected readonly materialColor = computed<'primary' | 'warn' | undefined>(() => {
    const severity = this.data.confirmColor ?? 'primary';
    return severity === 'danger' ? 'warn' : severity === 'primary' ? 'primary' : undefined;
  });

  protected readonly tintClass = computed(() => {
    const severity = this.data.confirmColor ?? 'primary';
    if (severity === 'success') return 'confirm-btn-success';
    if (severity === 'warning') return 'confirm-btn-warning';
    return '';
  });
}
