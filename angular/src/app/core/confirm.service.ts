import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { map, type Observable } from 'rxjs';
import type { ConfirmData } from '../shared/confirm-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

/**
 * One-line confirm-dialog opener, matching React/Vue's `await confirm({...})` ergonomics.
 * `MatDialog` is already Angular's app-root-mounted singleton overlay service — this just
 * shrinks the call site down from the 6-line `dialog.open(ConfirmDialogComponent, {data:
 * {...}}).afterClosed().subscribe(...)` pattern repeated at every call site today.
 *
 *   constructor() { private confirm = inject(ConfirmService); }
 *   this.confirm.confirm({ message: '...', confirmColor: 'danger' }).subscribe(ok => { ... });
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  confirm(data: ConfirmData): Observable<boolean> {
    return this.dialog
      .open(ConfirmDialogComponent, { data })
      .afterClosed()
      .pipe(map((result) => result === true));
  }
}
