import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { MOCK_EXPORT_JOBS } from './exports.mock';
import { ExportFormat, ExportJob, ExportScope } from './exports.models';

@Injectable({ providedIn: 'root' })
export class ExportsApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private store = MOCK_EXPORT_JOBS.map((j) => ({ ...j, scopes: [...j.scopes] }));

  listJobs(): Observable<ExportJob[]> {
    if (this.mode.isMock()) {
      return mockDelay(this.store.map((j) => ({ ...j, scopes: [...j.scopes] })));
    }
    return this.http.get<ExportJob[]>('/exports');
  }

  run(format: ExportFormat, scopes: ExportScope[]): Observable<ExportJob[]> {
    if (this.mode.isMock()) {
      const job: ExportJob = {
        id: `e${Date.now()}`,
        format,
        scopes: [...scopes],
        status: 'complete',
        createdLabel: 'Just now',
      };
      this.store = [job, ...this.store];
      return mockDelay([...this.store], 700);
    }
    return this.http.post<ExportJob[]>('/exports', { format, scopes });
  }
}
