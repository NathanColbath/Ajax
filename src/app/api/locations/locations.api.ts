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

  update(
    id: string,
    input: { name: string; type: LocationType; notes?: string },
  ): Observable<PhysicalLocation> {
    if (this.mode.isMock()) {
      const loc = this.store.find((l) => l.id === id);
      if (!loc) {
        throw new Error('Location not found');
      }
      loc.name = input.name.trim();
      loc.type = input.type;
      loc.notes = input.notes?.trim() || undefined;
      return mockDelay({ ...loc }, 200);
    }
    return this.http.put<PhysicalLocation>(`/locations/${id}`, input);
  }

  delete(id: string): Observable<void> {
    if (this.mode.isMock()) {
      this.store = this.store.filter((l) => l.id !== id);
      return mockDelay(undefined as void, 150);
    }
    return this.http.deleteVoid(`/locations/${id}`);
  }
}
