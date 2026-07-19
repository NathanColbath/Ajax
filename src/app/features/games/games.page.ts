import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';
import { GamesApi, GameSummary } from '../../api';
import { AjaxEmptyState } from '../../shared/interactions';
import {
  AjaxButton,
  AjaxInput,
  AjaxPagination,
  AjaxSpinner,
  AjaxTable,
  AjaxTableColumn,
} from '../../shared/ui';

@Component({
  selector: 'ajax-games-page',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    RouterLink,
    AjaxButton,
    AjaxInput,
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

  readonly loading = signal(true);
  readonly games = signal<GameSummary[]>([]);
  readonly systems = signal<string[]>([]);
  readonly search = signal('');
  readonly selectedSystem = signal<string | undefined>(undefined);
  readonly ownedOnly = signal(false);
  readonly view = signal<'grid' | 'list' | 'table'>('grid');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(8);

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
    this.api.systems().subscribe((systems) => this.systems.set(systems));
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api
      .list({
        search: this.search(),
        system: this.selectedSystem(),
        ownedOnly: this.ownedOnly() || undefined,
      })
      .subscribe({
        next: (games) => {
          this.games.set(games);
          this.pageIndex.set(0);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.reload();
  }

  toggleSystem(system: string): void {
    this.selectedSystem.set(this.selectedSystem() === system ? undefined : system);
    this.reload();
  }

  toggleOwned(): void {
    this.ownedOnly.update((v) => !v);
    this.reload();
  }

  setView(view: 'grid' | 'list' | 'table'): void {
    this.view.set(view);
  }

  clearFilters(): void {
    this.selectedSystem.set(undefined);
    this.ownedOnly.set(false);
    this.search.set('');
    this.reload();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }
}
