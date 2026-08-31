import { Component, input } from '@angular/core';
import type { FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';

/**
 * Wraps `mat-form-field`'s label/hint/error chrome around a projected native control, reading
 * validation state directly off the given FormControl so a page can no longer forget to show an
 * error (previously: `mat-error` bound to `hasError()`, no error display at all, or a
 * disconnected `<p class="text-red-600">` — three different conventions across the app, plus two
 * conventions for hints). Locks in the one universal convention already found
 * (`appearance="outline"`) and defaults `subscriptSizing` to `"dynamic"` so every field gets it
 * for free instead of remembering to set it per file.
 *
 * Deliberately NOT a `computed()`-driven signal component: `FormControl.invalid`/`.touched` are
 * plain mutable properties, not signals, so error visibility is read via a plain method
 * (re-evaluated on every change-detection pass, same as `mat-error`'s own `hasError()` idiom
 * today) rather than memoized, which would go stale after the control's status changes.
 *
 *   <app-form-field [control]="form.controls.email" label="Email" hint="We'll never share it">
 *     <input matInput formControlName="email" />
 *   </app-form-field>
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [MatFormFieldModule],
  template: `
    <mat-form-field [appearance]="appearance()" [subscriptSizing]="subscriptSizing()" class="w-full">
      @if (label()) {
        <mat-label>{{ label() }}</mat-label>
      }
      <ng-content />
      @if (resolvedError()) {
        <mat-error>{{ resolvedError() }}</mat-error>
      } @else if (hint()) {
        <mat-hint>{{ hint() }}</mat-hint>
      }
    </mat-form-field>
  `,
})
export class FormFieldComponent {
  readonly control = input.required<FormControl>();
  readonly label = input('');
  readonly hint = input('');
  readonly errorMessage = input<string | ((control: FormControl) => string)>('');
  readonly appearance = input<'outline'>('outline');
  readonly subscriptSizing = input<'dynamic' | 'fixed'>('dynamic');

  protected resolvedError(): string {
    const ctrl = this.control();
    if (!ctrl.invalid || !ctrl.touched) return '';
    const msg = this.errorMessage();
    return typeof msg === 'function' ? msg(ctrl) : msg;
  }
}
