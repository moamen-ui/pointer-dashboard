/**
 * Shared project utilities for slugifying project keys and validating them.
 * Matches CreateProjectValidator on the API.
 */

export const KEY_PATTERN = /^[a-z0-9-]+$/;
export const KEY_MAX_LENGTH = 64;

export function normalizeKey(value: string): string {
  return value.toLowerCase().trim();
}

const ARABIC_MAP: Record<string, string> = {
  'ء': 'a', 'آ': 'a', 'أ': 'a', 'ؤ': 'w', 'إ': 'a', 'ئ': 'y', 'ا': 'a', 'ب': 'b',
  'ة': 'h', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
  'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
  'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ى': 'a', 'ي': 'y',
  'پ': 'p', 'چ': 'ch', 'ژ': 'zh', 'ک': 'k', 'گ': 'g', 'ی': 'y',
};

function asciiDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

export function slugifyKey(name: string): string {
  const latin = asciiDigits(name.toLowerCase())
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[\u0621-\u06FF]/g, (ch) => ARABIC_MAP[ch] ?? ' ');

  return latin
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, KEY_MAX_LENGTH)
    .replace(/-+$/g, '');
}

export type KeyError = 'keyRequired' | 'keyPattern' | 'keyMaxLength' | 'keyTaken';

export function keyErrorFor(
  value: string,
  existingKeys: (string | null | undefined)[],
): KeyError | null {
  const v = normalizeKey(value);
  if (!v) return 'keyRequired';
  if (!KEY_PATTERN.test(v)) return 'keyPattern';
  if (v.length > KEY_MAX_LENGTH) return 'keyMaxLength';
  if (existingKeys.some((k) => (k ?? '').toLowerCase() === v)) return 'keyTaken';
  return null;
}
