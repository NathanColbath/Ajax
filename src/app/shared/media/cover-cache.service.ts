import { Injectable, effect, inject } from '@angular/core';
import { Observable, defer, of, shareReplay } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { GamesApi } from '../../api';
import { SessionService } from '../../core/auth/session.service';

export type CoverSize = 'thumb' | 'full';

interface CacheEntry {
  url: string;
  lastUsed: number;
}

/**
 * Shared in-memory blob: URL cache for game covers.
 * Survives page flips; only revokes on logout, invalidate, or LRU eviction.
 */
@Injectable({ providedIn: 'root' })
export class CoverCacheService {
  private readonly gamesApi = inject(GamesApi);
  private readonly session = inject(SessionService);

  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Observable<string | null>>();
  private readonly maxEntries = 200;
  private readonly maxConcurrent = 6;
  private active = 0;
  private readonly waitQueue: Array<() => void> = [];

  constructor() {
    effect(() => {
      if (!this.session.session()) {
        this.clear();
      }
    });
  }

  getCoverUrl(gameId: string, size: CoverSize = 'thumb'): Observable<string | null> {
    const key = this.key(gameId, size);
    const hit = this.cache.get(key);
    if (hit) {
      hit.lastUsed = Date.now();
      return of(hit.url);
    }

    const pending = this.inflight.get(key);
    if (pending) {
      return pending;
    }

    const req$ = defer(() =>
      this.runLimited(() =>
        this.gamesApi.getCoverObjectUrl(gameId, size).pipe(
          tap((url) => {
            if (url) {
              this.put(key, url);
            }
          }),
        ),
      ),
    ).pipe(
      finalize(() => this.inflight.delete(key)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.inflight.set(key, req$);
    return req$;
  }

  /** Drop cached URLs for a game (e.g. after cover upload/delete). */
  invalidate(gameId: string): void {
    for (const size of ['thumb', 'full'] as const) {
      const key = this.key(gameId, size);
      const entry = this.cache.get(key);
      if (entry) {
        URL.revokeObjectURL(entry.url);
        this.cache.delete(key);
      }
      this.inflight.delete(key);
    }
  }

  clear(): void {
    for (const entry of this.cache.values()) {
      URL.revokeObjectURL(entry.url);
    }
    this.cache.clear();
    this.inflight.clear();
  }

  private key(gameId: string, size: CoverSize): string {
    return `${size}:${gameId}`;
  }

  private put(key: string, url: string): void {
    const existing = this.cache.get(key);
    if (existing) {
      if (existing.url !== url) {
        URL.revokeObjectURL(existing.url);
      }
      existing.url = url;
      existing.lastUsed = Date.now();
      return;
    }

    this.cache.set(key, { url, lastUsed: Date.now() });
    this.evictIfNeeded();
  }

  private evictIfNeeded(): void {
    while (this.cache.size > this.maxEntries) {
      let oldestKey: string | null = null;
      let oldestAt = Number.POSITIVE_INFINITY;
      for (const [key, entry] of this.cache) {
        if (entry.lastUsed < oldestAt) {
          oldestAt = entry.lastUsed;
          oldestKey = key;
        }
      }
      if (!oldestKey) {
        break;
      }
      const entry = this.cache.get(oldestKey);
      if (entry) {
        URL.revokeObjectURL(entry.url);
      }
      this.cache.delete(oldestKey);
    }
  }

  private runLimited<T>(work: () => Observable<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      let innerSub: { unsubscribe(): void } | null = null;
      let cancelled = false;
      let started = false;
      let settled = false;

      const finishSlot = () => {
        if (settled) {
          return;
        }
        settled = true;
        this.active--;
        this.pump();
      };

      const start = () => {
        if (cancelled || started) {
          return;
        }
        started = true;
        this.active++;
        innerSub = work().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => {
            finishSlot();
            subscriber.error(err);
          },
          complete: () => {
            finishSlot();
            subscriber.complete();
          },
        });
      };

      if (this.active < this.maxConcurrent) {
        start();
      } else {
        this.waitQueue.push(start);
      }

      return () => {
        cancelled = true;
        const idx = this.waitQueue.indexOf(start);
        if (idx >= 0) {
          this.waitQueue.splice(idx, 1);
        }
        if (started) {
          innerSub?.unsubscribe();
          finishSlot();
        }
      };
    });
  }

  private pump(): void {
    while (this.active < this.maxConcurrent && this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      next?.();
    }
  }
}
