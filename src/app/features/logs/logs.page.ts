import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { interval } from 'rxjs';
import { LogEntry, LogsApi } from '../../api';
import { apiErrorMessage } from '../../core/api';
import { LibrarySettingsService } from '../../core/config/library-settings.service';
import { AjaxConfirmationService, AjaxEmptyState, AjaxFeedbackService } from '../../shared/interactions';
import { AjaxButton, AjaxInput, AjaxSelect, AjaxSelectOption, AjaxSpinner } from '../../shared/ui';

@Component({
  selector: 'ajax-logs-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    AjaxButton,
    AjaxInput,
    AjaxSelect,
    AjaxSelectOption,
    AjaxSpinner,
    AjaxEmptyState,
  ],
  templateUrl: './logs.page.html',
  styleUrl: './logs.page.scss',
})
export class LogsPage implements OnInit {
  private readonly api = inject(LogsApi);
  private readonly feedback = inject(AjaxFeedbackService);
  private readonly confirmation = inject(AjaxConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly librarySettings = inject(LibrarySettingsService);

  readonly loading = signal(true);
  readonly entries = signal<LogEntry[]>([]);
  readonly selected = signal<LogEntry | null>(null);
  readonly autoRefresh = signal(true);

  level = '';
  category = '';
  search = '';

  private maxId = 0;

  ngOnInit(): void {
    this.librarySettings.ensureLoaded();
    this.reload(true);
    interval(this.librarySettings.logAutoRefreshIntervalMs())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.autoRefresh()) {
          this.poll();
        }
      });
  }

  reload(reset = false): void {
    this.loading.set(true);
    this.api
      .list({
        limit: 150,
        level: this.level || undefined,
        category: this.category || undefined,
        search: this.search.trim() || undefined,
      })
      .subscribe({
        next: (rows) => {
          this.entries.set(rows);
          this.maxId = rows.reduce((m, r) => Math.max(m, r.id), 0);
          if (reset) {
            this.selected.set(null);
          }
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.feedback.error('Could not load logs');
        },
      });
  }

  poll(): void {
    if (!this.maxId || this.level || this.category || this.search.trim()) {
      this.reload();
      return;
    }
    this.api.list({ afterId: this.maxId, limit: 100 }).subscribe({
      next: (rows) => {
        if (!rows.length) {
          return;
        }
        this.entries.update((current) => [...[...rows].reverse(), ...current].slice(0, 300));
        this.maxId = Math.max(this.maxId, ...rows.map((r) => r.id));
      },
    });
  }

  applyFilters(): void {
    this.reload(true);
  }

  clearFilters(): void {
    this.level = '';
    this.category = '';
    this.search = '';
    this.reload(true);
  }

  select(entry: LogEntry): void {
    this.selected.set(entry);
  }

  toggleAutoRefresh(): void {
    this.autoRefresh.update((v) => !v);
  }

  async purge(): Promise<void> {
    const ok = await this.confirmation.confirm({
      title: 'Purge old logs?',
      message: 'Remove log entries older than 30 days. This cannot be undone.',
      confirmLabel: 'Purge',
      severity: 'danger',
    });
    if (!ok) {
      return;
    }
    this.api.purge(this.librarySettings.logPurgeDefaultDays()).subscribe({
      next: (removed) => {
        this.feedback.success(
          `Removed ${removed} log entries older than ${this.librarySettings.logPurgeDefaultDays()} days`,
        );
        this.reload(true);
      },
      error: () => this.feedback.error('Purge failed (super admin only)'),
    });
  }

  async deleteSelected(): Promise<void> {
    const entry = this.selected();
    if (!entry) {
      return;
    }
    const ok = await this.confirmation.confirm({
      title: 'Delete log entry?',
      message: `Remove this ${entry.level} log from ${entry.category}.`,
      confirmLabel: 'Delete',
      severity: 'danger',
    });
    if (!ok) {
      return;
    }
    this.api.delete(entry.id).subscribe({
      next: () => {
        this.entries.update((list) => list.filter((e) => e.id !== entry.id));
        this.selected.set(null);
        this.feedback.success('Log entry deleted');
      },
      error: (err) => this.feedback.error(apiErrorMessage(err, 'Failed to delete log')),
    });
  }
}
