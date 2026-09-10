import { Component, input } from '@angular/core';

@Component({
  selector: 'app-form-field',
  // A custom element defaults to display:inline, which silently drops the vertical
  // margins that `space-y-*` puts on it; blockify the host so field rows keep their rhythm.
  host: { class: 'block' },
  standalone: true,
  imports: [],
  template: `
    <div class="flex flex-col">
      @if (label()) {
        <label class="text-[13px] font-medium text-foreground mb-1.5">
          {{ label() }}
          @if (required()) {
            <span class="text-[12px] text-muted-foreground ms-1">Required</span>
          }
        </label>
      }
      <ng-content></ng-content>
      @if (hint() && !error()) {
        <p class="text-[12px] text-muted-foreground mt-1.5">
          {{ hint() }}
        </p>
      }
      @if (error()) {
        <p class="text-[12px] text-state-danger mt-1.5 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {{ error() }}
        </p>
      }
    </div>
  `,
})
export class AppFormFieldComponent {
  readonly label = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly required = input(false);
}
