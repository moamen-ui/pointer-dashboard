import { Component, forwardRef, model } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Switch: 32×18 track that fills with the brand when on, 14px knob.
 *
 * `checked` and `disabled` are two-way `model()` signals rather than input/output pairs, because the
 * ControlValueAccessor hooks (`writeValue`, `setDisabledState`) have to write them; `[checked]` plus
 * `(checkedChange)` still work for callers that don't use a form control.
 */
@Component({
  selector: 'app-switch',
  standalone: true,
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      [disabled]="disabled()"
      class="w-8 h-4.5 rounded-full transition-colors"
      [class.bg-brand]="checked()"
      [class.bg-gutter-strong]="!checked()"
      (click)="toggle()"
    >
      <span
        class="block w-3.5 h-3.5 rounded-full bg-white transition-all"
        [class.translate-x-4]="checked()"
        [class.translate-x-0.5]="!checked()"
      ></span>
    </button>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppSwitchComponent),
      multi: true,
    },
  ],
})
export class AppSwitchComponent implements ControlValueAccessor {
  readonly checked = model(false);
  readonly disabled = model(false);

  private onChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: unknown): void {
    this.checked.set(!!value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  toggle(): void {
    if (this.disabled()) return;
    const next = !this.checked();
    this.checked.set(next);
    this.onChange(next);
    this.onTouched();
  }
}
