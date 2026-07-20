import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { MOCK_SYSTEMS } from './systems.mock';
import { CreateGameSystemRequest, GameSystem, UpdateGameSystemRequest } from './systems.models';

@Injectable({ providedIn: 'root' })
export class SystemsApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private store = MOCK_SYSTEMS.map((s) => ({
    ...s,
    extensions: [...s.extensions],
    metadataProviderIds: { ...s.metadataProviderIds },
  }));
  private mockLogos = new Map<string, Blob>();

  list(): Observable<GameSystem[]> {
    if (this.mode.isMock()) {
      return mockDelay(this.store.map((s) => this.clone(s)));
    }
    return this.http.get<GameSystem[]>('/systems');
  }

  resolveExtension(ext: string): Observable<GameSystem[]> {
    const normalized = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    if (this.mode.isMock()) {
      const matches = this.store.filter((s) =>
        s.extensions.some((e) => e.toLowerCase() === normalized),
      );
      return mockDelay(matches.map((s) => this.clone(s)), 120);
    }
    return this.http.get<GameSystem[]>('/systems/resolve-extension', { ext: normalized });
  }

  add(system: CreateGameSystemRequest): Observable<GameSystem> {
    if (this.mode.isMock()) {
      const created: GameSystem = {
        ...system,
        id: `s${Date.now()}`,
        gameCount: 0,
        hasLogo: false,
        extensions: [...system.extensions],
        metadataProviderIds: { ...system.metadataProviderIds },
      };
      this.store = [...this.store, created];
      return mockDelay(this.clone(created), 320);
    }
    return this.http.post<GameSystem>('/systems', system);
  }

  update(id: string, request: UpdateGameSystemRequest): Observable<GameSystem> {
    if (this.mode.isMock()) {
      const idx = this.store.findIndex((s) => s.id === id);
      const current = this.store[idx];
      const updated: GameSystem = {
        ...current,
        ...request,
        metadataProviderIds: request.metadataProviderIds
          ? { ...request.metadataProviderIds }
          : current.metadataProviderIds,
      };
      this.store[idx] = updated;
      return mockDelay(this.clone(updated), 220);
    }
    return this.http.put<GameSystem>(`/systems/${id}`, request);
  }

  uploadLogo(id: string, file: File): Observable<GameSystem> {
    if (this.mode.isMock()) {
      const idx = this.store.findIndex((s) => s.id === id);
      this.mockLogos.set(id, file);
      this.store[idx] = { ...this.store[idx], hasLogo: true };
      return mockDelay(this.clone(this.store[idx]), 280);
    }
    const form = new FormData();
    form.append('file', file);
    return this.http.post<GameSystem>(`/systems/${id}/artwork/logo`, form);
  }

  getLogoObjectUrl(id: string): Observable<string | null> {
    if (this.mode.isMock()) {
      const blob = this.mockLogos.get(id);
      return mockDelay(blob ? URL.createObjectURL(blob) : null, 80);
    }
    return this.http.getBlob(`/systems/${id}/artwork/logo`).pipe(map((blob) => URL.createObjectURL(blob)));
  }

  addExtension(id: string, extension: string): Observable<GameSystem> {
    if (this.mode.isMock()) {
      const system = this.store.find((s) => s.id === id)!;
      const ext = extension.startsWith('.') ? extension : `.${extension}`;
      if (!system.extensions.includes(ext)) {
        system.extensions = [...system.extensions, ext];
      }
      return mockDelay(this.clone(system), 180);
    }
    return this.http.post<GameSystem>(`/systems/${id}/extensions`, { extension });
  }

  delete(id: string): Observable<void> {
    if (this.mode.isMock()) {
      const system = this.store.find((s) => s.id === id);
      if (system && system.gameCount > 0) {
        return throwError(() => ({ error: { message: `Cannot delete ${system.name}: games still reference this system.` } }));
      }
      this.store = this.store.filter((s) => s.id !== id);
      this.mockLogos.delete(id);
      return mockDelay(undefined as void, 180);
    }
    return this.http.deleteVoid(`/systems/${id}`);
  }

  private clone(s: GameSystem): GameSystem {
    return {
      ...s,
      extensions: [...s.extensions],
      metadataProviderIds: { ...s.metadataProviderIds },
    };
  }
}

