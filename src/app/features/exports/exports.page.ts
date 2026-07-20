import { UpperCasePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ExportFormat, ExportJob, ExportScope, ExportsApi } from '../../api';
import { apiErrorMessage } from '../../core/api';
import {
  AjaxActionButton,
  AjaxActionState,
  AjaxConfirmationService,
  AjaxEmptyState,
  AjaxFeedbackService,
  AjaxStatusChip,
} from '../../shared/interactions';
import { AjaxButton, AjaxSpinner } from '../../shared/ui';

@Component({
  selector: 'ajax-exports-page',
  standalone: true,
  imports: [UpperCasePipe, AjaxButton, AjaxSpinner, AjaxEmptyState, AjaxStatusChip, AjaxActionButton],
  templateUrl: './exports.page.html',
  styleUrl: './exports.page.scss',
})
export class ExportsPage {
  private readonly api = inject(ExportsApi);
  private readonly feedback = inject(AjaxFeedbackService);
  private readonly confirmation = inject(AjaxConfirmationService);

  readonly loading = signal(true);
  readonly jobs = signal<ExportJob[]>([]);
  readonly format = signal<ExportFormat>('json');
  readonly scopes = signal<ExportScope[]>(['games']);
  readonly runState = signal<AjaxActionState>('idle');

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.listJobs().subscribe({
      next: (jobs) => {
        this.jobs.set(jobs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setFormat(format: ExportFormat): void {
    this.format.set(format);
  }

  toggleScope(scope: ExportScope): void {
    this.scopes.update((current) =>
      current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope],
    );
  }

  hasScope(scope: ExportScope): boolean {
    return this.scopes().includes(scope);
  }

  run(): void {
    if (this.scopes().length === 0) {
      this.feedback.warning('Pick at least one scope');
      return;
    }
    this.runState.set('loading');
    this.api.run(this.format(), this.scopes()).subscribe({
      next: (jobs) => {
        this.jobs.set(jobs);
        this.runState.set('success');
        this.feedback.success('Export ready');
        window.setTimeout(() => this.runState.set('idle'), 1200);
      },
      error: () => {
        this.runState.set('error');
        window.setTimeout(() => this.runState.set('idle'), 1500);
      },
    });
  }

  download(job: ExportJob): void {
    const fileName = job.fileName ?? `library-export.${job.format}`;
    this.api.download(job.id, fileName).subscribe({
      next: () => this.feedback.success(`Downloaded ${fileName}`),
      error: () => this.feedback.warning('Download failed — export may still be running'),
    });
  }

  async deleteJob(job: ExportJob): Promise<void> {
    const ok = await this.confirmation.confirm({
      title: 'Delete export?',
      message: `Remove this ${job.format.toUpperCase()} export job and its file.`,
      confirmLabel: 'Delete',
      severity: 'danger',
    });
    if (!ok) {
      return;
    }
    this.api.delete(job.id).subscribe({
      next: () => {
        this.jobs.update((list) => list.filter((j) => j.id !== job.id));
        this.feedback.success('Export deleted');
      },
      error: (err) => this.feedback.error(apiErrorMessage(err, 'Failed to delete export')),
    });
  }
}
