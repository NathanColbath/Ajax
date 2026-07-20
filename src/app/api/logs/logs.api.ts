import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { MOCK_LOG_ENTRIES } from './logs.mock';
import { LogEntry, LogQuery } from './logs.models';

@Injectable({ providedIn: 'root' })
export class LogsApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private store = MOCK_LOG_ENTRIES.map((e) => ({ ...e }));

  list(query: LogQuery = {}): Observable<LogEntry[]> {
    if (this.mode.isMock()) {
      let rows = [...this.store];
      if (query.afterId != null) {
        rows = rows.filter((e) => e.id > query.afterId!).sort((a, b) => a.id - b.id);
      } else {
        rows = rows.sort((a, b) => b.id - a.id);
      }
      if (query.level) {
        rows = rows.filter((e) => e.level === query.level);
      }
      if (query.category) {
        rows = rows.filter((e) => e.category === query.category);
      }
      if (query.search?.trim()) {
        const term = query.search.trim().toLowerCase();
        rows = rows.filter(
          (e) =>
            e.message.toLowerCase().includes(term) ||
            e.eventType.toLowerCase().includes(term) ||
            (e.requestPath?.toLowerCase().includes(term) ?? false),
        );
      }
      const limit = query.limit ?? 100;
      return mockDelay(rows.slice(0, limit));
    }

    return this.http.get<LogEntry[]>('/logs', {
      afterId: query.afterId,
      since: query.since,
      limit: query.limit,
      level: query.level,
      category: query.category,
      correlationId: query.correlationId,
      search: query.search,
    });
  }

  getById(id: number): Observable<LogEntry | null> {
    if (this.mode.isMock()) {
      return mockDelay(this.store.find((e) => e.id === id) ?? null);
    }
    return this.http.get<LogEntry>(`/logs/${id}`);
  }

  purge(olderThanDays = 30): Observable<number> {
    if (this.mode.isMock()) {
      const before = this.store.length;
      this.store = [];
      return mockDelay(before);
    }
    return this.http.delete<{ removed: number }>(`/logs?olderThanDays=${olderThanDays}`).pipe(
      map((r) => r.removed),
    );
  }

  delete(id: number): Observable<void> {
    if (this.mode.isMock()) {
      this.store = this.store.filter((e) => e.id !== id);
      return mockDelay(undefined as void, 120);
    }
    return this.http.deleteVoid(`/logs/${id}`);
  }
}
