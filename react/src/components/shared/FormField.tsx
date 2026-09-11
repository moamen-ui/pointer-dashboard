// FormField — label + input + error/hint chrome as one unit, so a page can no
// longer forget to show a validation error (previously each page hand-rolled
// its own <Label>/<Input>/<p> block). The error paragraph wins over the hint
// when both are set. Pass the resolved error string in — the page owns
// validation state (touched/submitted) and error copy.
//
// `gap-2` (8px) on the flex column is the ONE place that sets the label-to-input gap and the
// input-to-hint/error gap in this app — it matches Vue's FormField.vue and Angular's
// AppFormFieldComponent exactly. Change it here (and mirror in the other two) to move the gap
// everywhere a field uses this wrapper; never add a per-field margin override in a page.
//
// Error/hint typography matches DESIGN.md's Inputs/Fields spec exactly (and Angular's
// AppFormFieldComponent): 12px hint in muted-foreground, 12px error in state-danger (the fixed
// diff hue, not the `destructive` button token — they are different hexes) with a 12px alert
// glyph. Every field of every control type routes through this wrapper; a hand-rolled label next
// to a control is a bug, not a customization.
import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, hint, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-[12px] text-state-danger flex items-center gap-1">
          <CircleAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
