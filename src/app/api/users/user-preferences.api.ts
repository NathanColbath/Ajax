import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { SessionService } from '../../core/auth/session.service';
import { DEFAULT_DASHBOARD_SECTION_ORDER } from '../../core/layout/dashboard-sections';
import { UpdateUserPreferencesRequest, UserPreferences } from './user-preferences.models';

const defaultPrefs = (): UserPreferences => ({
  dashboardSectionOrder: [...DEFAULT_DASHBOARD_SECTION_ORDER],
  dashboardHidden: [],
  navMorePaths: [],
});

@Injectable({ providedIn: 'root' })
export class UserPreferencesApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private readonly session = inject(SessionService);
  /** Mock in-memory store keyed by user id. */
  private readonly mockStore = new Map<string, UserPreferences>();

  get(): Observable<UserPreferences> {
    if (this.mode.isMock()) {
      const id = this.session.userId() ?? 'u1';
      const stored = this.mockStore.get(id) ?? defaultPrefs();
      return mockDelay(structuredClone(stored));
    }
    return this.http.get<UserPreferences>('/users/me/preferences');
  }

  update(request: UpdateUserPreferencesRequest): Observable<UserPreferences> {
    if (this.mode.isMock()) {
      const id = this.session.userId() ?? 'u1';
      const current = this.mockStore.get(id) ?? defaultPrefs();
      const next: UserPreferences = {
        dashboardSectionOrder: request.dashboardSectionOrder ?? current.dashboardSectionOrder,
        dashboardHidden: request.dashboardHidden ?? current.dashboardHidden,
        navMorePaths: request.navMorePaths ?? current.navMorePaths,
      };
      this.mockStore.set(id, next);
      return mockDelay(structuredClone(next), 200);
    }
    return this.http.put<UserPreferences>('/users/me/preferences', request);
  }
}
