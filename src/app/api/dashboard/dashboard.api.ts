import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { SessionService } from '../../core/auth/session.service';
import { MOCK_DASHBOARDS } from './dashboard.mock';
import { DashboardSnapshot } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private readonly session = inject(SessionService);

  getSnapshot(userId?: string): Observable<DashboardSnapshot> {
    const id = userId ?? this.session.userId() ?? 'u1';
    if (this.mode.isMock()) {
      const snapshot = MOCK_DASHBOARDS[id] ?? {
        ...MOCK_DASHBOARDS['u1'],
        userId: id,
        displayName: this.session.displayName() ?? 'User',
        favorites: [],
        recent: [],
        attention: [],
        stats: {
          ...MOCK_DASHBOARDS['u1'].stats,
          myFavorites: 0,
          myDownloads: 0,
        },
      };
      return mockDelay(structuredClone(snapshot));
    }
    return this.http.get<DashboardSnapshot>(`/dashboard/${id}`);
  }
}
