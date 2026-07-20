import { Component, DestroyRef, computed, inject, OnDestroy, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { from, of } from 'rxjs';
import { catchError, concatMap, last, map, toArray } from 'rxjs/operators';
import {
  GameSummary,
  GameSystem,
  GamesApi,
  SystemsApi,
  UploadJob,
  UploadsApi,
} from '../../api';
import { apiErrorMessage } from '../../core/api';
import { LibrarySettingsService } from '../../core/config/library-settings.service';
import {
  AjaxConfirmationService,
  AjaxEmptyState,
  AjaxFeedbackService,
  AjaxProgressAction,
  AjaxProgressStep,
  AjaxUploadDropzone,
  AjaxUploadItem,
  AjaxUploadQueue,
} from '../../shared/interactions';
import {
  AjaxButton,
  AjaxInput,
  AjaxPagination,
  AjaxSelect,
  AjaxSelectOption,
  AjaxSpinner,
} from '../../shared/ui';
import { PageEvent } from '@angular/material/paginator';

type GameTargetMode = 'existing' | 'new';

interface PendingUpload {
  key: string;
  file: File;
  candidates: GameSystem[];
  systemId: string | undefined;
  gameMode: GameTargetMode;
  gameId: string | undefined;
  createTitle: string;
  games: GameSummary[];
  loadingGames: boolean;
  resolving: boolean;
  error?: string;
}

interface EnqueueGroup {
  systemId: string;
  gameId?: string;
  createTitle?: string;
  items: PendingUpload[];
}

const PAST_UPLOADS_STORAGE_KEY = 'ajax-uploads-show-past';

@Component({
  selector: 'ajax-uploads-page',
  standalone: true,
  imports: [
    FormsModule,
    MatProgressBarModule,
    MatIconModule,
    AjaxSelect,
    AjaxSelectOption,
    AjaxInput,
    AjaxButton,
    AjaxSpinner,
    AjaxEmptyState,
    AjaxUploadDropzone,
    AjaxUploadQueue,
    AjaxProgressAction,
    AjaxPagination,
  ],
  templateUrl: './uploads.page.html',
  styleUrl: './uploads.page.scss',
})
export class UploadsPage implements OnDestroy {
  private readonly api = inject(UploadsApi);
  private readonly systemsApi = inject(SystemsApi);
  private readonly gamesApi = inject(GamesApi);
  private readonly feedback = inject(AjaxFeedbackService);
  private readonly confirmation = inject(AjaxConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly librarySettings = inject(LibrarySettingsService);

  readonly loading = signal(true);
  readonly enqueueing = signal(false);
  readonly transferPercent = signal<number | null>(null);
  readonly jobs = signal<UploadJob[]>([]);
  /** Job IDs in the current enqueue/processing wave (for overall progress). */
  readonly waveJobIds = signal<string[]>([]);
  readonly pending = signal<PendingUpload[]>([]);
  readonly steps = signal<AjaxProgressStep[]>(this.idleSteps());
  readonly showPastUploads = signal(readShowPastPreference());
  readonly activePageIndex = signal(0);
  readonly activePageSize = signal(8);

  readonly activeJobs = computed(() => this.jobs().filter(isActiveJob));
  readonly pastJobs = computed(() => this.jobs().filter((j) => !isActiveJob(j)));
  readonly activeItems = computed(() => this.activeJobs().map(toQueueItem));
  readonly pastItems = computed(() => this.pastJobs().map(toQueueItem));

  readonly pagedActiveItems = computed(() => {
    const items = this.activeItems();
    const size = this.activePageSize();
    let page = this.activePageIndex();
    const maxPage = Math.max(0, Math.ceil(items.length / size) - 1);
    if (page > maxPage) {
      page = maxPage;
    }
    const start = page * size;
    return items.slice(start, start + size);
  });

  readonly pendingSummary = computed(() => {
    const items = this.pending();
    const ready = items.filter((p) => this.isPendingReady(p)).length;
    const blocked = items.length - ready;
    return {
      total: items.length,
      ready,
      blocked,
      label:
        blocked > 0
          ? `${items.length} files · ${ready} ready · ${blocked} need attention`
          : `${items.length} file${items.length === 1 ? '' : 's'} · ${ready} ready`,
    };
  });

  readonly readyCount = computed(() => this.pending().filter((p) => this.isPendingReady(p)).length);

  readonly totalProgress = computed(() => {
    const transfer = this.transferPercent();
    if (transfer != null && this.enqueueing()) {
      return {
        percent: transfer,
        count: this.readyCount(),
        label: `Uploading · ${transfer}%`,
      };
    }

    const waveIds = this.waveJobIds();
    const jobs = this.jobs();
    const waveJobs =
      waveIds.length > 0 ? jobs.filter((j) => waveIds.includes(j.id)) : this.activeJobs();

    if (waveJobs.length === 0) {
      return null;
    }

    const done = waveJobs.filter((j) => j.state === 'complete' || j.state === 'error').length;
    const active = waveJobs.filter(isActiveJob);
    if (active.length === 0 && done === 0) {
      return null;
    }

    // Overall: finished jobs count as 100%; active use their reported progress.
    const progressSum =
      done * 100 + active.reduce((sum, j) => sum + barProgress(j), 0);
    const percent = Math.round(progressSum / waveJobs.length);

    if (active.length === 0) {
      return {
        percent: 100,
        count: waveJobs.length,
        label: `${done} of ${waveJobs.length} done`,
      };
    }

    return {
      percent,
      count: waveJobs.length,
      label: `${done} of ${waveJobs.length} done · ${percent}%`,
    };
  });

  readonly canApplySystemToAll = computed(() => {
    const pending = this.pending();
    if (pending.length < 2) {
      return false;
    }
    const source = pending.find((p) => !!p.systemId && !p.resolving);
    if (!source?.systemId) {
      return false;
    }
    return pending.some(
      (p) =>
        p.key !== source.key &&
        !p.resolving &&
        p.systemId !== source.systemId &&
        (p.candidates.length === 0 || p.candidates.some((c) => c.id === source.systemId)),
    );
  });

  readonly canAttachAllToSameGame = computed(() => {
    const pending = this.pending();
    if (pending.length < 2) {
      return false;
    }
    const source = pending.find(
      (p) => this.isPendingReady(p) && p.gameMode === 'existing' && !!p.gameId,
    );
    if (!source?.systemId || !source.gameId) {
      return false;
    }
    return pending.some(
      (p) =>
        p.key !== source.key &&
        !p.resolving &&
        (p.candidates.length === 0 || p.candidates.some((c) => c.id === source.systemId)),
    );
  });

  private pollTimer: number | undefined;
  private everHadJobs = false;

  constructor() {
    this.librarySettings.ensureLoaded();
    this.reload();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  reload(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (jobs) => {
        this.applyJobs(jobs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFiles(files: File[]): void {
    if (files.length === 0) {
      return;
    }

    const next: PendingUpload[] = files.map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      candidates: [],
      systemId: undefined,
      gameMode: 'new',
      gameId: undefined,
      createTitle: titleFromFileName(file.name),
      games: [],
      loadingGames: false,
      resolving: true,
    }));

    this.pending.update((current) => [...current, ...next]);
    this.feedback.info(`Added ${next.length} file${next.length === 1 ? '' : 's'}`);
    this.syncSteps();

    for (const item of next) {
      this.resolvePending(item.key, item.file);
    }
  }

  removePending(key: string): void {
    this.pending.update((items) => items.filter((p) => p.key !== key));
    this.syncSteps();
  }

  setSystem(key: string, systemId: string): void {
    this.pending.update((items) =>
      items.map((p) =>
        p.key === key
          ? {
              ...p,
              systemId,
              gameId: undefined,
              gameMode: 'new' as const,
              games: [],
              error: undefined,
            }
          : p,
      ),
    );
    this.loadGamesForPending(key);
    this.syncSteps();
  }

  setGameMode(key: string, mode: GameTargetMode): void {
    this.pending.update((items) =>
      items.map((p) =>
        p.key === key
          ? {
              ...p,
              gameMode: mode,
              gameId: mode === 'existing' ? p.gameId : undefined,
              error: undefined,
            }
          : p,
      ),
    );
    this.syncSteps();
  }

  setGameId(key: string, gameId: string): void {
    this.pending.update((items) =>
      items.map((p) => (p.key === key ? { ...p, gameId, error: undefined } : p)),
    );
    this.syncSteps();
  }

  setCreateTitle(key: string, title: string): void {
    this.pending.update((items) =>
      items.map((p) => (p.key === key ? { ...p, createTitle: title, error: undefined } : p)),
    );
    this.syncSteps();
  }

  applySystemToAll(): void {
    const source = this.pending().find((p) => !!p.systemId && !p.resolving);
    if (!source?.systemId) {
      this.feedback.warning('Pick a system on at least one file first');
      return;
    }

    this.pending.update((items) =>
      items.map((p) => {
        if (p.key === source.key || p.resolving || p.error?.startsWith('No system')) {
          return p;
        }
        const accepts =
          p.candidates.some((c) => c.id === source.systemId) || p.candidates.length === 0;
        if (!accepts && p.candidates.length > 0) {
          return p;
        }
        return {
          ...p,
          systemId: source.systemId,
          gameMode: 'new' as const,
          gameId: undefined,
          createTitle: p.createTitle || titleFromFileName(p.file.name),
          candidates: p.candidates.length ? p.candidates : source.candidates,
          error: undefined,
        };
      }),
    );

    for (const item of this.pending()) {
      if (item.systemId === source.systemId && item.games.length === 0) {
        this.loadGamesForPending(item.key);
      }
    }

    this.feedback.success('Applied system to matching files (each keeps its own title)');
    this.syncSteps();
  }

  attachAllToSameGame(): void {
    const source = this.pending().find(
      (p) => this.isPendingReady(p) && p.gameMode === 'existing' && !!p.gameId,
    );
    if (!source?.systemId || !source.gameId) {
      this.feedback.warning('Attach one file to an existing game first');
      return;
    }

    this.pending.update((items) =>
      items.map((p) => {
        if (p.key === source.key || p.resolving || p.error?.startsWith('No system')) {
          return p;
        }
        const accepts =
          p.candidates.some((c) => c.id === source.systemId) || p.candidates.length === 0;
        if (!accepts && p.candidates.length > 0) {
          return p;
        }
        return {
          ...p,
          systemId: source.systemId,
          gameMode: 'existing' as const,
          gameId: source.gameId,
          candidates: p.candidates.length ? p.candidates : source.candidates,
          games: source.games,
          error: undefined,
        };
      }),
    );

    this.feedback.success('Attached matching files to the same game');
    this.syncSteps();
  }

  canEnqueue(): boolean {
    return this.readyCount() > 0 && !this.enqueueing();
  }

  enqueuePending(): void {
    const ready = this.pending().filter((p) => this.isPendingReady(p));
    const skipped = this.pending().length - ready.length;
    if (ready.length === 0) {
      this.feedback.warning('Select a system and game (or new title) for at least one file');
      return;
    }

    const groups = groupReadyForEnqueue(ready);
    this.enqueueing.set(true);
    this.transferPercent.set(0);

    const readyKeys = new Set(ready.map((r) => r.key));
    let completedGroups = 0;

    from(groups)
      .pipe(
        concatMap((group, index) =>
          this.api.enqueueWithProgress(
            group.items.map((i) => i.file),
            {
              systemId: group.systemId,
              gameId: group.gameId,
              createTitle: group.createTitle,
            },
          ).pipe(
            map((event) => {
              if (event.type === 'progress') {
                const groupWeight = 100 / groups.length;
                const within = (event.percent ?? 0) / 100;
                this.transferPercent.set(
                  Math.min(99, Math.round(completedGroups * groupWeight + within * groupWeight)),
                );
              }
              return { event, groupIndex: index };
            }),
            last(),
            map((result) => {
              completedGroups = index + 1;
              this.transferPercent.set(Math.round((completedGroups / groups.length) * 100));
              return result.event.body ?? [];
            }),
            catchError(() => of([] as UploadJob[])),
          ),
        ),
        toArray(),
      )
      .subscribe({
        next: (batches) => {
          const created = batches.flat();
          this.pending.update((items) => items.filter((p) => !readyKeys.has(p.key)));
          this.jobs.update((jobs) => [
            ...created,
            ...jobs.filter((j) => !created.some((c) => c.id === j.id)),
          ]);
          this.everHadJobs = true;
          this.enqueueing.set(false);
          this.transferPercent.set(null);

          if (created.length === 0) {
            this.feedback.error('Upload failed — check system/game selection');
            return;
          }

          // Track this wave so progress is "done of total" not "1 processing of shrinking queue".
          const existingActive = this.activeJobs().map((j) => j.id);
          const waveIds = [...new Set([...existingActive, ...created.map((j) => j.id)])];
          this.waveJobIds.set(waveIds);

          const skipNote = skipped > 0 ? ` · ${skipped} left in pending` : '';
          this.feedback.success(`${created.length} file(s) queued${skipNote}`);
          this.applyJobs(this.jobs());
          this.startPolling();
        },
        error: () => {
          this.enqueueing.set(false);
          this.transferPercent.set(null);
          this.feedback.error('Upload failed — check system/game selection');
        },
      });
  }

  togglePastUploads(): void {
    const next = !this.showPastUploads();
    this.showPastUploads.set(next);
    try {
      sessionStorage.setItem(PAST_UPLOADS_STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  onActivePage(event: PageEvent): void {
    this.activePageIndex.set(event.pageIndex);
    this.activePageSize.set(event.pageSize);
  }

  cancel(id: string): void {
    this.api.cancel(id).subscribe((jobs) => this.applyJobs(jobs));
  }

  retry(id: string): void {
    this.api.retry(id).subscribe((jobs) => {
      this.applyJobs(jobs);
      this.startPolling();
    });
  }

  download(id: string): void {
    const job = this.jobs().find((j) => j.id === id);
    if (!job) {
      return;
    }
    this.api.download(id, job.name).subscribe({
      next: () => this.feedback.success(`Downloaded ${job.name}`),
      error: () => this.feedback.error('Download failed'),
    });
  }

  async removeJob(id: string): Promise<void> {
    const job = this.jobs().find((j) => j.id === id);
    if (!job) {
      return;
    }
    const ok = await this.confirmation.confirm({
      title: 'Delete upload job?',
      message: `Remove “${job.name}” from the queue history.`,
      confirmLabel: 'Delete',
      severity: 'danger',
    });
    if (!ok) {
      return;
    }
    this.api.delete(id).subscribe({
      next: () => {
        this.jobs.update((jobs) => jobs.filter((j) => j.id !== id));
        this.syncSteps();
        this.feedback.success('Upload job deleted');
      },
      error: (err) => this.feedback.error(apiErrorMessage(err, 'Failed to delete upload')),
    });
  }

  private resolvePending(key: string, file: File): void {
    const ext = extensionOf(file.name);
    this.systemsApi
      .resolveExtension(ext)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (candidates) => {
          this.pending.update((items) =>
            items.map((p) => {
              if (p.key !== key) {
                return p;
              }
              if (candidates.length === 0) {
                return {
                  ...p,
                  candidates: [],
                  resolving: false,
                  error: `No system accepts ${ext || 'this extension'}. Add a system with that extension first.`,
                };
              }
              const systemId = candidates.length === 1 ? candidates[0].id : undefined;
              return {
                ...p,
                candidates,
                systemId,
                resolving: false,
                error: candidates.length > 1 ? 'Multiple systems match — pick one' : undefined,
              };
            }),
          );
          if (candidates.length === 1) {
            this.loadGamesForPending(key);
          }
          this.syncSteps();
        },
        error: () => {
          this.pending.update((items) =>
            items.map((p) =>
              p.key === key
                ? { ...p, resolving: false, error: 'Could not resolve file extension' }
                : p,
            ),
          );
          this.syncSteps();
        },
      });
  }

  private loadGamesForPending(key: string): void {
    const item = this.pending().find((p) => p.key === key);
    if (!item?.systemId) {
      return;
    }
    const system = item.candidates.find((s) => s.id === item.systemId);
    if (!system) {
      return;
    }

    this.pending.update((items) =>
      items.map((p) => (p.key === key ? { ...p, loadingGames: true } : p)),
    );

    this.gamesApi
      .list({ system: system.name })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (games) => {
          this.pending.update((items) =>
            items.map((p) =>
              p.key === key
                ? {
                    ...p,
                    games,
                    loadingGames: false,
                    gameMode: games.length > 0 ? p.gameMode : 'new',
                  }
                : p,
            ),
          );
          this.syncSteps();
        },
        error: () => {
          this.pending.update((items) =>
            items.map((p) => (p.key === key ? { ...p, loadingGames: false, games: [] } : p)),
          );
        },
      });
  }

  private isPendingReady(p: PendingUpload): boolean {
    if (p.resolving || !p.systemId || p.error?.startsWith('No system')) {
      return false;
    }
    if (p.gameMode === 'existing') {
      return !!p.gameId;
    }
    return p.createTitle.trim().length > 0;
  }

  private applyJobs(jobs: UploadJob[]): void {
    this.jobs.set(jobs);
    if (jobs.length > 0) {
      this.everHadJobs = true;
    }

    const waveIds = this.waveJobIds();
    if (waveIds.length > 0) {
      const waveJobs = jobs.filter((j) => waveIds.includes(j.id));
      const stillActive = waveJobs.some(isActiveJob);
      if (waveJobs.length > 0 && !stillActive) {
        // Wave finished — clear so the next enqueue starts fresh.
        this.waveJobIds.set([]);
      }
    } else if (jobs.some(isActiveJob)) {
      // Page reload / navigate back mid-queue: seed wave from current active + recent completes.
      this.waveJobIds.set(jobs.filter(isActiveJob).map((j) => j.id));
    }

    // Keep paginator on a valid page as the active list shrinks.
    const activeCount = jobs.filter(isActiveJob).length;
    const maxPage = Math.max(0, Math.ceil(activeCount / this.activePageSize()) - 1);
    if (this.activePageIndex() > maxPage) {
      this.activePageIndex.set(maxPage);
    }

    if (jobs.some(isActiveJob)) {
      this.startPolling();
    } else {
      this.stopPolling();
    }
    this.syncSteps();
  }

  private syncSteps(): void {
    const pending = this.pending();
    const active = this.activeJobs();
    const past = this.pastJobs();
    const hasPending = pending.length > 0;
    const hasActive = active.length > 0;
    const hasPast = past.length > 0;
    const dropComplete = hasPending || this.everHadJobs || hasActive || hasPast;
    const ready = pending.filter((p) => this.isPendingReady(p)).length;

    let dropState: AjaxProgressStep['state'] = 'pending';
    let chooseState: AjaxProgressStep['state'] = 'pending';
    let processState: AjaxProgressStep['state'] = 'pending';

    if (!dropComplete) {
      dropState = 'active';
    } else if (hasPending) {
      dropState = 'complete';
      chooseState = 'active';
    } else if (hasActive || this.enqueueing()) {
      dropState = 'complete';
      chooseState = 'complete';
      processState = 'active';
    } else {
      dropState = 'complete';
      chooseState = 'complete';
      processState = 'complete';
    }

    this.steps.set([
      {
        id: 'drop',
        label: 'Drop or select files',
        state: dropState,
        description: dropState === 'active' ? 'Add one or many ROMs at once' : undefined,
      },
      {
        id: 'choose',
        label: 'Choose system & game',
        state: chooseState,
        description: hasPending
          ? `${ready} of ${pending.length} ready to enqueue`
          : undefined,
      },
      {
        id: 'process',
        label: 'Queue & catalog',
        state: processState,
        description: hasActive
          ? `${active.length} job${active.length === 1 ? '' : 's'} processing`
          : processState === 'complete' && hasPast
            ? 'Show past uploads below when you need them.'
            : undefined,
      },
    ]);
  }

  private idleSteps(): AjaxProgressStep[] {
    return [
      {
        id: 'drop',
        label: 'Drop or select files',
        state: 'active',
        description: 'Add one or many ROMs at once',
      },
      { id: 'choose', label: 'Choose system & game', state: 'pending' },
      { id: 'process', label: 'Queue & catalog', state: 'pending' },
    ];
  }

  private startPolling(): void {
    if (this.pollTimer != null) {
      return;
    }
    this.pollTimer = window.setInterval(() => {
      this.api.list().subscribe({
        next: (jobs) => this.applyJobs(jobs),
      });
    }, this.librarySettings.uploadPollIntervalMs());
  }

  private stopPolling(): void {
    if (this.pollTimer != null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }
}

function groupReadyForEnqueue(items: PendingUpload[]): EnqueueGroup[] {
  const groups: EnqueueGroup[] = [];
  const existingMap = new Map<string, EnqueueGroup>();

  for (const item of items) {
    if (item.gameMode === 'existing' && item.gameId) {
      const key = `${item.systemId}|game:${item.gameId}`;
      let group = existingMap.get(key);
      if (!group) {
        group = { systemId: item.systemId!, gameId: item.gameId, items: [] };
        existingMap.set(key, group);
        groups.push(group);
      }
      group.items.push(item);
    } else {
      groups.push({
        systemId: item.systemId!,
        createTitle: item.createTitle.trim() || titleFromFileName(item.file.name),
        items: [item],
      });
    }
  }

  return groups;
}

function readShowPastPreference(): boolean {
  try {
    return sessionStorage.getItem(PAST_UPLOADS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function toQueueItem(job: UploadJob): AjaxUploadItem {
  return {
    id: job.id,
    name: job.name,
    size: job.size,
    progress: barProgress(job),
    state: job.state === 'error' ? 'error' : job.state,
    message: job.message,
  };
}

function barProgress(job: UploadJob): number {
  if (job.state === 'complete') {
    return 100;
  }
  if (job.state === 'queued') {
    return Math.max(job.progress || 0, 5);
  }
  return Math.min(100, Math.max(0, job.progress || 0));
}

function isActiveJob(job: UploadJob): boolean {
  return job.state === 'queued' || job.state === 'uploading' || job.state === 'processing';
}

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : '';
}

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '');
  return base.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || fileName;
}
