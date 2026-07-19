import { UpperCasePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ExportFormat, ExportJob, ExportScope, ExportsApi } from '../../api';
import {
  AjaxActionButton,
  AjaxActionState,
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
}
