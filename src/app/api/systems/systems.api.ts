import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { MOCK_SYSTEMS } from './systems.mock';
import { GameSystem } from './systems.models';

@Injectable({ providedIn: 'root' })
export class SystemsApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private store = MOCK_SYSTEMS.map((s) => ({ ...s, extensions: [...s.extensions] }));

  list(): Observable<GameSystem[]> {
    if (this.mode.isMock()) {
      return mockDelay(this.store.map((s) => ({ ...s, extensions: [...s.extensions] })));
    }
    return this.http.get<GameSystem[]>('/systems');
  }

  add(system: Omit<GameSystem, 'id' | 'gameCount'>): Observable<GameSystem> {
    if (this.mode.isMock()) {
      const created: GameSystem = {
        ...system,
        id: `s${Date.now()}`,
        gameCount: 0,
      };
      this.store = [...this.store, created];
      return mockDelay(created, 320);
    }
    return this.http.post<GameSystem>('/systems', system);
  }

  addExtension(id: string, extension: string): Observable<GameSystem> {
    if (this.mode.isMock()) {
      const system = this.store.find((s) => s.id === id)!;
      const ext = extension.startsWith('.') ? extension : `.${extension}`;
      if (!system.extensions.includes(ext)) {
        system.extensions = [...system.extensions, ext];
      }
      return mockDelay({ ...system, extensions: [...system.extensions] }, 180);
    }
    return this.http.post<GameSystem>(`/systems/${id}/extensions`, { extension });
  }
}
