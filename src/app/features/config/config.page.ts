import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigApi, StorageMetrics, SystemConfig } from '../../api';
import { AjaxApiMode, ApiModeService } from '../../core/api';
import { SessionService } from '../../core/auth/session.service';
import { AjaxFeedbackService, AjaxStatusChip } from '../../shared/interactions';
import {
  AjaxAccordion,
  AjaxExpansion,
  AjaxInput,
  AjaxPanel,
  AjaxSlideToggle,
  AjaxSpinner,
} from '../../shared/ui';

@Component({
  selector: 'ajax-config-page',
  standalone: true,
  imports: [
    FormsModule,
    AjaxAccordion,
    AjaxExpansion,
    AjaxInput,
    AjaxPanel,
    AjaxSlideToggle,
    AjaxSpinner,
    AjaxStatusChip,
  ],
  templateUrl: './config.page.html',
  styleUrl: './config.page.scss',
})
export class ConfigPage {
  private readonly api = inject(ConfigApi);
  private readonly apiMode = inject(ApiModeService);
  private readonly session = inject(SessionService);
  private readonly feedback = inject(AjaxFeedbackService);

  readonly loading = signal(true);
  readonly config = signal<SystemConfig | null>(null);
  readonly storage = signal<StorageMetrics | null>(null);
  readonly storageError = signal<string | null>(null);
  readonly isSuperAdmin = this.session.canSeeStorageMetrics();

  mockEnabled = this.apiMode.isMock();
  libraryName = '';
  allowUploads = false;

  constructor() {
    this.api.getSystemConfig().subscribe({
      next: (config) => {
        this.config.set(config);
        this.libraryName = config.libraryName;
        this.allowUploads = config.allowStandardUploads;
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    if (this.isSuperAdmin) {
      this.api.getStorageMetrics().subscribe({
        next: (metrics) => this.storage.set(metrics),
        error: (err: Error) => this.storageError.set(err.message || 'Unable to load storage'),
      });
    }
  }

  onMockChange(enabled: boolean): void {
    this.mockEnabled = enabled;
    const mode: AjaxApiMode = enabled ? 'mock' : 'live';
    this.apiMode.setMode(mode);
    this.feedback.info(enabled ? 'Using mock data' : 'Using live API');
  }

  saveConfig(): void {
    this.api
      .updateSystemConfig({
        libraryName: this.libraryName.trim() || 'Game Library',
        allowStandardUploads: this.allowUploads,
      })
      .subscribe((config) => {
        this.config.set(config);
        this.feedback.success('Config saved');
      });
  }
}
