import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PageEvent } from '@angular/material/paginator';
import { firstValueFrom } from 'rxjs';
import {
  MetadataApi,
  MetadataProvider,
  MetadataReviewItem,
  PublicEnrichmentStatus,
} from '../../api';
import {
  AjaxConfirmationService,
  AjaxEmptyState,
  AjaxFeedbackService,
  AjaxStatusChip,
  AjaxStatusTone,
} from '../../shared/interactions';
import { AjaxButton, AjaxPagination, AjaxSpinner } from '../../shared/ui';

@Component({
  selector: 'ajax-metadata-page',
  standalone: true,
  imports: [
    DecimalPipe,
    MatProgressBarModule,
    AjaxButton,
    AjaxSpinner,
    AjaxEmptyState,
    AjaxStatusChip,
    AjaxPagination,
  ],
  templateUrl: './metadata.page.html',
  styleUrl: './metadata.page.scss',
})
export class MetadataPage {
  private readonly api = inject(MetadataApi);
  private readonly feedback = inject(AjaxFeedbackService);
  private readonly confirmation = inject(AjaxConfirmationService);

  readonly loading = signal(true);
  readonly acceptingAll = signal(false);
  /** Item currently accepting or skipping (row micro-action). */
  readonly actingId = signal<string | null>(null);
  readonly actingKind = signal<'accept' | 'skip' | null>(null);
  readonly acceptProgress = signal<{ done: number; total: number } | null>(null);
  readonly providers = signal<MetadataProvider[]>([]);
  readonly queue = signal<MetadataReviewItem[]>([]);
  readonly enrichment = signal<PublicEnrichmentStatus | null>(null);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(8);

  readonly pagedQueue = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.queue().slice(start, start + this.pageSize());
  });

  readonly acceptPercent = computed(() => {
    const progress = this.acceptProgress();
    if (!progress || progress.total === 0) {
      return 0;
    }
    return Math.round((100 * progress.done) / progress.total);
  });

  readonly queueBusy = computed(() => this.acceptingAll() || this.actingId() != null);

  constructor() {
    this.reload();
  }

  statusTone(status: string): AjaxStatusTone {
    switch (status) {
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'running':
        return 'info';
      default:
        return 'neutral';
    }
  }

  reload(): void {
    this.loading.set(true);
    this.api.listProviders().subscribe((providers) => this.providers.set(providers));
    this.api.getEnrichment().subscribe({
      next: (status) => this.enrichment.set(status),
      error: () => this.enrichment.set(null),
    });
    this.api.listQueue().subscribe({
      next: (queue) => {
        this.setQueue(queue);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  run(id: string): void {
    this.api.runProvider(id).subscribe((providers) => {
      this.providers.set(providers);
      this.feedback.info('Provider run started');
      this.pollUntilIdle(id);
    });
  }

  runEnrichment(): void {
    this.api.runEnrichment().subscribe((status) => {
      this.enrichment.set(status);
      this.feedback.info('Public enrichment started');
      this.pollEnrichmentUntilIdle();
    });
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  private pollUntilIdle(providerId: string, attempt = 0): void {
    if (attempt >= 20) {
      this.reload();
      return;
    }

    window.setTimeout(() => {
      this.api.listProviders().subscribe((providers) => {
        this.providers.set(providers);
        const provider = providers.find((p) => p.id === providerId);
        const running = provider?.status === 'running';
        this.api.listQueue().subscribe((queue) => this.setQueue(queue));
        if (running) {
          this.pollUntilIdle(providerId, attempt + 1);
        }
      });
    }, 1500);
  }

  private pollEnrichmentUntilIdle(attempt = 0): void {
    if (attempt >= 40) {
      this.api.getEnrichment().subscribe((status) => this.enrichment.set(status));
      return;
    }

    window.setTimeout(() => {
      this.api.getEnrichment().subscribe((status) => {
        this.enrichment.set(status);
        if (status.status === 'running') {
          this.pollEnrichmentUntilIdle(attempt + 1);
        }
      });
    }, 2000);
  }

  accept(id: string): void {
    if (this.queueBusy()) {
      return;
    }
    this.actingId.set(id);
    this.actingKind.set('accept');
    this.api.accept(id).subscribe({
      next: (queue) => {
        this.setQueue(queue);
        this.clearActing();
        this.feedback.success('Match accepted');
      },
      error: () => {
        this.clearActing();
        this.feedback.error('Could not accept match');
      },
    });
  }

  async acceptAll(): Promise<void> {
    const items = [...this.queue()];
    const count = items.length;
    if (count === 0 || this.queueBusy()) {
      return;
    }

    const ok = await this.confirmation.confirm({
      title: 'Accept all matches?',
      message: `Apply and clear ${count} pending review item${count === 1 ? '' : 's'}.`,
      confirmLabel: 'Accept all',
      cancelLabel: 'Cancel',
    });
    if (!ok) {
      return;
    }

    this.acceptingAll.set(true);
    this.acceptProgress.set({ done: 0, total: count });

    let accepted = 0;
    let failed = 0;
    let latestQueue = this.queue();

    for (const item of items) {
      try {
        latestQueue = await firstValueFrom(this.api.accept(item.id));
        this.setQueue(latestQueue);
        accepted++;
      } catch {
        failed++;
      }
      this.acceptProgress.set({ done: accepted + failed, total: count });
      // Pace requests so cover CDNs are less likely to rate-limit (429).
      if (accepted + failed < count) {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      }
    }

    this.acceptingAll.set(false);
    this.acceptProgress.set(null);

    if (failed === 0) {
      this.feedback.success(`Accepted ${accepted} match${accepted === 1 ? '' : 'es'}`);
    } else if (accepted === 0) {
      this.feedback.error('Could not accept matches');
    } else {
      this.feedback.warning(`Accepted ${accepted}, ${failed} failed`);
    }
  }

  skip(id: string): void {
    if (this.queueBusy()) {
      return;
    }
    this.actingId.set(id);
    this.actingKind.set('skip');
    this.api.skip(id).subscribe({
      next: (queue) => {
        this.setQueue(queue);
        this.clearActing();
        this.feedback.info('Skipped');
      },
      error: () => {
        this.clearActing();
        this.feedback.error('Could not skip match');
      },
    });
  }

  private clearActing(): void {
    this.actingId.set(null);
    this.actingKind.set(null);
  }

  private setQueue(queue: MetadataReviewItem[]): void {
    this.queue.set(queue);
    const maxPage = Math.max(0, Math.ceil(queue.length / this.pageSize()) - 1);
    if (this.pageIndex() > maxPage) {
      this.pageIndex.set(maxPage);
    }
  }
}
