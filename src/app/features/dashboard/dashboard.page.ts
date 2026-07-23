import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  DashboardApi,
  DashboardRecentGame,
  DashboardSnapshot,
  DashboardSystemTile,
} from '../../api';
import { SessionService } from '../../core/auth/session.service';
import { UserPreferencesService } from '../../core/preferences/user-preferences.service';
import { AjaxEmptyState, AjaxStatusChip } from '../../shared/interactions';
import { CoverCacheService } from '../../shared/media/cover-cache.service';
import { AjaxButton, AjaxIcon, AjaxSpinner } from '../../shared/ui';
import { SystemsApi } from '../../api/systems/systems.api';
import { DashboardSectionId } from '../../core/layout/dashboard-sections';

@Component({
  selector: 'ajax-dashboard-page',
  standalone: true,
  imports: [RouterLink, AjaxButton, AjaxIcon, AjaxSpinner, AjaxEmptyState, AjaxStatusChip],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);
  private readonly systemsApi = inject(SystemsApi);
  private readonly coverCache = inject(CoverCacheService);
  private readonly session = inject(SessionService);
  private readonly userPrefs = inject(UserPreferencesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly snapshot = signal<DashboardSnapshot | null>(null);
  readonly coverUrls = signal<Record<string, string>>({});
  readonly logoUrls = signal<Record<string, string>>({});
  readonly refreshingRecs = signal(false);
  readonly isAdmin = this.session.isAtLeast('admin');

  readonly visibleSections = computed(() =>
    this.userPrefs.visibleDashboardSections().map((s) => s.id as DashboardSectionId),
  );

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

  readonly systemsViewAllLink = computed(() => (this.isAdmin ? '/systems' : '/games'));

  constructor() {
    this.userPrefs.ensureLoaded();
    this.reload();
  }

  coverFor(game: DashboardRecentGame): string | null {
    return this.coverUrls()[game.id] ?? null;
  }

  logoFor(system: DashboardSystemTile): string | null {
    return this.logoUrls()[system.id] ?? null;
  }

  refreshRecommendations(): void {
    const data = this.snapshot();
    if (!data || this.refreshingRecs()) {
      return;
    }
    this.refreshingRecs.set(true);
    const seed = Date.now() % 100000;
    this.api
      .getRecommendations(data.userId, seed)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (recommendations) => {
          this.snapshot.update((current) =>
            current ? { ...current, recommendations } : current,
          );
          this.refreshingRecs.set(false);
          this.loadCoversFor(recommendations);
        },
        error: () => this.refreshingRecs.set(false),
      });
  }

  private reload(): void {
    this.loading.set(true);
    this.api
      .getSnapshot()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.snapshot.set(data);
          this.loading.set(false);
          this.loadCovers(data);
          this.loadLogos(data.systems);
        },
        error: () => this.loading.set(false),
      });
  }

  private loadCovers(data: DashboardSnapshot): void {
    this.loadCoversFor([
      ...data.continuePlaying,
      ...data.recentlyAdded,
      ...data.favorites,
      ...data.recommendations,
    ]);
  }

  private loadCoversFor(games: DashboardRecentGame[]): void {
    const seen = new Set<string>();
    for (const game of games) {
      if (!game.hasArt || seen.has(game.id) || this.coverUrls()[game.id]) {
        continue;
      }
      seen.add(game.id);
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

  private loadLogos(systems: DashboardSystemTile[]): void {
    for (const system of systems) {
      if (!system.hasLogo || this.logoUrls()[system.id]) {
        continue;
      }
      this.systemsApi
        .getLogoObjectUrl(system.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (url) => {
            if (!url) {
              return;
            }
            this.logoUrls.update((current) => ({ ...current, [system.id]: url }));
          },
        });
    }
  }
}

function looksLikeAuth0Subject(name: string): boolean {
  return /^[a-z0-9_-]+\|/i.test(name);
}
