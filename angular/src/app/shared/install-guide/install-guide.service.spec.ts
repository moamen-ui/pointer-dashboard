import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { InstallGuideService } from './install-guide.service';

// The unit-test environment has no DOM storage; the service reads both, so stand
// in with in-memory equivalents (same approach as auth.interceptor.spec.ts).
function memoryStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  } as Storage;
}

Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), writable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), writable: true });

describe('InstallGuideService.shouldAutoOpen', () => {
  let guide: InstallGuideService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    guide = TestBed.inject(InstallGuideService);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const admin = { isAdmin: true, userId: 7, commentsCount: 12 };

  it('opens for an admin who has not seen it yet, even with comments', () => {
    expect(guide.shouldAutoOpen(admin)).toBe(true);
  });

  it('opens for an admin with no comments yet, even after a previous session', () => {
    guide.markShown(7);
    sessionStorage.clear(); // a new browser session
    expect(guide.shouldAutoOpen({ ...admin, commentsCount: 0 })).toBe(true);
  });

  it('stops opening once seen and comments exist', () => {
    guide.markShown(7);
    sessionStorage.clear();
    expect(guide.shouldAutoOpen(admin)).toBe(false);
  });

  it('never opens again after "don\'t show again", comments or not', () => {
    guide.suppress(7);
    expect(guide.shouldAutoOpen({ ...admin, commentsCount: 0 })).toBe(false);
  });

  it('re-enables after unsuppressing', () => {
    guide.suppress(7);
    guide.unsuppress(7);
    expect(guide.shouldAutoOpen({ ...admin, commentsCount: 0 })).toBe(true);
  });

  it('opens at most once per browser session', () => {
    expect(guide.shouldAutoOpen(admin)).toBe(true);
    guide.markShown(7);
    expect(guide.shouldAutoOpen(admin)).toBe(false);
  });

  it('never opens for a non-admin', () => {
    expect(guide.shouldAutoOpen({ ...admin, isAdmin: false, commentsCount: 0 })).toBe(false);
  });

  it('never opens without a user id', () => {
    expect(guide.shouldAutoOpen({ ...admin, userId: null, commentsCount: 0 })).toBe(false);
  });
});
