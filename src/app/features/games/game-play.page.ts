import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { GameDetail, GameFile, GamesApi, SystemsApi } from '../../api';
import { apiErrorMessage } from '../../core/api';
import {
  isExtensionPlayable,
  resolveEmulatorJsCore,
} from '../../shared/media/emulator-cores';
import { EmulatorPlayService } from '../../shared/media/emulator-play.service';
import { AjaxButton, AjaxSpinner } from '../../shared/ui';

@Component({
  selector: 'ajax-game-play-page',
  standalone: true,
  imports: [RouterLink, AjaxButton, AjaxSpinner],
  templateUrl: './game-play.page.html',
  styleUrl: './game-play.page.scss',
})
export class GamePlayPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly gamesApi = inject(GamesApi);
  private readonly systemsApi = inject(SystemsApi);
  private readonly emulator = inject(EmulatorPlayService);

  @ViewChild('playerHost', { static: true }) playerHost!: ElementRef<HTMLDivElement>;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly game = signal<GameDetail | null>(null);
  readonly status = signal('Loading ROM…');

  private gameId = '';

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.teardownPlayer();
          this.loading.set(true);
          this.error.set(null);
          this.status.set('Loading game…');
          const id = params.get('id') ?? '';
          this.gameId = id;
          if (!id) {
            return of(null);
          }
          const fileId = this.route.snapshot.queryParamMap.get('fileId');
          return forkJoin({
            game: this.gamesApi.getById(id),
            systems: this.systemsApi.list().pipe(catchError(() => of([]))),
            fileId: of(fileId),
          }).pipe(catchError((err) => {
            this.error.set(apiErrorMessage(err, 'Could not load game'));
            this.loading.set(false);
            return of(null);
          }));
        }),
      )
      .subscribe((bundle) => {
        if (!bundle) {
          return;
        }
        const { game, systems, fileId } = bundle;
        this.game.set(game);
        const system = systems.find(
          (s) => s.shortName.toLowerCase() === game.system.toLowerCase(),
        );
        const core = resolveEmulatorJsCore(system?.emulatorJsCore, game.system || system?.shortName);
        const file = this.pickFile(game.files, core, fileId);
        if (!core) {
          this.loading.set(false);
          this.error.set(`No EmulatorJS core mapped for system “${game.system}”.`);
          return;
        }
        if (!file) {
          this.loading.set(false);
          this.error.set('No playable ROM file found for this game.');
          return;
        }

        this.status.set(`Downloading ${file.name}…`);
        // Record play before ROM download so the two calls do not race on UserGameState insert.
        this.gamesApi
          .recordPlay(game.id)
          .pipe(
            catchError(() => of(undefined)),
            switchMap(() => this.emulator.prepareRom(game.id, file.id)),
          )
          .subscribe({
            next: (blobUrl) => {
              this.status.set('Starting emulator…');
              const host = this.playerHost.nativeElement;
              this.emulator
                .launch({
                  playerHost: host,
                  core,
                  gameUrl: blobUrl,
                  gameName: game.title,
                })
                .subscribe({
                  next: () => {
                    this.loading.set(false);
                    this.status.set('Playing');
                  },
                  error: (err) => {
                    this.loading.set(false);
                    this.error.set(apiErrorMessage(err, 'Emulator failed to start'));
                  },
                });
            },
            error: (err) => {
              this.loading.set(false);
              this.error.set(apiErrorMessage(err, 'Failed to download ROM'));
            },
          });
      });
  }

  ngOnDestroy(): void {
    this.teardownPlayer();
  }

  exit(): void {
    this.teardownPlayer();
    void this.router.navigate(['/games', this.gameId || this.game()?.id]);
  }

  private teardownPlayer(): void {
    this.emulator.teardown(this.playerHost?.nativeElement ?? null);
  }

  private pickFile(files: GameFile[], core: string, preferredId: string | null): GameFile | null {
    if (!files.length) {
      return null;
    }
    if (preferredId) {
      const match = files.find((f) => f.id === preferredId);
      if (match && (!core || isExtensionPlayable(core, match.extension))) {
        return match;
      }
    }
    if (core) {
      const playable = files.find((f) => isExtensionPlayable(core, f.extension));
      if (playable) {
        return playable;
      }
    }
    return files[0] ?? null;
  }
}
