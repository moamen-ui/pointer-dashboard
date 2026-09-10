import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type { ConfirmData } from '../shared/confirm-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { AppDialogService } from '../shared/ui/app-dialog.service';

/**
 * One-line confirm-dialog opener, matching React/Vue's `await confirm({...})` ergonomics.
 * Uses AppDialogService (CDK Dialog) to open the ConfirmDialogComponent — this shrinks the call
 * site down from the repeated `dialog.open(ConfirmDialogComponent, {...}).closed` pattern.
 *
 *   constructor() { private confirm = inject(ConfirmService); }
 *   this.confirm.confirm({ message: '...', confirmColor: 'danger' }).subscribe((ok: boolean) => { ... });
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly appDialog = inject(AppDialogService);

  confirm(data: ConfirmData): Observable<boolean> {
    return this.appDialog
      .open<ConfirmDialogComponent, boolean>(ConfirmDialogComponent, { data })
      .pipe(map((result: boolean | undefined) => result === true));
  }
}
