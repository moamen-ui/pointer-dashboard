import { Component, computed, effect, input, signal } from '@angular/core';
import type { FormControl } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule } from '@jsverse/transloco';

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
 * The same projection problem breaks a `matSuffix`-tagged child projected in from a *page's*
 * template too: `MatFormField`'s own `@ContentChildren(MAT_SUFFIX)` query never finds it (confirmed
 * live — no `.mat-mdc-form-field-icon-suffix` slot ever rendered, so the projected node fell
 * through to the default/infix bucket and rendered below the input instead of inline). So for
 * `type="password"` the show/hide toggle is rendered internally too, not projected — pass
 * `type="password"` and the field manages its own masked/revealed state.
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
 *     type="password" [errorMessage]="'common.fieldRequired' | transloco" />
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, ReactiveFormsModule, TranslocoModule],
  template: `
    <mat-form-field [appearance]="appearance()" [subscriptSizing]="subscriptSizing()" class="w-full">
      @if (label()) {
        <mat-label>{{ label() }}</mat-label>
      }
      <input matInput [type]="resolvedType()" [formControl]="control()" [placeholder]="placeholder()" />
      @if (type() === 'password') {
        <button
          mat-icon-button
          matSuffix
          type="button"
          (click)="toggleHidden()"
          [attr.aria-label]="(hidden() ? 'common.showPassword' : 'common.hidePassword') | transloco"
          [attr.aria-pressed]="!hidden()"
        >
          <mat-icon>{{ hidden() ? 'visibility' : 'visibility_off' }}</mat-icon>
        </button>
      }
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

  /** Masked while true — only meaningful when `type() === 'password'`. */
  readonly hidden = signal(true);
  readonly resolvedType = computed(() => (this.type() === 'password' && !this.hidden() ? 'text' : this.type()));

  toggleHidden(): void {
    this.hidden.update((v) => !v);
  }

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
