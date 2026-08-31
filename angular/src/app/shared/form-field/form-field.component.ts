import { Component, computed, effect, input, signal } from '@angular/core';
import type { FormControl } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/**
 * Renders `mat-form-field`'s label/input/hint/error chrome as one unit, reading validation state
 * directly off the given FormControl so a page can no longer forget to show an error (previously:
 * `mat-error` bound to `hasError()`, no error display at all, or a disconnected
 * `<p class="text-red-600">` — three different conventions across the app, plus two conventions
 * for hints). Locks in the one universal convention already found (`appearance="outline"`) and
 * defaults `subscriptSizing` to `"dynamic"` so every field gets it for free.
 *
 * NOT a pure content-projection wrapper: this component renders its own `<input matInput>`
 * internally rather than projecting one from the caller's template. `MatInput` resolves
 * `MatFormField` via dependency injection (`@Optional() @Inject(MAT_FORM_FIELD)`), and Angular's
 * DI for projected content resolves against the *declaring* template's injector, not the
 * projecting component's — so an `<input matInput>` authored in a page's template and merely
 * projected through this component's `<ng-content>` into `<mat-form-field>` can never find it
 * ("mat-form-field must contain a MatFormFieldControl", confirmed live). Only text/email/password
 * inputs are supported for now (`type`) — extend with a `controlType` input if a select/textarea
 * variant is needed later, don't force it through this same template.
 *
 * `FormControl.invalid`/`.touched` are plain mutable properties, not signals — this app is
 * zoneless (no zone.js). An `effect()` resubscribes to `control().events` and bumps a signal on
 * every event, so `resolvedError` — a real `computed()` — is correctly notified on
 * `statusChanges`/`touched` changes driven from anywhere, including an RxJS subscription's
 * `setErrors(...)` call that never touches a template-bound event handler.
 *
 *   <app-form-field [control]="form.controls.email" [label]="'login.email' | transloco" type="email" />
 *
 *   <app-form-field [control]="form.controls.password" [label]="'login.password' | transloco"
 *     [type]="pwToggle.type()" [errorMessage]="'common.fieldRequired' | transloco">
 *     <app-password-toggle matSuffix #pwToggle />
 *   </app-form-field>
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <mat-form-field [appearance]="appearance()" [subscriptSizing]="subscriptSizing()" class="w-full">
      @if (label()) {
        <mat-label>{{ label() }}</mat-label>
      }
      <input matInput [type]="type()" [formControl]="control()" [placeholder]="placeholder()" />
      <ng-content select="[matSuffix]" />
      @if (control().invalid && control().touched) {
        @if (resolvedError()) {
          <mat-error>{{ resolvedError() }}</mat-error>
        }
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
  readonly type = input('text');
  readonly placeholder = input('');

  private readonly statusTick = signal(0);

  constructor() {
    effect((onCleanup) => {
      const sub = this.control().events.subscribe(() => this.statusTick.update((v) => v + 1));
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected readonly resolvedError = computed(() => {
    this.statusTick();
    const ctrl = this.control();
    if (!ctrl.invalid || !ctrl.touched) return '';
    const msg = this.errorMessage();
    return typeof msg === 'function' ? msg(ctrl) : msg;
  });
}
