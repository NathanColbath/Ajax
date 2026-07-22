import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DashboardApi, DashboardRecentGame, DashboardSnapshot } from '../../api';
import { SessionService } from '../../core/auth/session.service';
import { AjaxEmptyState, AjaxStatusChip } from '../../shared/interactions';
import { CoverCacheService } from '../../shared/media/cover-cache.service';
import { AjaxButton, AjaxIcon, AjaxSpinner } from '../../shared/ui';

@Component({
  selector: 'ajax-dashboard-page',
  standalone: true,
  imports: [RouterLink, AjaxButton, AjaxIcon, AjaxSpinner, AjaxEmptyState, AjaxStatusChip],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);
  private readonly coverCache = inject(CoverCacheService);
  private readonly session = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly snapshot = signal<DashboardSnapshot | null>(null);
  readonly coverUrls = signal<Record<string, string>>({});
  readonly isAdmin = this.session.isAtLeast('admin');

  readonly greetingName = computed(() => {
    const sessionName = this.session.displayName()?.trim();
    if (sessionName && !looksLikeAuth0Subject(sessionName)) {
      return sessionName;
    }
    const apiName = this.snapshot()?.displayName?.trim();
    if (apiName && !looksLikeAuth0Subject(apiName)) {
      return apiName;
    }
    return sessionName || apiName || 'there';
  });

  constructor() {
    this.api
      .getSnapshot()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.snapshot.set(data);
          this.loading.set(false);
          this.loadCovers(data);
        },
        error: () => this.loading.set(false),
      });
  }

  coverFor(game: DashboardRecentGame): string | null {
    return this.coverUrls()[game.id] ?? null;
  }

  private loadCovers(data: DashboardSnapshot): void {
    const seen = new Set<string>();
    const games = [...data.favorites, ...data.recent].filter((g) => {
      if (!g.hasArt || seen.has(g.id)) {
        return false;
      }
      seen.add(g.id);
      return true;
    });

    for (const game of games) {
      this.coverCache
        .getCoverUrl(game.id, 'thumb')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (url) => {
            if (!url) {
              return;
            }
            this.coverUrls.update((current) => ({ ...current, [game.id]: url }));
          },
        });
    }
  }
}

function looksLikeAuth0Subject(name: string): boolean {
  return /^[a-z0-9_-]+\|/i.test(name);
}
