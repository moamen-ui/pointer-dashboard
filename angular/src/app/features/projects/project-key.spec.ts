// The project key contract, mirrored from the API (CreateProjectValidator +
// the projects.key column). These assertions are what the form enforces so a
// bad key is caught before it becomes a raw 400/409 from the server.
// Imported, not re-declared: a local copy of the pattern silently drifted from the
// component when the contract narrowed to letters/digits/dashes.
import { KEY_MAX_LENGTH, KEY_PATTERN, slugifyKey } from './projects.component';

/** What the form does to the typed value before validating/sending it. */
function normalize(value: string): string {
  return value.toLowerCase().trim();
}

describe('project key rules', () => {
  it('accepts lowercase letters, digits and dashes', () => {
    for (const key of ['app', 'my-app', 'a1', 'a-b-c-d9', 'pointer-dashboard']) {
      expect(KEY_PATTERN.test(key)).toBe(true);
    }
  });

  it('rejects everything the API rejects', () => {
    // Dots and underscores are no longer part of the contract.
    for (const key of ['My-App', 'my app', 'my/app', 'app!', 'my.app', 'my_app', 'ünïcode', 'مشروع', '']) {
      expect(KEY_PATTERN.test(key)).toBe(false);
    }
  });

  it('normalises the typed value into the accepted shape', () => {
    // The API validates the raw value, so an uppercase key 400s even though the
    // service would have stored it lowercased — normalising avoids that trap.
    expect(normalize('  My-App  ')).toBe('my-app');
    expect(KEY_PATTERN.test(normalize('  My-App  '))).toBe(true);
  });

  it('does not normalise away characters the API still rejects', () => {
    expect(KEY_PATTERN.test(normalize('my app'))).toBe(false);
  });

  it('caps the key at the column length', () => {
    expect('a'.repeat(KEY_MAX_LENGTH).length).toBeLessThanOrEqual(KEY_MAX_LENGTH);
    expect('a'.repeat(KEY_MAX_LENGTH + 1).length).toBeGreaterThan(KEY_MAX_LENGTH);
  });

  it('treats an existing key as taken regardless of case or padding', () => {
    const existing = ['my-app', 'other'];
    const isTaken = (v: string) => existing.includes(normalize(v));
    expect(isTaken(' MY-APP ')).toBe(true);
    expect(isTaken('my-app2')).toBe(false);
  });
});

// #138 — the key is derived from the project name, so the slug must land inside the
// same contract the form validates against.

describe('slugifyKey', () => {
  it('turns a normal project name into a valid key', () => {
    expect(slugifyKey('My New App')).toBe('my-new-app');
    expect(KEY_PATTERN.test(slugifyKey('My New App'))).toBe(true);
  });

  it('collapses a run of separators into a single hyphen', () => {
    // Reported: "…name . sdf _fsdfsfsdf…" produced "…name-.-sdf-_fsdfsfsdf…".
    expect(slugifyKey('Moamen new project name . sdf _fsdfsfsdf.dsgdfg'))
      .toBe('moamen-new-project-name-sdf-fsdfsfsdf-dsgdfg');
    expect(slugifyKey('Acme  ///  Portal!!')).toBe('acme-portal');
  });

  it('turns dots and underscores into dashes, like every other separator', () => {
    expect(slugifyKey('web.app_v2-beta')).toBe('web-app-v2-beta');
  });

  it('trims leading and trailing separators', () => {
    expect(slugifyKey('  --Hello--  ')).toBe('hello');
  });

  it('transliterates Arabic instead of leaving the key empty', () => {
    // Most of this product's users name projects in Arabic; dropping the letters
    // left them with nothing to submit.
    expect(slugifyKey('مشروع جديد')).toBe('mshrwa-jdyd');
    expect(KEY_PATTERN.test(slugifyKey('مشروع جديد'))).toBe(true);
  });

  it('converts Arabic-Indic digits to ASCII', () => {
    expect(slugifyKey('مشروع ٢٠٢٦ للتجربة')).toBe('mshrwa-2026-lltjrbh');
  });

  it('never exceeds the column length, and never ends on a separator', () => {
    const long = slugifyKey('اسم مشروع طويل جدا جدا جدا جدا جدا جدا جدا جدا جدا جدا جدا جدا جدا');
    expect(long.length).toBeLessThanOrEqual(KEY_MAX_LENGTH);
    expect(long.endsWith('-')).toBe(false);
    expect(slugifyKey('a'.repeat(200)).length).toBe(KEY_MAX_LENGTH);
  });

  it('returns empty when nothing transliterable is left, rather than junk', () => {
    // The field is still required, so the user is prompted to type one.
    expect(slugifyKey('🎉🎉')).toBe('');
  });

  it('produces a key the form accepts for typical names', () => {
    for (const name of ['Pointer Dashboard', 'clubs-api', 'Tuwaiq Permit 2026', 'مشروع تجريبي']) {
      const slug = slugifyKey(name);
      expect(KEY_PATTERN.test(slug)).toBe(true);
      expect(slug.length).toBeLessThanOrEqual(KEY_MAX_LENGTH);
    }
  });
});
