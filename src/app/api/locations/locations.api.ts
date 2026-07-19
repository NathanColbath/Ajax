import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { MOCK_LOCATIONS } from './locations.mock';
import { LocationType, PhysicalLocation } from './locations.models';

@Injectable({ providedIn: 'root' })
export class LocationsApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private store = MOCK_LOCATIONS.map((l) => ({ ...l }));

  list(): Observable<PhysicalLocation[]> {
    if (this.mode.isMock()) {
      return mockDelay([...this.store].sort((a, b) => a.name.localeCompare(b.name)));
    }
    return this.http.get<PhysicalLocation[]>('/locations');
  }

  create(input: { name: string; type: LocationType; notes?: string }): Observable<PhysicalLocation> {
    if (this.mode.isMock()) {
      const created: PhysicalLocation = {
        id: `loc${Date.now()}`,
        name: input.name.trim(),
        type: input.type,
        notes: input.notes?.trim() || undefined,
      };
      this.store = [...this.store, created];
      return mockDelay(created, 250);
    }
    return this.http.post<PhysicalLocation>('/locations', input);
  }
}
