import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { ApiClient, ApiModeService, mockDelay, saveBlobAsFile } from '../../core/api';
import { SessionService } from '../../core/auth/session.service';
import { MOCK_GAMES, MOCK_USER_GAME_STATE, toSummary } from './games.mock';
import { GameDetail, GameSummary, GamesQuery, UpdateGameRequest, GameReview, UpsertGameReviewRequest, GamePublicFeedback } from './games.models';

@Injectable({ providedIn: 'root' })
export class GamesApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private readonly session = inject(SessionService);
  private mockStore = MOCK_GAMES.map((g) => ({
    ...g,
    genres: [...g.genres],
    tags: [...g.tags],
    languages: [...g.languages],
    screenshots: [...g.screenshots],
    files: g.files.map((f) => ({ ...f })),
  }));
  private userState = structuredClone(MOCK_USER_GAME_STATE);
  private mockCoverBlobs = new Map<string, Blob>();
  private mockScreenshotBlobs = new Map<string, Blob[]>();

  list(query: GamesQuery = {}): Observable<GameSummary[]> {
    if (this.mode.isMock()) {
      let items = this.mockStore.map(toSummary);
      const search = query.search?.trim().toLowerCase();
      if (search) {
        items = items.filter(
          (g) => g.title.toLowerCase().includes(search) || g.system.toLowerCase().includes(search),
        );
      }
      if (query.system) {
        items = items.filter((g) => g.system === query.system);
      }
      if (query.ownedOnly) {
        items = items.filter((g) => g.owned);
      }
      return mockDelay(items);
    }
    return this.http.get<GameSummary[]>('/games', query as Record<string, string | boolean | undefined>);
  }

  getById(id: string): Observable<GameDetail> {
    if (this.mode.isMock()) {
      const game = this.mockStore.find((g) => g.id === id);
      if (!game) {
        return throwError(() => new Error('Game not found')).pipe(delay(200));
      }
      return mockDelay(this.withUserOverlay({ ...game, files: [...game.files] }));
    }
    return this.http.get<GameDetail>(`/games/${id}`);
  }

  update(id: string, request: UpdateGameRequest): Observable<GameDetail> {
    if (this.mode.isMock()) {
      const idx = this.mockStore.findIndex((g) => g.id === id);
      if (idx < 0) {
        return throwError(() => new Error('Game not found'));
      }
      const current = this.mockStore[idx];
      const updated: GameDetail = {
        ...current,
        ...request,
        genres: request.genres ? [...request.genres] : current.genres,
        tags: request.tags ? [...request.tags] : current.tags,
        languages: request.languages ? [...request.languages] : current.languages,
        metadataSource: 'manual',
      };
      this.mockStore[idx] = updated;
      return mockDelay(this.withUserOverlay({ ...updated, files: [...updated.files] }), 220);
    }
    return this.http.patch<GameDetail>(`/games/${id}`, request);
  }

  uploadCover(id: string, file: File): Observable<GameDetail> {
    if (this.mode.isMock()) {
      const idx = this.mockStore.findIndex((g) => g.id === id);
      if (idx < 0) {
        return throwError(() => new Error('Game not found'));
      }
      this.mockCoverBlobs.set(id, file);
      this.mockStore[idx] = {
        ...this.mockStore[idx],
        hasArt: true,
        metadataSource: 'manual',
      };
      return mockDelay(this.withUserOverlay({ ...this.mockStore[idx], files: [...this.mockStore[idx].files] }), 280);
    }
    const form = new FormData();
    form.append('file', file);
    return this.http.post<GameDetail>(`/games/${id}/artwork/cover`, form);
  }

  deleteCover(id: string): Observable<GameDetail> {
    if (this.mode.isMock()) {
      const idx = this.mockStore.findIndex((g) => g.id === id);
      if (idx < 0) {
        return throwError(() => new Error('Game not found'));
      }
      this.mockCoverBlobs.delete(id);
      this.mockStore[idx] = { ...this.mockStore[idx], hasArt: false };
      return mockDelay(this.withUserOverlay({ ...this.mockStore[idx], files: [...this.mockStore[idx].files] }), 180);
    }
    return this.http.delete<GameDetail>(`/games/${id}/artwork/cover`);
  }

  uploadScreenshots(id: string, files: File[]): Observable<GameDetail> {
    if (this.mode.isMock()) {
      const idx = this.mockStore.findIndex((g) => g.id === id);
      if (idx < 0) {
        return throwError(() => new Error('Game not found'));
      }
      const existing = this.mockScreenshotBlobs.get(id) ?? [];
      this.mockScreenshotBlobs.set(id, [...existing, ...files]);
      const count = (this.mockScreenshotBlobs.get(id)?.length ?? 0);
      this.mockStore[idx] = {
        ...this.mockStore[idx],
        screenshotCount: count,
        screenshots: Array.from({ length: count }, (_, i) => String(i)),
        metadataSource: 'manual',
      };
      return mockDelay(this.withUserOverlay({ ...this.mockStore[idx], files: [...this.mockStore[idx].files] }), 280);
    }
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return this.http.post<GameDetail>(`/games/${id}/artwork/screenshots`, form);
  }

  deleteScreenshot(id: string, index: number): Observable<GameDetail> {
    if (this.mode.isMock()) {
      const idx = this.mockStore.findIndex((g) => g.id === id);
      if (idx < 0) {
        return throwError(() => new Error('Game not found'));
      }
      const shots = [...(this.mockScreenshotBlobs.get(id) ?? [])];
      shots.splice(index, 1);
      this.mockScreenshotBlobs.set(id, shots);
      this.mockStore[idx] = {
        ...this.mockStore[idx],
        screenshotCount: shots.length,
        screenshots: Array.from({ length: shots.length }, (_, i) => String(i)),
      };
      return mockDelay(this.withUserOverlay({ ...this.mockStore[idx], files: [...this.mockStore[idx].files] }), 180);
    }
    return this.http.delete<GameDetail>(`/games/${id}/artwork/screenshots/${index}`);
  }

  /** Returns an object URL for the cover (caller should revoke when done). */
  getCoverObjectUrl(id: string): Observable<string | null> {
    if (this.mode.isMock()) {
      const blob = this.mockCoverBlobs.get(id);
      if (blob) {
        return mockDelay(URL.createObjectURL(blob), 80);
      }
      const game = this.mockStore.find((g) => g.id === id);
      return mockDelay(game?.hasArt ? null : null, 80);
    }
    return this.http.getBlob(`/games/${id}/artwork/cover`).pipe(
      map((blob) => URL.createObjectURL(blob)),
    );
  }

  getScreenshotObjectUrl(id: string, index: number): Observable<string | null> {
    if (this.mode.isMock()) {
      const blob = this.mockScreenshotBlobs.get(id)?.[index];
      if (blob) {
        return mockDelay(URL.createObjectURL(blob), 80);
      }
      const game = this.mockStore.find((g) => g.id === id);
      const color = game?.screenshots[index];
      if (color?.startsWith('#')) {
        return mockDelay(null, 80);
      }
      return mockDelay(null, 80);
    }
    return this.http.getBlob(`/games/${id}/artwork/screenshots/${index}`).pipe(
      map((blob) => URL.createObjectURL(blob)),
    );
  }

  toggleFavorite(id: string): Observable<GameDetail> {
    if (this.mode.isMock()) {
      const game = this.mockStore.find((g) => g.id === id);
      if (!game) {
        return throwError(() => new Error('Game not found'));
      }
      const userId = this.session.userId() ?? 'u1';
      const state = this.ensureUserGame(userId, id, game);
      state.favorite = !state.favorite;
      return mockDelay(this.withUserOverlay({ ...game, files: [...game.files] }), 180);
    }
    return this.http.post<GameDetail>(`/games/${id}/favorite`);
  }

  listReviews(id: string): Observable<GameReview[]> {
    if (this.mode.isMock()) {
      return mockDelay([] as GameReview[], 120);
    }
    return this.http.get<GameReview[]>(`/games/${id}/reviews`);
  }

  upsertReview(id: string, request: UpsertGameReviewRequest): Observable<GameReview> {
    if (this.mode.isMock()) {
      const now = new Date().toISOString();
      return mockDelay(
        {
          id: `rv-mock`,
          gameId: id,
          userId: this.session.userId() ?? 'u1',
          authorName: this.session.displayName() ?? 'You',
          authorInitials: 'ME',
          rating: request.rating,
          body: request.body ?? '',
          createdAt: now,
          updatedAt: now,
          isMine: true,
        } satisfies GameReview,
        180,
      );
    }
    return this.http.put<GameReview>(`/games/${id}/reviews`, request);
  }

  deleteMyReview(id: string): Observable<void> {
    if (this.mode.isMock()) {
      return mockDelay(undefined as void, 120);
    }
    return this.http.deleteVoid(`/games/${id}/reviews/me`);
  }

  getPublicFeedback(id: string): Observable<GamePublicFeedback> {
    if (this.mode.isMock()) {
      return mockDelay(
        {
          available: false,
          rating: null,
          ratingsCount: null,
          metacritic: null,
          sourceUrl: null,
          attribution: 'Discussion from Reddit when available',
          comments: [],
          ratingScale: null,
          ratingProvider: null,
        } satisfies GamePublicFeedback,
        120,
      );
    }
    return this.http.get<GamePublicFeedback>(`/games/${id}/public-feedback`);
  }

  downloadFile(gameId: string, fileId: string, fileName: string): Observable<void> {
    if (this.mode.isMock()) {
      const blob = new Blob([`Mock download for ${fileName}`], { type: 'application/octet-stream' });
      saveBlobAsFile(blob, fileName);
      return mockDelay(undefined as void, 120);
    }
    return this.getFileBlob(gameId, fileId).pipe(
      map((blob) => {
        saveBlobAsFile(blob, fileName);
      }),
    );
  }

  /** Authenticated ROM/file blob (for play cache or download). */
  getFileBlob(gameId: string, fileId: string): Observable<Blob> {
    if (this.mode.isMock()) {
      return mockDelay(new Blob([`Mock ROM ${gameId}/${fileId}`], { type: 'application/octet-stream' }), 120);
    }
    return this.http.getBlob(`/games/${gameId}/files/${fileId}/download`);
  }

  deleteGame(id: string): Observable<void> {
    if (this.mode.isMock()) {
      this.mockStore = this.mockStore.filter((g) => g.id !== id);
      return mockDelay(undefined as void, 180);
    }
    return this.http.deleteVoid(`/games/${id}`);
  }

  deleteFile(gameId: string, fileId: string): Observable<void> {
    if (this.mode.isMock()) {
      const game = this.mockStore.find((g) => g.id === gameId);
      if (game) {
        game.files = game.files.filter((f) => f.id !== fileId);
      }
      return mockDelay(undefined as void, 150);
    }
    return this.http.deleteVoid(`/games/${gameId}/files/${fileId}`);
  }

  systems(): Observable<string[]> {
    if (this.mode.isMock()) {
      const systems = [...new Set(this.mockStore.map((g) => g.system))].sort();
      return of(systems);
    }
    return this.http.get<string[]>('/games/systems');
  }

  private ensureUserGame(
    userId: string,
    gameId: string,
    game: GameDetail,
  ): { favorite: boolean; playStatus: GameDetail['playStatus'] } {
    if (!this.userState[userId]) {
      this.userState[userId] = {};
    }
    if (!this.userState[userId][gameId]) {
      this.userState[userId][gameId] = {
        favorite: game.favorite,
        playStatus: game.playStatus,
      };
    }
    return this.userState[userId][gameId];
  }

  private withUserOverlay(game: GameDetail): GameDetail {
    const userId = this.session.userId() ?? 'u1';
    const overlay = this.userState[userId]?.[game.id];
    if (!overlay) {
      return { ...game, favorite: false, playStatus: game.owned ? 'unplayed' : 'wishlist' };
    }
    return { ...game, favorite: overlay.favorite, playStatus: overlay.playStatus };
  }
}

