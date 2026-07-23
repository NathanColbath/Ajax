import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GamesApi, GameSummary } from '../../api';
import { LibrarySettingsService } from '../../core/config/library-settings.service';
import { AjaxEmptyState } from '../../shared/interactions';
import { CoverCacheService } from '../../shared/media/cover-cache.service';
import {
  AjaxButton,
  AjaxInput,
  AjaxPagination,
  AjaxSelect,
  AjaxSelectOption,
  AjaxSpinner,
  AjaxTable,
  AjaxTableColumn,
} from '../../shared/ui';
import { Subject, switchMap, catchError, of, distinctUntilChanged, timer, map } from 'rxjs';

@Component({
  selector: 'ajax-games-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    AjaxButton,
    AjaxInput,
    AjaxSelect,
    AjaxSelectOption,
    AjaxSpinner,
    AjaxEmptyState,
    AjaxTable,
    AjaxPagination,
  ],
  templateUrl: './games.page.html',
  styleUrl: './games.page.scss',
})
export class GamesPage {
  private readonly api = inject(GamesApi);
  private readonly coverCache = inject(CoverCacheService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly librarySettings = inject(LibrarySettingsService);
  private readonly route = inject(ActivatedRoute);
  private readonly searchInput$ = new Subject<string>();
  private readonly reload$ = new Subject<void>();

  readonly loading = signal(true);
  readonly games = signal<GameSummary[]>([]);
  readonly systems = signal<string[]>([]);
  readonly search = signal('');
  readonly selectedSystem = signal<string | undefined>(undefined);
  readonly ownedOnly = signal(false);
  readonly view = signal<'grid' | 'list' | 'table'>('grid');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(8);
  readonly coverUrls = signal<Record<string, string>>({});

  readonly systemFilter = computed(() => this.selectedSystem() ?? '');
  readonly ownershipFilter = computed(() => (this.ownedOnly() ? 'owned' : ''));
  readonly hasActiveFilters = computed(
    () => !!this.search().trim() || !!this.selectedSystem() || this.ownedOnly(),
  );

  readonly columns: AjaxTableColumn<GameSummary>[] = [
    { key: 'title', header: 'Title' },
    { key: 'system', header: 'System' },
    { key: 'region', header: 'Region' },
    { key: 'year', header: 'Year' },
    { key: 'rating', header: 'Rating', cell: (row) => row.rating.toFixed(1) },
    { key: 'downloadCount', header: 'Downloads' },
  ];

  readonly pagedGames = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.games().slice(start, start + this.pageSize());
  });

  constructor() {
    this.librarySettings.ensureLoaded();
    effect(() => {
      this.pageSize.set(this.librarySettings.defaultLibraryPageSize());
    });

    this.api.systems().subscribe((systems) => this.systems.set(systems));

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const system = params.get('system')?.trim();
      const next = system || undefined;
      if (this.selectedSystem() !== next) {
        this.selectedSystem.set(next);
        this.reload$.next();
      }
    });

    this.reload$
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          return this.api
            .list({
              search: this.search(),
              system: this.selectedSystem(),
              ownedOnly: this.ownedOnly() || undefined,
            })
            .pipe(
              catchError(() => {
                this.loading.set(false);
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((games) => {
        if (games == null) {
          return;
        }
        this.games.set(games);
        this.pageIndex.set(0);
        this.loading.set(false);
      });

    this.searchInput$
      .pipe(
        switchMap((value) =>
          timer(this.librarySettings.searchDebounceMs()).pipe(map(() => value)),
        ),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => {
        if (this.search() !== value) {
          return;
        }
        this.reload$.next();
      });

    this.reload$.next();

    effect((onCleanup) => {
      const page = this.pagedGames();
      const view = this.view();
      if (view !== 'grid' && view !== 'list') {
        return;
      }

      const subs = page
        .filter((game) => game.hasArt)
        .map((game) =>
          this.coverCache.getCoverUrl(game.id, 'thumb').subscribe({
            next: (url) => {
              if (!url) {
                return;
              }
              this.coverUrls.update((current) => ({ ...current, [game.id]: url }));
            },
          }),
        );

      onCleanup(() => {
        for (const sub of subs) {
          sub.unsubscribe();
        }
      });
    });
  }

  coverFor(game: GameSummary): string | null {
    return this.coverUrls()[game.id] ?? null;
  }

  metaLine(game: GameSummary): string {
    const parts = [game.system];
    if (game.publisher?.trim()) {
      parts.push(game.publisher.trim());
    }
    if (game.year > 0) {
      parts.push(String(game.year));
    }
    if (game.genres?.length) {
      parts.push(game.genres[0]);
    }
    return parts.join(' · ');
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.searchInput$.next(value);
  }

  onSystemFilter(value: string): void {
    this.selectedSystem.set(value?.trim() ? value : undefined);
    this.reload$.next();
  }

  onOwnershipFilter(value: string): void {
    this.ownedOnly.set(value === 'owned');
    this.reload$.next();
  }

  setView(view: 'grid' | 'list' | 'table'): void {
    this.view.set(view);
  }

  clearFilters(): void {
    this.selectedSystem.set(undefined);
    this.ownedOnly.set(false);
    this.search.set('');
    this.reload$.next();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }
}
