import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { MOCK_DUPLICATES } from './duplicates.mock';
import { DuplicateGroup } from './duplicates.models';

@Injectable({ providedIn: 'root' })
export class DuplicatesApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private store = MOCK_DUPLICATES.map((g) => ({
    ...g,
    files: g.files.map((f) => ({ ...f })),
  }));

  list(): Observable<DuplicateGroup[]> {
    if (this.mode.isMock()) {
      return mockDelay(this.store.map((g) => ({ ...g, files: g.files.map((f) => ({ ...f })) })));
    }
    return this.http.get<DuplicateGroup[]>('/duplicates');
  }

  keep(groupId: string, fileId: string): Observable<DuplicateGroup[]> {
    if (this.mode.isMock()) {
      this.store = this.store.filter((g) => g.id !== groupId);
      return mockDelay([...this.store], 250);
    }
    return this.http.post<DuplicateGroup[]>(`/duplicates/${groupId}/keep`, { fileId });
  }

  keepBoth(groupId: string): Observable<DuplicateGroup[]> {
    if (this.mode.isMock()) {
      this.store = this.store.filter((g) => g.id !== groupId);
      return mockDelay([...this.store], 220);
    }
    return this.http.post<DuplicateGroup[]>(`/duplicates/${groupId}/keep-both`);
  }
}
