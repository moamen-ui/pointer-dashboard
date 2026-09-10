import { Component, forwardRef, model } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-checkbox',
  standalone: true,
  template: `
    <input
      type="checkbox"
      class="sr-only"
      [checked]="checked()"
      [disabled]="disabled()"
      (change)="handleCheck($event)"
      #checkboxInput
    />
    <label class="inline-flex items-center gap-2 cursor-pointer">
      <span
        class="w-4 h-4 rounded border border-border bg-background flex items-center justify-center transition-colors"
        [class.bg-brand]="checked()"
        [class.border-brand]="checked()"
      >
        @if (checked()) {
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        }
      </span>
      <ng-content></ng-content>
    </label>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppCheckboxComponent),
      multi: true,
    },
  ],
})
export class AppCheckboxComponent implements ControlValueAccessor {
  readonly checked = model(false);
  readonly disabled = model(false);

  private onChangeCallback: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: unknown): void {
    this.checked.set(!!value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChangeCallback = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  handleCheck(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.checked.set(target.checked);
    this.onChangeCallback(target.checked);
    this.onTouched();
  }
}
