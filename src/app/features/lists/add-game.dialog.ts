import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import { GameSummary, GamesApi } from '../../api';
import { AjaxButton, AjaxInput, AjaxSpinner } from '../../shared/ui';
import { AjaxEmptyState } from '../../shared/interactions';

export interface AddGameDialogData {
  excludeIds?: string[];
}

@Component({
  selector: 'ajax-add-game-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, AjaxInput, AjaxButton, AjaxSpinner, AjaxEmptyState],
  template: `
    <h2 mat-dialog-title>Add a game</h2>
    <mat-dialog-content>
      <ajax-input
        label="Search library"
        placeholder="Title or system"
        [ngModel]="query()"
        (ngModelChange)="onSearch($event)"
        name="gameSearch"
      />

      @if (loading()) {
        <div class="loading"><ajax-spinner /></div>
      } @else if (results().length === 0) {
        <ajax-empty-state
          icon="sports_esports"
          title="{{ query().trim().length < 2 ? 'Search your library' : 'No matches' }}"
          description="{{
            query().trim().length < 2
              ? 'Type at least 2 characters to find games.'
              : 'Try a different title or system.'
          }}"
        />
      } @else {
        <ul class="hits">
          @for (game of results(); track game.id) {
            <li>
              <button
                type="button"
                class="hit"
                [class.is-selected]="selected()?.id === game.id"
                (click)="selected.set(game)"
              >
                <strong>{{ game.title }}</strong>
                <span>{{ game.system }}</span>
              </button>
            </li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <ajax-button variant="basic" (clicked)="ref.close()">Cancel</ajax-button>
      <ajax-button
        variant="flat"
        color="primary"
        icon="add"
        [disabled]="!selected()"
        (clicked)="confirm()"
      >
        Add to list
      </ajax-button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      display: grid;
      gap: 0.75rem;
      min-width: min(100%, 520px);
      max-height: 60vh;
      padding-top: 0.5rem;
    }

    .loading {
      display: grid;
      place-items: center;
      min-height: 120px;
    }

    .hits {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.35rem;
      overflow: auto;
      max-height: 40vh;
    }

    .hit {
      width: 100%;
      display: grid;
      gap: 0.15rem;
      text-align: left;
      padding: 0.65rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .hit:hover,
    .hit.is-selected {
      border-color: var(--mat-sys-primary);
      background: var(--mat-sys-surface-container-high);
    }

    .hit strong {
      font-size: 0.92rem;
      font-weight: 600;
    }

    .hit span {
      font-size: 0.78rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class AddGameDialog {
  private readonly gamesApi = inject(GamesApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly data = inject<AddGameDialogData>(MAT_DIALOG_DATA, { optional: true });
  readonly ref = inject(MatDialogRef<AddGameDialog, GameSummary>);

  readonly query = signal('');
  readonly results = signal<GameSummary[]>([]);
  readonly loading = signal(false);
  readonly selected = signal<GameSummary | null>(null);

  private readonly search$ = new Subject<string>();
  private readonly exclude = new Set(this.data?.excludeIds ?? []);

  constructor() {
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          const term = q.trim();
          if (term.length < 2) {
            this.loading.set(false);
            return of([] as GameSummary[]);
          }
          this.loading.set(true);
          return this.gamesApi.list({ search: term }).pipe(
            catchError(() => of([] as GameSummary[])),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((games) => {
        this.results.set(games.filter((g) => !this.exclude.has(g.id)).slice(0, 40));
        this.loading.set(false);
        const sel = this.selected();
        if (sel && !this.results().some((g) => g.id === sel.id)) {
          this.selected.set(null);
        }
      });
  }

  onSearch(value: string): void {
    this.query.set(value);
    this.search$.next(value);
  }

  confirm(): void {
    const game = this.selected();
    if (game) {
      this.ref.close(game);
    }
  }
}
