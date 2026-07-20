import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay, saveBlobAsFile } from '../../core/api';
import {
  GameListDownloadJob,
  UserGameListDetail,
  UserGameListSummary,
} from './lists.models';

@Injectable({ providedIn: 'root' })
export class ListsApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);

  private lists: UserGameListDetail[] = [];
  private jobs: GameListDownloadJob[] = [];

  list(): Observable<UserGameListSummary[]> {
    if (this.mode.isMock()) {
      return mockDelay(this.lists.map(toSummary));
    }
    return this.http.get<UserGameListSummary[]>('/lists');
  }

  get(id: string): Observable<UserGameListDetail> {
    if (this.mode.isMock()) {
      const list = this.lists.find((l) => l.id === id);
      if (!list) {
        throw new Error('List not found');
      }
      return mockDelay({ ...list, games: [...list.games] });
    }
    return this.http.get<UserGameListDetail>(`/lists/${id}`);
  }

  create(name: string): Observable<UserGameListSummary> {
    if (this.mode.isMock()) {
      const now = new Date().toISOString();
      const list: UserGameListDetail = {
        id: `ugl${Date.now()}`,
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
        games: [],
      };
      this.lists = [list, ...this.lists];
      return mockDelay(toSummary(list), 200);
    }
    return this.http.post<UserGameListSummary>('/lists', { name });
  }

  rename(id: string, name: string): Observable<UserGameListSummary> {
    if (this.mode.isMock()) {
      const list = this.lists.find((l) => l.id === id);
      if (!list) {
        throw new Error('List not found');
      }
      list.name = name.trim();
      list.updatedAt = new Date().toISOString();
      return mockDelay(toSummary(list), 150);
    }
    return this.http.put<UserGameListSummary>(`/lists/${id}`, { name });
  }

  delete(id: string): Observable<void> {
    if (this.mode.isMock()) {
      this.lists = this.lists.filter((l) => l.id !== id);
      return mockDelay(undefined as void, 150);
    }
    return this.http.deleteVoid(`/lists/${id}`);
  }

  addGame(listId: string, gameId: string): Observable<UserGameListDetail> {
    if (this.mode.isMock()) {
      const list = this.lists.find((l) => l.id === listId);
      if (!list) {
        throw new Error('List not found');
      }
      if (!list.games.some((g) => g.id === gameId)) {
        list.games = [
          ...list.games,
          {
            id: gameId,
            title: `Game ${gameId}`,
            system: 'Unknown',
            hasFiles: true,
            accent: '#52687a',
            hasArt: false,
          },
        ];
        list.updatedAt = new Date().toISOString();
      }
      return mockDelay({ ...list, games: [...list.games] }, 150);
    }
    return this.http.post<UserGameListDetail>(`/lists/${listId}/games`, { gameId });
  }

  removeGame(listId: string, gameId: string): Observable<void> {
    if (this.mode.isMock()) {
      const list = this.lists.find((l) => l.id === listId);
      if (list) {
        list.games = list.games.filter((g) => g.id !== gameId);
        list.updatedAt = new Date().toISOString();
      }
      return mockDelay(undefined as void, 120);
    }
    return this.http.deleteVoid(`/lists/${listId}/games/${gameId}`);
  }

  enqueueDownload(listId: string): Observable<GameListDownloadJob> {
    if (this.mode.isMock()) {
      const list = this.lists.find((l) => l.id === listId);
      const job: GameListDownloadJob = {
        id: `ldj${Date.now()}`,
        listId,
        listName: list?.name ?? 'List',
        status: 'complete',
        progress: 100,
        fileName: `${list?.name ?? 'list'}.zip`,
        message: 'Ready',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      this.jobs = [job, ...this.jobs];
      return mockDelay(job, 400);
    }
    return this.http.post<GameListDownloadJob>(`/lists/${listId}/download-jobs`, {});
  }

  listDownloadJobs(): Observable<GameListDownloadJob[]> {
    if (this.mode.isMock()) {
      return mockDelay(this.jobs.map((j) => ({ ...j })));
    }
    return this.http.get<GameListDownloadJob[]>('/lists/download-jobs');
  }

  downloadJob(jobId: string, fileName: string): Observable<void> {
    if (this.mode.isMock()) {
      const blob = new Blob([`Mock list zip ${fileName}`], { type: 'application/zip' });
      saveBlobAsFile(blob, fileName);
      return mockDelay(undefined as void, 120);
    }
    return this.http.getBlob(`/lists/download-jobs/${jobId}/download`).pipe(
      map((blob) => {
        saveBlobAsFile(blob, fileName);
      }),
    );
  }

  deleteDownloadJob(jobId: string): Observable<void> {
    if (this.mode.isMock()) {
      this.jobs = this.jobs.filter((j) => j.id !== jobId);
      return mockDelay(undefined as void, 120);
    }
    return this.http.deleteVoid(`/lists/download-jobs/${jobId}`);
  }
}

function toSummary(list: UserGameListDetail): UserGameListSummary {
  return {
    id: list.id,
    name: list.name,
    gameCount: list.games.length,
    updatedAt: list.updatedAt,
  };
}
