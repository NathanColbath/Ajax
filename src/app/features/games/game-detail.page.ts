import { DecimalPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameDetail, GamesApi } from '../../api';
import { AjaxEmptyState, AjaxFeedbackService, AjaxStatusChip } from '../../shared/interactions';
import { AjaxButton, AjaxCard, AjaxIcon, AjaxSpinner, AjaxTab, AjaxTabs } from '../../shared/ui';

@Component({
  selector: 'ajax-game-detail-page',
  standalone: true,
  imports: [
    DecimalPipe,
    DatePipe,
    RouterLink,
    AjaxButton,
    AjaxCard,
    AjaxIcon,
    AjaxSpinner,
    AjaxTabs,
    AjaxTab,
    AjaxEmptyState,
    AjaxStatusChip,
  ],
  templateUrl: './game-detail.page.html',
  styleUrl: './game-detail.page.scss',
})
export class GameDetailPage {
  private readonly api = inject(GamesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly feedback = inject(AjaxFeedbackService);

  readonly loading = signal(true);
  readonly game = signal<GameDetail | null>(null);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.getById(id).subscribe({
      next: (game) => {
        this.game.set(game);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  stars(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
  }

  toggleFavorite(): void {
    const current = this.game();
    if (!current) {
      return;
    }
    this.api.toggleFavorite(current.id).subscribe((game) => {
      this.game.set(game);
      this.feedback.success(game.favorite ? 'Added to your favorites' : 'Removed from your favorites');
    });
  }

  download(name: string): void {
    this.feedback.info(`Download started · ${name}`);
  }
}
