import { HttpClient, HttpEventType, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { AJAX_API_BASE_URL } from './api-mode';

export type ApiParams = Record<string, string | number | boolean | undefined | null>;

export interface UploadProgressEvent<T> {
  type: 'progress' | 'response';
  percent?: number;
  body?: T;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(AJAX_API_BASE_URL);

  get<T>(path: string, params?: ApiParams): Observable<T> {
    return this.http.get<T>(this.url(path), { params: this.toParams(params) });
  }

  getBlob(path: string, params?: ApiParams): Observable<Blob> {
    return this.http.get(this.url(path), {
      params: this.toParams(params),
      responseType: 'blob',
    });
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>(this.url(path), body ?? null);
  }

  /** Multipart POST with upload transfer progress (0–100). */
  postFormWithProgress<T>(path: string, form: FormData): Observable<UploadProgressEvent<T>> {
    return this.http
      .post<T>(this.url(path), form, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        filter(
          (event) =>
            event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response,
        ),
        map((event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const total = event.total && event.total > 0 ? event.total : 0;
            const percent = total > 0 ? Math.round((100 * event.loaded) / total) : 0;
            return { type: 'progress' as const, percent };
          }
          return { type: 'response' as const, percent: 100, body: event.body as T };
        }),
      );
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http.put<T>(this.url(path), body ?? null);
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http.patch<T>(this.url(path), body ?? null);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path));
  }

  /** DELETE that expects 204 No Content (or empty body). */
  deleteVoid(path: string): Observable<void> {
    return this.http.delete(this.url(path), { responseType: 'text' }).pipe(map(() => undefined));
  }

  private url(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl.replace(/\/$/, '')}${normalized}`;
  }

  private toParams(params?: ApiParams): HttpParams | undefined {
    if (!params) {
      return undefined;
    }
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value == null) {
        continue;
      }
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }
}
