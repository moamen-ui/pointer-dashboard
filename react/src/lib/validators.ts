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

/** Trimmed length within [min, max], inclusive — DB-13's impersonation reason (10–500 chars,
 *  `StartImpersonationValidator`) is the first caller; kept generic since any free-text field
 *  with a server-enforced range needs the same shape. */
export function lengthRangeError(value: string, min: number, max: number, t: TFunction): string {
  const len = value.trim().length;
  if (len === 0) return t('common.fieldRequired');
  if (len < min) return t('common.minLength', { min });
  if (len > max) return t('common.maxLength', { max });
  return '';
}

/**
 * Case-insensitive, trimmed duplicate check against a list of existing names — client-side
 * uniqueness prevention only (comment #191); the API/DB is the real source of truth for
 * uniqueness and is out of scope here. `excludeCurrent` lets a rename compare against every
 * OTHER name without flagging the record's own unchanged name as a collision with itself.
 */
export function duplicateNameError(
  value: string,
  existingNames: (string | null | undefined)[],
  t: TFunction,
  errorKey: string,
  excludeCurrent?: string | null,
): string {
  const v = value.trim().toLowerCase();
  if (!v) return '';
  const exclude = excludeCurrent?.trim().toLowerCase();
  if (exclude && v === exclude) return '';
  const taken = existingNames.some((n) => (n ?? '').trim().toLowerCase() === v);
  return taken ? t(errorKey) : '';
}
