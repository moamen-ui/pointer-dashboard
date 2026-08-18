import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { HttpClient } from '@angular/common/http';
import { apiInterceptor } from './auth.interceptor';
import { provideRouter, Router } from '@angular/router';
import { provideTransloco, TranslocoTestingModule } from '@jsverse/transloco';
import { AuthService } from './auth.service';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('apiInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(async () => {
    localStorageMock.clear();
    await TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { en: {} } })],
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
    localStorageMock.clear();
  });

  it('adds Authorization header when token is in localStorage', () => {
    localStorageMock.setItem('pointer_admin_token', 'test-jwt-token');

    http.get('/api/test').subscribe();

    const req = controller.expectOne('http://localhost:8090/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt-token');
    req.flush({ isSuccess: true, message: null, data: {} });
  });

  it('does not add Authorization header when no token in localStorage', () => {
    http.get('/api/test').subscribe();

    const req = controller.expectOne('http://localhost:8090/api/test');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ isSuccess: true, message: null, data: {} });
  });

  it('unwraps Result envelope and returns data', async () => {
    const result = new Promise<{ name: string }>((resolve, reject) => {
      http.get<{ name: string }>('/api/test').subscribe({ next: resolve, error: reject });
    });

    const req = controller.expectOne('http://localhost:8090/api/test');
    req.flush({ isSuccess: true, message: null, data: { name: 'hello' } });

    await expect(result).resolves.toEqual({ name: 'hello' });
  });

  it('throws when envelope isSuccess is false', async () => {
    const result = new Promise((resolve, reject) => {
      http.get('/api/test').subscribe({ next: resolve, error: reject });
    });

    const req = controller.expectOne('http://localhost:8090/api/test');
    req.flush({ isSuccess: false, message: 'Something went wrong', data: null });

    await expect(result).rejects.toThrow('Something went wrong');
  });

  // Regression: an expired session used to leave the app believing it was still
  // authenticated — the interceptor cleared localStorage but not AuthService's
  // in-memory state, and isAuthenticated() is a cached computed, so guards and
  // LoginComponent bounced the user straight back into the shell. That produced
  // an endless 401 → navigate → cancelled → re-enter → 401 loop that crashed
  // the page. See the tests below.
  describe('401 handling', () => {
    function seedSession(): AuthService {
      localStorageMock.setItem('pointer_admin_token', 'expired-token');
      localStorageMock.setItem(
        'pointer_admin_user',
        JSON.stringify({ id: 1, email: 'a@b.c', isAdmin: true }),
      );
      const auth = TestBed.inject(AuthService);
      expect(auth.isAuthenticated()).toBe(true); // cache the computed, as the guards do
      return auth;
    }

    it('clears the in-memory session so isAuthenticated() flips to false', async () => {
      const auth = seedSession();

      const result = new Promise((resolve, reject) => {
        http.get('/api/admin/stats').subscribe({ next: resolve, error: reject });
      });
      controller.expectOne('http://localhost:8090/api/admin/stats').flush(
        { isSuccess: false, message: 'Unauthorized', data: null },
        { status: 401, statusText: 'Unauthorized' },
      );
      await expect(result).rejects.toBeDefined();

      expect(localStorageMock.getItem('pointer_admin_token')).toBeNull();
      expect(auth.user()).toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('redirects to /login once, not once per failed request', async () => {
      seedSession();
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigateByUrl');

      const urls = ['/api/admin/stats', '/api/admin/roles', '/api/admin/users'];
      const results = urls.map(
        (url) =>
          new Promise((resolve, reject) => {
            http.get(url).subscribe({ next: resolve, error: reject });
          }),
      );
      for (const url of urls) {
        controller.expectOne('http://localhost:8090' + url).flush(
          { isSuccess: false, message: 'Unauthorized', data: null },
          { status: 401, statusText: 'Unauthorized' },
        );
      }
      await Promise.all(results.map((r) => r.catch(() => undefined)));

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith('/login');
    });
  });
});
