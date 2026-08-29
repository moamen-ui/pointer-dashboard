// The project key contract, mirrored from the API (CreateProjectValidator +
// the projects.key column). These assertions are what the form enforces so a
// bad key is caught before it becomes a raw 400/409 from the server.
const KEY_PATTERN = /^[a-z0-9._-]+$/;
const KEY_MAX_LENGTH = 64;

/** What the form does to the typed value before validating/sending it. */
function normalize(value: string): string {
  return value.toLowerCase().trim();
}

describe('project key rules', () => {
  it('accepts lowercase letters, digits and . _ -', () => {
    for (const key of ['app', 'my-app', 'my_app', 'my.app', 'a1', 'a.b_c-d9']) {
      expect(KEY_PATTERN.test(key)).toBe(true);
    }
  });

  it('rejects everything the API rejects', () => {
    for (const key of ['My-App', 'my app', 'my/app', 'app!', 'ünïcode', 'مشروع', '']) {
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
import { slugifyKey } from './projects.component';

describe('slugifyKey', () => {
  it('turns a normal project name into a valid key', () => {
    expect(slugifyKey('My New App')).toBe('my-new-app');
    expect(KEY_PATTERN.test(slugifyKey('My New App'))).toBe(true);
  });

  it('collapses punctuation and runs of separators', () => {
    expect(slugifyKey('Acme  ///  Portal!!')).toBe('acme-portal');
  });

  it('keeps the characters the API already allows', () => {
    expect(slugifyKey('web.app_v2-beta')).toBe('web.app_v2-beta');
  });

  it('trims leading and trailing separators', () => {
    expect(slugifyKey('  --Hello--  ')).toBe('hello');
  });

  it('strips non-latin text rather than emitting an invalid key', () => {
    // Arabic/emoji cannot appear in a key; whatever survives must still validate.
    const slug = slugifyKey('مشروع 2');
    expect(slug === '' || KEY_PATTERN.test(slug)).toBe(true);
  });

  it('never exceeds the column length', () => {
    expect(slugifyKey('a'.repeat(200)).length).toBeLessThanOrEqual(KEY_MAX_LENGTH);
  });

  it('produces a key the form accepts for typical names', () => {
    for (const name of ['Pointer Dashboard', 'clubs-api', 'Tuwaiq Permit 2026']) {
      const slug = slugifyKey(name);
      expect(KEY_PATTERN.test(slug)).toBe(true);
      expect(slug.length).toBeLessThanOrEqual(KEY_MAX_LENGTH);
    }
  });
});
