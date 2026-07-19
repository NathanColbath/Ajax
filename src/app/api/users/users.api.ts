import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { MOCK_USERS } from './users.mock';
import { LibraryUser, UserRole } from './users.models';

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private store = MOCK_USERS.map((u) => ({ ...u }));

  list(): Observable<LibraryUser[]> {
    if (this.mode.isMock()) {
      return mockDelay([...this.store]);
    }
    return this.http.get<LibraryUser[]>('/users');
  }

  toggleEnabled(id: string): Observable<LibraryUser> {
    if (this.mode.isMock()) {
      const user = this.store.find((u) => u.id === id);
      if (!user) {
        return throwError(() => new Error('User not found'));
      }
      user.enabled = !user.enabled;
      return mockDelay({ ...user }, 180);
    }
    return this.http.post<LibraryUser>(`/users/${id}/toggle`);
  }

  invite(name: string, email: string, role: UserRole): Observable<LibraryUser> {
    if (this.mode.isMock()) {
      const created: LibraryUser = {
        id: `u${Date.now()}`,
        name,
        email,
        role,
        enabled: true,
        initials: name
          .split(' ')
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
      };
      this.store = [created, ...this.store];
      return mockDelay(created, 300);
    }
    return this.http.post<LibraryUser>('/users', { name, email, role });
  }
}
