/** Mirrors CreateProjectValidator on the API: lowercase letters, digits, dot,
 *  underscore, hyphen — nothing else. */
export const KEY_PATTERN = /^[a-z0-9-]+$/;

/** Mirrors the projects.key column (character varying(64)). */
export const KEY_MAX_LENGTH = 64;

/**
 * Arabic → Latin transliteration map for generating clean ASCII project keys.
 */
export const ARABIC_MAP: Record<string, string> = {
  'ء': 'a', 'آ': 'a', 'أ': 'a', 'ؤ': 'w', 'إ': 'a', 'ئ': 'y', 'ا': 'a', 'ب': 'b',
  'ة': 'h', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
  'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
  'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ى': 'a', 'ي': 'y',
  'پ': 'p', 'چ': 'ch', 'ژ': 'zh', 'ک': 'k', 'گ': 'g', 'ی': 'y',
};

/** Arabic-Indic and extended Arabic-Indic digits → ASCII. */
export function asciiDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

/**
 * Turns a project name into a valid API key: `^[a-z0-9-]+$`, up to KEY_MAX_LENGTH chars.
 */
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
