import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { SessionService } from '../../core/auth/session.service';
import { MOCK_GAMES, MOCK_USER_GAME_STATE, toSummary } from './games.mock';
import { GameDetail, GameSummary, GamesQuery } from './games.models';

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
