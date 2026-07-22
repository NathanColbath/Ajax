import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  GameDetail,
  GamePublicFeedback,
  GameReview,
  GamesApi,
  ListsApi,
  SystemsApi,
  UpdateGameRequest,
  UserGameListSummary,
} from '../../api';
import { apiErrorMessage } from '../../core/api';
import { SessionService } from '../../core/auth/session.service';
import {
  AjaxConfirmationService,
  AjaxEmptyState,
  AjaxFeedbackService,
  AjaxStatusChip,
} from '../../shared/interactions';
import {
  isExtensionPlayable,
  resolveEmulatorJsCore,
} from '../../shared/media/emulator-cores';
import {
  AjaxButton,
  AjaxIcon,
  AjaxInput,
  AjaxSpinner,
  AjaxTab,
  AjaxTabs,
  AjaxTextarea,
} from '../../shared/ui';

@Component({
  selector: 'ajax-game-detail-page',
  standalone: true,
  imports: [
    DecimalPipe,
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    AjaxButton,
    AjaxIcon,
    AjaxInput,
    AjaxTextarea,
    AjaxSpinner,
    AjaxTabs,
    AjaxTab,
    AjaxEmptyState,
    AjaxStatusChip,
  ],
  templateUrl: './game-detail.page.html',
  styleUrl: './game-detail.page.scss',
})
export class GameDetailPage implements OnDestroy {
  private readonly api = inject(GamesApi);
  private readonly listsApi = inject(ListsApi);
  private readonly systemsApi = inject(SystemsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly feedback = inject(AjaxFeedbackService);
  private readonly confirmation = inject(AjaxConfirmationService);
  private readonly session = inject(SessionService);

  readonly loading = signal(true);
  readonly game = signal<GameDetail | null>(null);
  readonly canPlay = signal(false);
  readonly isAdmin = this.session.isAtLeast('admin');
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly coverUrl = signal<string | null>(null);
  readonly screenshotUrls = signal<Record<number, string>>({});
  readonly reviews = signal<GameReview[]>([]);
  readonly publicFeedback = signal<GamePublicFeedback | null>(null);
  readonly reviewSaving = signal(false);
  readonly userLists = signal<UserGameListSummary[]>([]);
  readonly addingToList = signal(false);

  draftTitle = '';
  draftRegion = '';
  draftYear = 0;
  draftDescription = '';
  draftPublisher = '';
  draftDeveloper = '';
  draftReleaseDate = '';
  draftPlayers = '';
  draftNotes = '';
  draftGenres = '';
  draftTags = '';
  draftLanguages = '';
  draftReviewRating = 0;
  draftReviewBody = '';

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.getById(id).subscribe({
      next: (game) => {
        this.game.set(game);
        this.syncDraft(game);
        this.draftReviewRating = game.myRating ?? 0;
        this.draftReviewBody = game.myReviewBody ?? '';
        this.loading.set(false);
        this.loadCover(game);
        this.loadScreenshots(game);
        this.loadReviews(game.id);
        this.loadPublicFeedback(game.id);
        this.loadUserLists();
        this.resolvePlayability(game);
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy(): void {
    this.revokeCover();
    this.revokeScreenshots();
  }

  hasText(value: string | null | undefined): boolean {
    return !!value?.trim();
  }

  catalogLabel(game: GameDetail): string {
    return game.owned ? 'In library' : 'Wishlist / missing dump';
  }

  metaLine(game: GameDetail): string {
    const parts = [game.system];
    if (this.hasText(game.region)) {
      parts.push(game.region.trim());
    }
    parts.push(game.owned ? 'In library' : 'Wishlist');
    return parts.join(' · ');
  }

  showReleaseDate(game: GameDetail): boolean {
    if (!this.hasText(game.releaseDate) || game.year <= 0) {
      return false;
    }
    const time = Date.parse(game.releaseDate);
    return !Number.isNaN(time) && time > 0;
  }

  aboutFacts(game: GameDetail): { label: string; value: string }[] {
    const rows: { label: string; value: string }[] = [];
    if (this.hasText(game.publisher)) {
      rows.push({ label: 'Publisher', value: game.publisher.trim() });
    }
    if (this.hasText(game.developer)) {
      rows.push({ label: 'Developer', value: game.developer.trim() });
    }
    if (this.showReleaseDate(game)) {
      rows.push({
        label: 'Released',
        value: new Date(game.releaseDate).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      });
    } else if (game.year > 0) {
      rows.push({ label: 'Year', value: String(game.year) });
    }
    if (this.hasText(game.region)) {
      rows.push({ label: 'Region', value: game.region.trim() });
    }
    if (this.hasText(game.players)) {
      rows.push({ label: 'Players', value: game.players.trim() });
    }
    const languages = game.languages.filter((l) => this.hasText(l));
    if (languages.length > 0) {
      rows.push({ label: 'Languages', value: languages.join(', ') });
    }
    if (game.genres.length > 0) {
      rows.push({ label: 'Genres', value: game.genres.join(', ') });
    }
    const tags = game.tags.filter((t) => this.hasText(t));
    if (tags.length > 0) {
      rows.push({ label: 'Tags', value: tags.join(', ') });
    }
    rows.push({ label: 'Catalog', value: this.catalogLabel(game) });
    return rows;
  }

  metadataRows(game: GameDetail): { label: string; value: string }[] {
    const rows = this.aboutFacts(game);
    if (this.hasText(game.metadataSource)) {
      rows.push({ label: 'Source', value: game.metadataSource.trim() });
    }
    if (this.hasText(game.externalId)) {
      rows.push({ label: 'External ID', value: game.externalId.trim() });
    }
    if (game.ratingCount > 0) {
      rows.push({
        label: 'Library rating',
        value: `${game.rating.toFixed(1)} / 5 (${game.ratingCount})`,
      });
    }
    rows.push({ label: 'Downloads', value: String(game.downloadCount) });
    return rows;
  }

  screenshotIndices(game: GameDetail): number[] {
    const count = game.screenshotCount || game.screenshots.length;
    return Array.from({ length: count }, (_, i) => i);
  }

  aboutScreenshotIndices(game: GameDetail): number[] {
    return this.screenshotIndices(game).slice(0, 6);
  }

  stars(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
  }

  setDraftRating(value: number): void {
    this.draftReviewRating = value;
  }

  isColorShot(shot: string): boolean {
    return shot.startsWith('#');
  }

  startEdit(): void {
    const g = this.game();
    if (!g) {
      return;
    }
    this.syncDraft(g);
    this.editing.set(true);
  }

  cancelEdit(): void {
    const g = this.game();
    if (g) {
      this.syncDraft(g);
    }
    this.editing.set(false);
  }

  saveMetadata(): void {
    const current = this.game();
    if (!current) {
      return;
    }
    const request: UpdateGameRequest = {
      title: this.draftTitle.trim(),
      region: this.draftRegion.trim(),
      year: Number(this.draftYear) || 0,
      description: this.draftDescription,
      publisher: this.draftPublisher.trim(),
      developer: this.draftDeveloper.trim(),
      releaseDate: this.draftReleaseDate.trim(),
      players: this.draftPlayers.trim(),
      notes: this.draftNotes,
      genres: this.splitList(this.draftGenres),
      tags: this.splitList(this.draftTags),
      languages: this.splitList(this.draftLanguages),
    };
    this.saving.set(true);
    this.api.update(current.id, request).subscribe({
      next: (game) => {
        this.game.set(game);
        this.syncDraft(game);
        this.editing.set(false);
        this.saving.set(false);
        this.feedback.success('Metadata saved');
      },
      error: () => {
        this.saving.set(false);
        this.feedback.error('Failed to save metadata');
      },
    });
  }

  saveReview(): void {
    const current = this.game();
    if (!current || this.draftReviewRating < 1) {
      this.feedback.warning('Pick a star rating first');
      return;
    }
    this.reviewSaving.set(true);
    this.api
      .upsertReview(current.id, {
        rating: this.draftReviewRating,
        body: this.draftReviewBody.trim(),
      })
      .subscribe({
        next: () => {
          this.reviewSaving.set(false);
          this.feedback.success('Review saved');
          this.api.getById(current.id).subscribe((game) => {
            this.game.set(game);
            this.draftReviewRating = game.myRating ?? this.draftReviewRating;
            this.draftReviewBody = game.myReviewBody ?? this.draftReviewBody;
          });
          this.loadReviews(current.id);
        },
        error: (err) => {
          this.reviewSaving.set(false);
          this.feedback.error(apiErrorMessage(err, 'Failed to save review'));
        },
      });
  }

  deleteMyReview(): void {
    const current = this.game();
    if (!current) {
      return;
    }
    this.api.deleteMyReview(current.id).subscribe({
      next: () => {
        this.draftReviewRating = 0;
        this.draftReviewBody = '';
        this.feedback.success('Review removed');
        this.api.getById(current.id).subscribe((game) => this.game.set(game));
        this.loadReviews(current.id);
      },
      error: () => this.feedback.error('Failed to remove review'),
    });
  }

  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const current = this.game();
    if (!file || !current) {
      return;
    }
    this.api.uploadCover(current.id, file).subscribe({
      next: (game) => {
        this.game.set(game);
        this.loadCover(game);
        this.feedback.success('Cover uploaded');
      },
      error: () => this.feedback.error('Cover upload failed'),
    });
  }

  removeCover(): void {
    const current = this.game();
    if (!current) {
      return;
    }
    this.api.deleteCover(current.id).subscribe({
      next: (game) => {
        this.game.set(game);
        this.revokeCover();
        this.coverUrl.set(null);
        this.feedback.success('Cover removed');
      },
      error: () => this.feedback.error('Failed to remove cover'),
    });
  }

  onScreenshotsSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    const current = this.game();
    if (!files.length || !current) {
      return;
    }
    this.api.uploadScreenshots(current.id, files).subscribe({
      next: (game) => {
        this.game.set(game);
        this.loadScreenshots(game);
        this.feedback.success('Screenshots uploaded');
      },
      error: () => this.feedback.error('Screenshot upload failed'),
    });
  }

  removeScreenshot(index: number): void {
    const current = this.game();
    if (!current) {
      return;
    }
    this.api.deleteScreenshot(current.id, index).subscribe({
      next: (game) => {
        this.game.set(game);
        this.loadScreenshots(game);
        this.feedback.success('Screenshot removed');
      },
      error: () => this.feedback.error('Failed to remove screenshot'),
    });
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

  loadUserLists(): void {
    this.listsApi.list().subscribe({
      next: (lists) => this.userLists.set(lists),
      error: () => this.userLists.set([]),
    });
  }

  addToList(listId: string, listName: string): void {
    const current = this.game();
    if (!current) {
      return;
    }
    this.addingToList.set(true);
    this.listsApi.addGame(listId, current.id).subscribe({
      next: () => {
        this.addingToList.set(false);
        this.feedback.success(`Added to “${listName}”`);
        this.loadUserLists();
      },
      error: (err) => {
        this.addingToList.set(false);
        this.feedback.warning(apiErrorMessage(err, 'Could not add to list'));
      },
    });
  }

  goToLists(): void {
    void this.router.navigate(['/lists']);
  }

  play(): void {
    const current = this.game();
    if (!current || !this.canPlay()) {
      return;
    }
    void this.router.navigate(['/games', current.id, 'play']);
  }

  download(file?: { id: string; name: string }): void {
    const current = this.game();
    if (!current) {
      return;
    }

    const target =
      file ?? (current.files[0] ? { id: current.files[0].id, name: current.files[0].name } : null);

    if (!target) {
      this.feedback.warning('No files available to download');
      return;
    }

    this.api.downloadFile(current.id, target.id, target.name).subscribe({
      next: () => this.feedback.success(`Downloaded ${target.name}`),
      error: () => this.feedback.warning('Download failed'),
    });
  }

  async deleteGame(): Promise<void> {
    const current = this.game();
    if (!current) {
      return;
    }
    const ok = await this.confirmation.confirm({
      title: 'Delete game?',
      message: `Permanently delete “${current.title}” and its library files.`,
      confirmLabel: 'Delete',
      severity: 'danger',
    });
    if (!ok) {
      return;
    }
    this.api.deleteGame(current.id).subscribe({
      next: () => {
        this.feedback.success(`Deleted ${current.title}`);
        void this.router.navigate(['/games']);
      },
      error: (err) => this.feedback.error(apiErrorMessage(err, 'Failed to delete game')),
    });
  }

  async deleteFile(file: { id: string; name: string }): Promise<void> {
    const current = this.game();
    if (!current) {
      return;
    }
    const ok = await this.confirmation.confirm({
      title: 'Delete file?',
      message: `Remove “${file.name}” from this game.`,
      confirmLabel: 'Delete',
      severity: 'danger',
    });
    if (!ok) {
      return;
    }
    this.api.deleteFile(current.id, file.id).subscribe({
      next: () => {
        this.game.update((g) =>
          g ? { ...g, files: g.files.filter((f) => f.id !== file.id) } : g,
        );
        this.feedback.success(`Deleted ${file.name}`);
      },
      error: (err) => this.feedback.error(apiErrorMessage(err, 'Failed to delete file')),
    });
  }

  private loadReviews(gameId: string): void {
    this.api.listReviews(gameId).subscribe({
      next: (reviews) => this.reviews.set(reviews),
      error: () => this.reviews.set([]),
    });
  }

  private loadPublicFeedback(gameId: string): void {
    this.api.getPublicFeedback(gameId).subscribe({
      next: (feedback) => this.publicFeedback.set(feedback),
      error: () => this.publicFeedback.set(null),
    });
  }

  private syncDraft(g: GameDetail): void {
    this.draftTitle = g.title;
    this.draftRegion = g.region;
    this.draftYear = g.year;
    this.draftDescription = g.description;
    this.draftPublisher = g.publisher;
    this.draftDeveloper = g.developer;
    this.draftReleaseDate = g.releaseDate;
    this.draftPlayers = g.players;
    this.draftNotes = g.notes;
    this.draftGenres = g.genres.join(', ');
    this.draftTags = g.tags.join(', ');
    this.draftLanguages = g.languages.join(', ');
  }

  private splitList(value: string): string[] {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  private loadCover(game: GameDetail): void {
    this.revokeCover();
    if (!game.hasArt) {
      this.coverUrl.set(null);
      return;
    }
    this.api.getCoverObjectUrl(game.id).subscribe({
      next: (url) => this.coverUrl.set(url),
      error: () => this.coverUrl.set(null),
    });
  }

  private loadScreenshots(game: GameDetail): void {
    this.revokeScreenshots();
    const urls: Record<number, string> = {};
    const count = game.screenshotCount || game.screenshots.length;
    for (let i = 0; i < count; i++) {
      const shot = game.screenshots[i];
      if (shot && this.isColorShot(shot)) {
        continue;
      }
      this.api.getScreenshotObjectUrl(game.id, i).subscribe({
        next: (url) => {
          if (url) {
            urls[i] = url;
            this.screenshotUrls.set({ ...urls });
          }
        },
      });
    }
  }

  private revokeCover(): void {
    const url = this.coverUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  private revokeScreenshots(): void {
    for (const url of Object.values(this.screenshotUrls())) {
      URL.revokeObjectURL(url);
    }
    this.screenshotUrls.set({});
  }

  private resolvePlayability(game: GameDetail): void {
    if (!game.files?.length) {
      this.canPlay.set(false);
      return;
    }
    this.systemsApi.list().subscribe({
      next: (systems) => {
        const system = systems.find(
          (s) => s.shortName.toLowerCase() === game.system.toLowerCase(),
        );
        const core = resolveEmulatorJsCore(system?.emulatorJsCore, game.system || system?.shortName);
        if (!core) {
          this.canPlay.set(false);
          return;
        }
        this.canPlay.set(game.files.some((f) => isExtensionPlayable(core, f.extension)));
      },
      error: () => {
        const core = resolveEmulatorJsCore(null, game.system);
        this.canPlay.set(
          !!core && game.files.some((f) => isExtensionPlayable(core, f.extension)),
        );
      },
    });
  }
}
