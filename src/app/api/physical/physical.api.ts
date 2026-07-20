import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { MOCK_PHYSICAL } from './physical.mock';
import {
  CreatePhysicalItemRequest,
  PhysicalItem,
  PhysicalTitleSearchResult,
  UpdatePhysicalItemRequest,
} from './physical.models';

@Injectable({ providedIn: 'root' })
export class PhysicalApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private store = MOCK_PHYSICAL.map((item) => ({ ...item }));

  list(locationId?: string): Observable<PhysicalItem[]> {
    if (this.mode.isMock()) {
      const items = locationId
        ? this.store.filter((i) => i.locationId === locationId)
        : [...this.store];
      return mockDelay(items);
    }
    return this.http.get<PhysicalItem[]>('/physical', { locationId });
  }

  searchTitles(q: string, systemId?: string): Observable<PhysicalTitleSearchResult[]> {
    if (this.mode.isMock()) {
      const query = q.trim().toLowerCase();
      const hits: PhysicalTitleSearchResult[] = this.store
        .filter((i) => i.title.toLowerCase().includes(query))
        .slice(0, 8)
        .map((i) => ({
          igdbId: null,
          title: i.title,
          year: null,
          platforms: [i.system],
          coverUrl: null,
          externalId: i.id,
          source: 'mock',
          sampleMd5: null,
        }));
      return mockDelay(hits, 300);
    }
    return this.http.get<PhysicalTitleSearchResult[]>('/physical/title-search', { q, systemId });
  }

  create(request: CreatePhysicalItemRequest): Observable<PhysicalItem> {
    if (this.mode.isMock()) {
      const created: PhysicalItem = {
        id: `p${Date.now()}`,
        gameId: `g${Date.now()}`,
        title: request.title?.trim() || 'Untitled',
        system: 'UNK',
        condition: request.condition,
        locationId: request.locationId,
        locationName: 'Mock shelf',
        completeness: request.completeness,
        checkedOut: false,
        accent: '#52687a',
        hasArt: false,
        year: 0,
      };
      this.store = [created, ...this.store];
      return mockDelay(created, 350);
    }
    return this.http.post<PhysicalItem>('/physical', request);
  }

  update(id: string, request: UpdatePhysicalItemRequest): Observable<PhysicalItem> {
    if (this.mode.isMock()) {
      const item = this.store.find((i) => i.id === id);
      if (!item) {
        return throwError(() => new Error('Item not found'));
      }
      item.locationId = request.locationId;
      item.condition = request.condition;
      item.completeness = request.completeness;
      return mockDelay({ ...item }, 200);
    }
    return this.http.put<PhysicalItem>(`/physical/${id}`, request);
  }

  toggleCheckout(id: string, borrower = 'Guest'): Observable<PhysicalItem> {
    if (this.mode.isMock()) {
      const item = this.store.find((i) => i.id === id);
      if (!item) {
        return throwError(() => new Error('Item not found'));
      }
      item.checkedOut = !item.checkedOut;
      item.borrower = item.checkedOut ? borrower : undefined;
      return mockDelay({ ...item }, 200);
    }
    return this.http.post<PhysicalItem>(`/physical/${id}/checkout`, { borrower });
  }

  delete(id: string): Observable<void> {
    if (this.mode.isMock()) {
      this.store = this.store.filter((i) => i.id !== id);
      return mockDelay(undefined as void, 150);
    }
    return this.http.deleteVoid(`/physical/${id}`);
  }
}
