import { Injectable, inject } from '@angular/core';
import { Observable, tap, throwError } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { SessionService } from '../../core/auth/session.service';
import { MOCK_USERS } from '../users/users.mock';
import { AuthSession, LoginRequest } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private readonly session = inject(SessionService);

  login(request: LoginRequest): Observable<AuthSession> {
    if (this.mode.isMock()) {
      if (!request.username.trim() || !request.password.trim()) {
        return throwError(() => new Error('Username and password are required'));
      }
      const match = MOCK_USERS.find(
        (u) =>
          u.enabled &&
          (u.email.toLowerCase() === request.username.trim().toLowerCase() ||
            u.name.toLowerCase() === request.username.trim().toLowerCase()),
      );
      const auth: AuthSession = match
        ? { userId: match.id, displayName: match.name, role: match.role }
        : {
            userId: 'u1',
            displayName: request.username.trim(),
            role: 'super_admin',
          };
      return mockDelay(auth, 450).pipe(tap((s) => this.session.setSession(s)));
    }
    return this.http.post<AuthSession>('/auth/login', request).pipe(tap((s) => this.session.setSession(s)));
  }

  /** Returns the Auth0-backed session if present; does not bootstrap a mock user. */
  current(): Observable<AuthSession | null> {
    if (this.mode.isMock()) {
      return mockDelay(this.session.session(), 80);
    }
    return this.http.get<AuthSession | null>('/auth/me').pipe(
      tap((s) => {
        if (s) {
          this.session.setSession(s);
        }
      }),
    );
  }

  logout(): void {
    this.session.clear();
  }
}
