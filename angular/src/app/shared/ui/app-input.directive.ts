import { Directive } from '@angular/core';

/** Text input: 32px, 6px radius, hairline border, canvas ground, faint-ink placeholder.
 *  Disabled is tokenized (gutter-strong fill, muted ink) rather than dimmed with opacity, and
 *  focus comes from the foundation's global `:focus-visible` outline. */
@Directive({
  selector: 'input[appInput]',
  standalone: true,
  host: {
    class:
      'h-8 w-full rounded-md border border-border bg-background px-3 text-[14px] placeholder:text-faint-foreground disabled:cursor-not-allowed disabled:bg-gutter-strong disabled:text-muted-foreground',
  },
})
export class AppInputDirective {}
