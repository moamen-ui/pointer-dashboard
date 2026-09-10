import { Injectable, TemplateRef, Type, inject } from '@angular/core';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Observable } from 'rxjs';

export interface AppDialogOptions {
  /** Data injected into a component dialog (`inject(DIALOG_DATA)`) or exposed to a template as `$implicit`. */
  data?: unknown;
  /** Panel width utility (default: the §3 dialog width). */
  width?: string;
  /** Prevent closing on backdrop click / Escape (default: false). */
  disableClose?: boolean;
}

/**
 * Dialog opener on CDK Dialog with the design-system panel (§3): 520px, hairline, shadow-dialog,
 * `bg-overlay` backdrop. Accepts a component or a `TemplateRef` (pages keep their inline
 * `<ng-template #renameDialog>` dialogs and call `openRef(this.renameDialog())`).
 *
 *   this.appDialog.open(MyComponent, { data }).subscribe(result => …);        // result stream
 *   const ref = this.appDialog.openRef(this.tpl()); ref.close(value);          // programmatic close
 */
@Injectable({ providedIn: 'root' })
export class AppDialogService {
  private readonly dialog = inject(Dialog);

  /** Open a dialog and return its CDK `DialogRef` (close it with `ref.close(result)`). */
  openRef<T, R = unknown>(content: Type<T> | TemplateRef<T>, options: AppDialogOptions = {}): DialogRef<R, T> {
    const { data, width = 'w-[min(520px,calc(100vw-32px))]', disableClose = false } = options;
    return this.dialog.open<R, unknown, T>(content, {
      data,
      disableClose,
      backdropClass: 'bg-overlay',
      panelClass: [width, 'rounded-lg', 'border', 'border-border', 'bg-background', 'shadow-dialog', 'app-dialog-panel'],
    });
  }

  /** Open a dialog and emit its result once it closes. */
  open<T, R = unknown>(content: Type<T> | TemplateRef<T>, options: AppDialogOptions = {}): Observable<R | undefined> {
    return this.openRef<T, R>(content, options).closed;
  }

  /** Close every open dialog (used on sign-out). */
  closeAll(): void {
    this.dialog.closeAll();
  }
}
