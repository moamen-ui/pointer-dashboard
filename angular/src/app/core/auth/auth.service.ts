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
  user = this._user.asReadonly();
  isAuthenticated = computed(() => !!this._user() && !!this.token());
  isAdmin = computed(() => !!this._user()?.isAdmin);
  isSuperAdmin = computed(() => !!this._user()?.isSuperAdmin);

  private readUser(): MeResponse | null {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  login(email: string, password: string): Observable<MeResponse> {
    return this.apiAuth.postApiAuthLogin<LoginResponse>({ email, password }).pipe(
      map((res) => {
        localStorage.setItem(TOKEN_KEY, res.token!);
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
    localStorage.setItem(TOKEN_KEY, token);
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
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    this.router.navigateByUrl('/login');
  }
}
