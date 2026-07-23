import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { SessionService } from '../../core/auth/session.service';
import { MOCK_DASHBOARDS } from './dashboard.mock';
import { DashboardRecentGame, DashboardSnapshot } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private readonly session = inject(SessionService);

  getSnapshot(userId?: string, recommendationSeed?: number): Observable<DashboardSnapshot> {
    const id = userId ?? this.session.userId() ?? 'u1';
    if (this.mode.isMock()) {
      const snapshot = MOCK_DASHBOARDS[id] ?? {
        ...MOCK_DASHBOARDS['u1'],
        userId: id,
        displayName: this.session.displayName() ?? 'User',
        continuePlaying: [],
        recentlyAdded: [],
        favorites: [],
        systems: [],
        recommendations: [],
        attention: [],
        stats: {
          ...MOCK_DASHBOARDS['u1'].stats,
          myFavorites: 0,
          myDownloads: 0,
          myLists: 0,
        },
      };
      const clone = structuredClone(snapshot);
      if (recommendationSeed != null && clone.recommendations.length > 1) {
        clone.recommendations = [...clone.recommendations].sort(
          () => (recommendationSeed % 3) - 1,
        );
      }
      return mockDelay(clone);
    }
    return this.http.get<DashboardSnapshot>(`/dashboard/${id}`, {
      recommendationSeed,
    });
  }

  getRecommendations(userId?: string, seed?: number): Observable<DashboardRecentGame[]> {
    const id = userId ?? this.session.userId() ?? 'u1';
    if (this.mode.isMock()) {
      const base = MOCK_DASHBOARDS[id]?.recommendations ?? MOCK_DASHBOARDS['u1'].recommendations;
      const items = structuredClone(base);
      if (seed != null && items.length > 1) {
        items.reverse();
      }
      return mockDelay(items);
    }
    return this.http.get<DashboardRecentGame[]>(`/dashboard/${id}/recommendations`, { seed });
  }
}
