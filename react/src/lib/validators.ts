// Field validators mirroring the Angular app's Validators.required /
// Validators.email / Validators.minLength semantics, resolving to the same
// common.* error copy. Return an empty string when the field is valid.
import type { TFunction } from 'i18next';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requiredError(value: string, t: TFunction): string {
  return value.trim() ? '' : t('common.fieldRequired');
}

export function emailError(value: string, t: TFunction): string {
  const v = value.trim();
  if (!v) return t('common.fieldRequired');
  if (!EMAIL_RE.test(v)) return t('common.invalidEmail');
  return '';
}

export function passwordError(value: string, minLength: number, t: TFunction): string {
  if (!value) return t('common.fieldRequired');
  if (value.length < minLength) return t('common.passwordMinLength', { min: minLength });
  return '';
}
