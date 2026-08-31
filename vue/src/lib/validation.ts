// Shared field validators for the FormField-wrapped auth/password forms.
// Same semantics as the Angular reference's Validators.email — a pragmatic
// shape check (local@domain.tld), not full RFC 5322.
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
