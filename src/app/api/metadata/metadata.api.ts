import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { MOCK_PROVIDERS, MOCK_REVIEW_QUEUE } from './metadata.mock';
import { MetadataProvider, MetadataReviewItem } from './metadata.models';

@Injectable({ providedIn: 'root' })
export class MetadataApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private providers = MOCK_PROVIDERS.map((p) => ({ ...p }));
  private queue = MOCK_REVIEW_QUEUE.map((i) => ({ ...i }));

  listProviders(): Observable<MetadataProvider[]> {
    if (this.mode.isMock()) {
      return mockDelay([...this.providers]);
    }
    return this.http.get<MetadataProvider[]>('/metadata/providers');
  }

  listQueue(): Observable<MetadataReviewItem[]> {
    if (this.mode.isMock()) {
      return mockDelay([...this.queue]);
    }
    return this.http.get<MetadataReviewItem[]>('/metadata/queue');
  }

  runProvider(id: string): Observable<MetadataProvider[]> {
    if (this.mode.isMock()) {
      this.providers = this.providers.map((p) =>
        p.id === id ? { ...p, status: 'running' as const, lastRunLabel: 'Just now' } : p,
      );
      return mockDelay([...this.providers], 400);
    }
    return this.http.post<MetadataProvider[]>(`/metadata/providers/${id}/run`);
  }

  accept(id: string): Observable<MetadataReviewItem[]> {
    if (this.mode.isMock()) {
      this.queue = this.queue.filter((i) => i.id !== id);
      return mockDelay([...this.queue], 180);
    }
    return this.http.post<MetadataReviewItem[]>(`/metadata/queue/${id}/accept`);
  }

  skip(id: string): Observable<MetadataReviewItem[]> {
    if (this.mode.isMock()) {
      this.queue = this.queue.filter((i) => i.id !== id);
      return mockDelay([...this.queue], 150);
    }
    return this.http.post<MetadataReviewItem[]>(`/metadata/queue/${id}/skip`);
  }
}
