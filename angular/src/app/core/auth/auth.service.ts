import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { map, Observable } from 'rxjs';
import { AuthService as ApiAuthService } from '@moamen-ui/pointer-angular';
import { LoginResponse, MeResponse } from '@moamen-ui/pointer-angular';
import { PreferencesService } from '../prefs/preferences.service';

const TOKEN_KEY = 'pointer_admin_token';
const USER_KEY = 'pointer_admin_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiAuth = inject(ApiAuthService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private prefs = inject(PreferencesService);
  private _user = signal<MeResponse | null>(this.readUser());
  // The token is held in a signal, not read straight from localStorage on every
  // call: isAuthenticated is a computed, and a computed can only recompute when a
  // *signal* it reads changes. Reading localStorage inside it meant clearing the
  // token elsewhere (e.g. the 401 handler) left isAuthenticated cached as true —
  // guards and LoginComponent then bounced the user back into the shell, which
  // refetched, 401'd again, and looped until the page died.
  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  user = this._user.asReadonly();
  isAuthenticated = computed(() => !!this._user() && !!this._token());
  isAdmin = computed(() => !!this._user()?.isAdmin);
  isSuperAdmin = computed(() => !!this._user()?.isSuperAdmin);
  // Quick-access (e.g. "Client") accounts exist only to leave widget comments on their own
  // project — they must never reach project management or any other admin-tier dashboard surface.
  isQuickAccess = computed(() => !!this._user()?.isQuickAccess);

  private readUser(): MeResponse | null {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  token(): string | null {
    return this._token();
  }

  /** Persists the token in both localStorage and the reactive signal. */
  private setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this._token.set(token);
  }

  /**
   * Tears the session down completely — persisted *and* in-memory — so every
   * consumer of isAuthenticated() sees it immediately. Called on logout and by
   * the 401 handler; does not navigate, so callers choose where to go next.
   */
  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
  }

  login(email: string, password: string): Observable<MeResponse> {
    return this.apiAuth.postApiAuthLogin<LoginResponse>({ email, password }).pipe(
      map((res) => {
        // Guard: never persist a missing token as the string "undefined", which would read
        // back as truthy and flip isAuthenticated to a false-positive authenticated state.
        if (!res.token) throw new Error('Login response did not include a token.');
        this.setToken(res.token);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this._user.set(res.user ?? null);
        this.prefs.init(res.user ?? undefined);
        return res.user!;
      })
    );
  }

  /**
   * Establish a session from a bare token (e.g. the demo provisioning flow).
   * Mirrors login()'s post-token steps, but fetches /api/auth/me to obtain the
   * current user since the demo response carries no user object. The interceptor
   * attaches the bearer from localStorage and unwraps the response envelope.
   */
  loginWithToken(token: string): Observable<MeResponse> {
    this.setToken(token);
    return this.http.get<MeResponse>('/api/auth/me').pipe(
      map((user) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this._user.set(user ?? null);
        this.prefs.init(user ?? undefined);
        return user;
      })
    );
  }

  logout(): void {
    this.clearSession();
    this.router.navigateByUrl('/login');
  }
}
