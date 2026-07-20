import { Injectable, inject } from '@angular/core';
import { Observable, filter, map, throwError } from 'rxjs';
import {
  ApiClient,
  ApiModeService,
  UploadProgressEvent,
  mockDelay,
  saveBlobAsFile,
} from '../../core/api';
import { MOCK_UPLOAD_JOBS } from './uploads.mock';
import { UploadEnqueueOptions, UploadJob } from './uploads.models';

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

  enqueue(files: File[], options: UploadEnqueueOptions): Observable<UploadJob[]> {
    return this.enqueueWithProgress(files, options).pipe(
      filter((event): event is UploadProgressEvent<UploadJob[]> & { type: 'response' } =>
        event.type === 'response',
      ),
      map((event) => event.body ?? []),
    );
  }

  /** Emits progress events then a final response with created jobs. */
  enqueueWithProgress(
    files: File[],
    options: UploadEnqueueOptions,
  ): Observable<UploadProgressEvent<UploadJob[]>> {
    if (this.mode.isMock()) {
      const jobs: UploadJob[] = files.map((file, index) => ({
        id: `u${Date.now()}-${index}`,
        name: file.name,
        size: file.size,
        progress: 15,
        state: 'uploading' as const,
        systemId: options.systemId,
        gameId: options.gameId,
      }));
      this.store = [...jobs, ...this.store];
      window.setTimeout(() => {
        this.store = this.store.map((j) =>
          jobs.some((created) => created.id === j.id)
            ? { ...j, progress: 100, state: 'complete' as const }
            : j,
        );
      }, 1800);
      return new Observable((subscriber) => {
        subscriber.next({ type: 'progress', percent: 30 });
        window.setTimeout(() => {
          subscriber.next({ type: 'progress', percent: 70 });
          window.setTimeout(() => {
            subscriber.next({ type: 'response', percent: 100, body: jobs });
            subscriber.complete();
          }, 80);
        }, 80);
      });
    }

    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    form.append('systemId', options.systemId);
    if (options.gameId) {
      form.append('gameId', options.gameId);
    }
    if (options.createTitle) {
      form.append('createTitle', options.createTitle);
    }
    return this.http.postFormWithProgress<UploadJob[]>('/uploads', form);
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

  download(id: string, fileName: string): Observable<void> {
    if (this.mode.isMock()) {
      const blob = new Blob([`Mock upload artifact for ${fileName}`], {
        type: 'application/octet-stream',
      });
      saveBlobAsFile(blob, fileName);
      return mockDelay(undefined as void, 120);
    }
    return this.http.getBlob(`/uploads/${id}/download`).pipe(
      map((blob) => {
        saveBlobAsFile(blob, fileName);
      }),
    );
  }

  delete(id: string): Observable<void> {
    if (this.mode.isMock()) {
      const job = this.store.find((j) => j.id === id);
      if (job && (job.state === 'queued' || job.state === 'uploading' || job.state === 'processing')) {
        return throwError(() => ({
          error: {
            message: 'Cancel the upload first; only completed or failed jobs can be deleted.',
          },
        }));
      }
      this.store = this.store.filter((j) => j.id !== id);
      return mockDelay(undefined as void, 150);
    }
    return this.http.deleteVoid(`/uploads/${id}`);
  }
}
