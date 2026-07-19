import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MetadataApi, MetadataProvider, MetadataReviewItem } from '../../api';
import { AjaxEmptyState, AjaxFeedbackService, AjaxStatusChip } from '../../shared/interactions';
import { AjaxButton, AjaxCard, AjaxSpinner } from '../../shared/ui';

@Component({
  selector: 'ajax-metadata-page',
  standalone: true,
  imports: [DecimalPipe, AjaxButton, AjaxCard, AjaxSpinner, AjaxEmptyState, AjaxStatusChip],
  templateUrl: './metadata.page.html',
  styleUrl: './metadata.page.scss',
})
export class MetadataPage {
  private readonly api = inject(MetadataApi);
  private readonly feedback = inject(AjaxFeedbackService);

  readonly loading = signal(true);
  readonly providers = signal<MetadataProvider[]>([]);
  readonly queue = signal<MetadataReviewItem[]>([]);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.listProviders().subscribe((providers) => this.providers.set(providers));
    this.api.listQueue().subscribe({
      next: (queue) => {
        this.queue.set(queue);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  run(id: string): void {
    this.api.runProvider(id).subscribe((providers) => {
      this.providers.set(providers);
      this.feedback.info('Provider run started');
    });
  }

  accept(id: string): void {
    this.api.accept(id).subscribe((queue) => {
      this.queue.set(queue);
      this.feedback.success('Match accepted');
    });
  }

  skip(id: string): void {
    this.api.skip(id).subscribe((queue) => {
      this.queue.set(queue);
      this.feedback.info('Skipped');
    });
  }
}
