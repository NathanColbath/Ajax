import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigApi, IntegrationsStatus, StorageMetrics, SystemConfig } from '../../api';
import { DEFAULT_SYSTEM_CONFIG } from '../../api/config/config.models';
import { apiErrorMessage, AjaxApiMode, ApiModeService } from '../../core/api';
import { LibrarySettingsService } from '../../core/config/library-settings.service';
import { SessionService } from '../../core/auth/session.service';
import {
  AjaxConfirmationService,
  AjaxFeedbackService,
  AjaxStatusChip,
} from '../../shared/interactions';
import {
  AjaxAccordion,
  AjaxButton,
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
    DecimalPipe,
    FormsModule,
    AjaxAccordion,
    AjaxExpansion,
    AjaxInput,
    AjaxPanel,
    AjaxSlideToggle,
    AjaxSpinner,
    AjaxStatusChip,
    AjaxButton,
  ],
  templateUrl: './config.page.html',
  styleUrl: './config.page.scss',
})
export class ConfigPage {
  private readonly api = inject(ConfigApi);
  private readonly apiMode = inject(ApiModeService);
  private readonly session = inject(SessionService);
  private readonly librarySettings = inject(LibrarySettingsService);
  private readonly feedback = inject(AjaxFeedbackService);
  private readonly confirmation = inject(AjaxConfirmationService);

  readonly loading = signal(true);
  readonly wiping = signal(false);
  readonly saving = signal(false);
  readonly config = signal<SystemConfig | null>(null);
  readonly storage = signal<StorageMetrics | null>(null);
  readonly storageError = signal<string | null>(null);
  readonly integrations = signal<IntegrationsStatus | null>(null);
  readonly isSuperAdmin = this.session.canSeeStorageMetrics();
  readonly wipeConfirmText = signal('');

  readonly canWipe = computed(
    () => this.wipeConfirmText().trim().toUpperCase() === 'WIPE' && !this.wiping(),
  );

  mockEnabled = this.apiMode.isMock();
  form: SystemConfig = { ...DEFAULT_SYSTEM_CONFIG };

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.getSystemConfig().subscribe({
      next: (config) => {
        this.applyConfig(config);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.api.getIntegrationsStatus().subscribe({
      next: (status) => this.integrations.set(status),
      error: () => this.integrations.set(null),
    });

    if (this.isSuperAdmin) {
      this.api.getStorageMetrics().subscribe({
        next: (metrics) => {
          this.storage.set(metrics);
          this.storageError.set(null);
        },
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
    this.saving.set(true);
    const patch: Partial<SystemConfig> = {
      ...this.form,
      libraryName: this.form.libraryName.trim() || 'Retrojax',
      maxParallelUploadJobs: Math.min(8, Math.max(1, Number(this.form.maxParallelUploadJobs) || 1)),
    };
    this.api.updateSystemConfig(patch).subscribe({
      next: (config) => {
        this.applyConfig(config);
        this.saving.set(false);
        this.feedback.success('Config saved');
      },
      error: (err) => {
        this.saving.set(false);
        this.feedback.error(apiErrorMessage(err, 'Failed to save config'));
      },
    });
  }

  async wipeLibrary(): Promise<void> {
    if (!this.canWipe()) {
      return;
    }

    const ok = await this.confirmation.confirm({
      title: 'Wipe entire library?',
      message:
        'This deletes all catalog data and clears the files folder. Auth0 and API keys are not touched. This cannot be undone.',
      confirmLabel: 'Wipe everything',
      severity: 'danger',
    });
    if (!ok) {
      return;
    }

    this.wiping.set(true);
    this.api.wipe().subscribe({
      next: (result) => {
        this.applyConfig(result.config);
        this.wipeConfirmText.set('');
        this.wiping.set(false);
        this.feedback.success(result.message || 'Library wiped');
        if (this.isSuperAdmin) {
          this.api.getStorageMetrics().subscribe({
            next: (metrics) => this.storage.set(metrics),
            error: () => undefined,
          });
        }
      },
      error: (err) => {
        this.wiping.set(false);
        this.feedback.error(apiErrorMessage(err, 'Wipe failed'));
      },
    });
  }

  private applyConfig(config: SystemConfig): void {
    this.config.set(config);
    this.form = { ...config };
    this.librarySettings.apply(config);
  }
}
