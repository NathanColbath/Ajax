import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameSystem, SystemsApi, UploadJob, UploadsApi } from '../../api';
import {
  AjaxEmptyState,
  AjaxFeedbackService,
  AjaxProgressAction,
  AjaxProgressStep,
  AjaxUploadDropzone,
  AjaxUploadItem,
  AjaxUploadQueue,
} from '../../shared/interactions';
import { AjaxSelect, AjaxSelectOption, AjaxSpinner } from '../../shared/ui';

@Component({
  selector: 'ajax-uploads-page',
  standalone: true,
  imports: [
    FormsModule,
    AjaxSelect,
    AjaxSelectOption,
    AjaxSpinner,
    AjaxEmptyState,
    AjaxUploadDropzone,
    AjaxUploadQueue,
    AjaxProgressAction,
  ],
  templateUrl: './uploads.page.html',
  styleUrl: './uploads.page.scss',
})
export class UploadsPage {
  private readonly api = inject(UploadsApi);
  private readonly systemsApi = inject(SystemsApi);
  private readonly feedback = inject(AjaxFeedbackService);

  readonly loading = signal(true);
  readonly jobs = signal<UploadJob[]>([]);
  readonly systems = signal<GameSystem[]>([]);
  readonly systemId = signal<string | undefined>(undefined);

  readonly steps = signal<AjaxProgressStep[]>([
    { id: 'pick', label: 'Choose target system', state: 'complete' },
    { id: 'drop', label: 'Drop or select files', state: 'active' },
    { id: 'process', label: 'Match & catalog', state: 'pending' },
  ]);

  readonly queueItems = signal<AjaxUploadItem[]>([]);

  constructor() {
    this.systemsApi.list().subscribe((systems) => this.systems.set(systems));
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (jobs) => {
        this.jobs.set(jobs);
        this.queueItems.set(jobs.map(toQueueItem));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFiles(files: File[]): void {
    this.api.enqueue(files, this.systemId()).subscribe((created) => {
      this.jobs.update((jobs) => [...created, ...jobs]);
      this.queueItems.set(this.jobs().map(toQueueItem));
      this.steps.set([
        { id: 'pick', label: 'Choose target system', state: 'complete' },
        { id: 'drop', label: 'Drop or select files', state: 'complete' },
        { id: 'process', label: 'Match & catalog', state: 'active' },
      ]);
      this.feedback.success(`${files.length} file(s) queued`);
    });
  }

  cancel(id: string): void {
    this.api.cancel(id).subscribe((jobs) => {
      this.jobs.set(jobs);
      this.queueItems.set(jobs.map(toQueueItem));
    });
  }

  retry(id: string): void {
    this.api.retry(id).subscribe((jobs) => {
      this.jobs.set(jobs);
      this.queueItems.set(jobs.map(toQueueItem));
    });
  }
}

function toQueueItem(job: UploadJob): AjaxUploadItem {
  return {
    id: job.id,
    name: job.name,
    size: job.size,
    progress: job.progress,
    state: job.state === 'error' ? 'error' : job.state,
    message: job.message,
  };
}
