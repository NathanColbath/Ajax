import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { MOCK_UPLOAD_JOBS } from './uploads.mock';
import { UploadJob } from './uploads.models';

@Injectable({ providedIn: 'root' })
export class UploadsApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private store = MOCK_UPLOAD_JOBS.map((j) => ({ ...j }));

  list(): Observable<UploadJob[]> {
    if (this.mode.isMock()) {
      return mockDelay([...this.store]);
    }
    return this.http.get<UploadJob[]>('/uploads');
  }

  enqueue(files: File[], systemId?: string): Observable<UploadJob[]> {
    if (this.mode.isMock()) {
      const jobs: UploadJob[] = files.map((file, index) => ({
        id: `u${Date.now()}-${index}`,
        name: file.name,
        size: file.size,
        progress: 15,
        state: 'uploading' as const,
        systemId,
      }));
      this.store = [...jobs, ...this.store];
      return mockDelay(jobs, 220);
    }
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    if (systemId) {
      form.append('systemId', systemId);
    }
    return this.http.post<UploadJob[]>('/uploads', form);
  }

  cancel(id: string): Observable<UploadJob[]> {
    if (this.mode.isMock()) {
      this.store = this.store.map((j) =>
        j.id === id ? { ...j, state: 'error' as const, progress: 0, message: 'Cancelled' } : j,
      );
      return mockDelay([...this.store], 150);
    }
    return this.http.post<UploadJob[]>(`/uploads/${id}/cancel`);
  }

  retry(id: string): Observable<UploadJob[]> {
    if (this.mode.isMock()) {
      this.store = this.store.map((j) =>
        j.id === id ? { ...j, state: 'uploading' as const, progress: 10, message: undefined } : j,
      );
      return mockDelay([...this.store], 150);
    }
    return this.http.post<UploadJob[]>(`/uploads/${id}/retry`);
  }
}
