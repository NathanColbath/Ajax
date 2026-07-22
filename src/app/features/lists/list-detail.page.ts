import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  catchError,
  filter,
  interval,
  map,
  of,
  startWith,
  Subscription,
  switchMap,
} from 'rxjs';
import {
  GameListDownloadJob,
  GameSummary,
  ListsApi,
  UserGameListDetail,
  UserGameListGame,
} from '../../api';
import { apiErrorMessage } from '../../core/api';
import {
  AjaxConfirmationService,
  AjaxEmptyState,
  AjaxFeedbackService,
} from '../../shared/interactions';
import { CoverCacheService } from '../../shared/media/cover-cache.service';
import { AjaxButton, AjaxDialog, AjaxInput, AjaxSpinner } from '../../shared/ui';
import { AddGameDialog } from './add-game.dialog';

@Component({
  selector: 'ajax-list-detail-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AjaxButton, AjaxInput, AjaxSpinner, AjaxEmptyState],
  templateUrl: './list-detail.page.html',
  styleUrl: './list-detail.page.scss',
})
export class ListDetailPage {
  private readonly listsApi = inject(ListsApi);
  private readonly coverCache = inject(CoverCacheService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly feedback = inject(AjaxFeedbackService);
  private readonly confirmation = inject(AjaxConfirmationService);
  private readonly dialog = inject(AjaxDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly list = signal<UserGameListDetail | null>(null);
  readonly search = signal('');
  readonly renaming = signal(false);
  readonly renameValue = signal('');
  readonly downloading = signal(false);
  readonly coverUrls = signal<Record<string, string>>({});

  private downloadSub: Subscription | null = null;

  readonly filteredGames = computed(() => {
    const detail = this.list();
    if (!detail) {
      return [] as UserGameListGame[];
    }
    const q = this.search().trim().toLowerCase();
    if (!q) {
      return detail.games;
    }
    return detail.games.filter(
      (g) => g.title.toLowerCase().includes(q) || g.system.toLowerCase().includes(q),
    );
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        filter((id) => !!id),
        switchMap((id) => {
          this.loading.set(true);
          return this.listsApi.get(id).pipe(
            catchError((err) => {
              this.feedback.warning(apiErrorMessage(err, 'Could not load list'));
              void this.router.navigate(['/lists']);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((detail) => {
        if (!detail) {
          return;
        }
        this.list.set(this.normalizeDetail(detail));
        this.renameValue.set(detail.name);
        this.loading.set(false);
      });

    effect((onCleanup) => {
      const detail = this.list();
      const games = detail?.games ?? [];
      const subs = games
        .filter((game) => !!game.hasArt)
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

    this.destroyRef.onDestroy(() => {
      this.downloadSub?.unsubscribe();
    });
  }

  coverFor(game: UserGameListGame): string | null {
    return this.coverUrls()[game.id] ?? null;
  }

  accentFor(game: UserGameListGame): string {
    return game.accent?.trim() || '#52687a';
  }

  private normalizeDetail(detail: UserGameListDetail): UserGameListDetail {
    return {
      ...detail,
      games: (detail.games ?? []).map((game) => ({
        ...game,
        accent: game.accent?.trim() || '#52687a',
        hasArt: !!game.hasArt,
        hasFiles: !!game.hasFiles,
      })),
    };
  }

  reload(): void {
    const id = this.list()?.id;
    if (!id) {
      return;
    }
    this.listsApi.get(id).subscribe({
      next: (detail) => {
        this.list.set(this.normalizeDetail(detail));
        this.renameValue.set(detail.name);
      },
      error: (err) => this.feedback.warning(apiErrorMessage(err, 'Could not refresh list')),
    });
  }

  startRename(): void {
    const detail = this.list();
    if (!detail) {
      return;
    }
    this.renameValue.set(detail.name);
    this.renaming.set(true);
  }

  cancelRename(): void {
    this.renaming.set(false);
    this.renameValue.set(this.list()?.name ?? '');
  }

  saveRename(): void {
    const detail = this.list();
    if (!detail) {
      return;
    }
    const name = this.renameValue().trim();
    if (!name || name === detail.name) {
      this.renaming.set(false);
      return;
    }
    this.listsApi.rename(detail.id, name).subscribe({
      next: (updated) => {
        this.list.update((current) =>
          current ? { ...current, name: updated.name, updatedAt: updated.updatedAt } : current,
        );
        this.renaming.set(false);
        this.feedback.success('List renamed');
      },
      error: (err) => this.feedback.warning(apiErrorMessage(err, 'Could not rename list')),
    });
  }

  openAddGame(): void {
    const detail = this.list();
    if (!detail) {
      return;
    }
    this.dialog
      .open<AddGameDialog, { excludeIds: string[] }, GameSummary>(AddGameDialog, {
        width: '600px',
        data: { excludeIds: detail.games.map((g) => g.id) },
      })
      .afterClosed()
      .subscribe((game) => {
        if (!game) {
          return;
        }
        this.listsApi.addGame(detail.id, game.id).subscribe({
          next: (updated) => {
            this.list.set(this.normalizeDetail(updated));
            this.feedback.success(`Added “${game.title}”`);
          },
          error: (err) => this.feedback.warning(apiErrorMessage(err, 'Could not add game')),
        });
      });
  }

  async removeGame(game: UserGameListGame, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const detail = this.list();
    if (!detail) {
      return;
    }
    const ok = await this.confirmation.confirm({
      title: 'Remove game?',
      message: `Remove “${game.title}” from this list?`,
      confirmLabel: 'Remove',
      severity: 'warning',
    });
    if (!ok) {
      return;
    }
    this.listsApi.removeGame(detail.id, game.id).subscribe({
      next: () => {
        this.list.update((current) =>
          current
            ? {
                ...current,
                games: current.games.filter((g) => g.id !== game.id),
                updatedAt: new Date().toISOString(),
              }
            : current,
        );
        this.feedback.success('Removed from list');
      },
      error: (err) => this.feedback.warning(apiErrorMessage(err, 'Could not remove game')),
    });
  }

  async deleteList(): Promise<void> {
    const detail = this.list();
    if (!detail) {
      return;
    }
    const ok = await this.confirmation.confirm({
      title: 'Delete list?',
      message: `Remove “${detail.name}”? Games stay in your library.`,
      confirmLabel: 'Delete',
      severity: 'danger',
    });
    if (!ok) {
      return;
    }
    this.listsApi.delete(detail.id).subscribe({
      next: () => {
        this.feedback.success('List deleted');
        void this.router.navigate(['/lists']);
      },
      error: (err) => this.feedback.warning(apiErrorMessage(err, 'Could not delete list')),
    });
  }

  downloadAll(): void {
    const detail = this.list();
    if (!detail || this.downloading()) {
      return;
    }
    if (detail.games.length === 0) {
      this.feedback.warning('Add games before downloading');
      return;
    }

    this.downloading.set(true);
    this.feedback.success('Preparing ZIP download…');
    this.downloadSub?.unsubscribe();

    this.listsApi.enqueueDownload(detail.id).subscribe({
      next: (job) => this.pollDownloadJob(job),
      error: (err) => {
        this.downloading.set(false);
        this.feedback.warning(apiErrorMessage(err, 'Could not start download'));
      },
    });
  }

  private pollDownloadJob(initial: GameListDownloadJob): void {
    const isTerminal = (status: string) => {
      const s = status.toLowerCase();
      return s === 'complete' || s === 'error';
    };

    if (isTerminal(String(initial.status))) {
      this.finishDownload(initial);
      return;
    }

    let settled = false;
    let polls = 0;

    this.downloadSub = interval(2000)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.listsApi.listDownloadJobs().pipe(
            map((jobs) => jobs.find((j) => j.id === initial.id) ?? null),
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (job) => {
          if (settled) {
            return;
          }
          polls += 1;
          if (job && isTerminal(String(job.status))) {
            settled = true;
            this.downloadSub?.unsubscribe();
            this.finishDownload(job);
            return;
          }
          if (polls >= 60) {
            settled = true;
            this.downloadSub?.unsubscribe();
            this.downloading.set(false);
            this.feedback.warning('Download timed out — try again');
          }
        },
        error: () => {
          if (settled) {
            return;
          }
          settled = true;
          this.downloading.set(false);
          this.feedback.warning('Download status check failed');
        },
      });
  }

  private finishDownload(job: GameListDownloadJob): void {
    const status = String(job.status).toLowerCase();
    if (status === 'error') {
      this.downloading.set(false);
      this.feedback.warning(job.message || 'Download failed');
      return;
    }

    const fileName = job.fileName?.trim() || `${job.listName || 'list'}.zip`;
    this.listsApi.downloadJob(job.id, fileName).subscribe({
      next: () => {
        this.downloading.set(false);
        this.feedback.success('Download ready');
      },
      error: (err) => {
        this.downloading.set(false);
        this.feedback.warning(apiErrorMessage(err, 'Could not download ZIP'));
      },
    });
  }
}
