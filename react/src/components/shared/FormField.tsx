// FormField — label + input + error/hint chrome as one unit, so a page can no
// longer forget to show a validation error (previously each page hand-rolled
// its own <Label>/<Input>/<p className="text-sm text-destructive"> block).
// Renders exactly the markup pages used to write by hand; the error paragraph
// wins over the hint when both are set. Pass the resolved error string in —
// the page owns validation state (touched/submitted) and error copy.
import type { ReactNode } from 'react';
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
        <p className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
