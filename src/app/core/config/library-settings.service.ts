import { Injectable, computed, inject, signal } from '@angular/core';
import { ConfigApi, SystemConfig } from '../../api';
import { DEFAULT_SYSTEM_CONFIG } from '../../api/config/config.models';

/**
 * Cached system config for shell / feature pages (library name, upload gates, UX defaults).
 */
@Injectable({ providedIn: 'root' })
export class LibrarySettingsService {
  private readonly api = inject(ConfigApi);

  private readonly configSignal = signal<SystemConfig>({ ...DEFAULT_SYSTEM_CONFIG });
  private loaded = false;

  readonly config = this.configSignal.asReadonly();
  readonly libraryName = computed(() => this.configSignal().libraryName || 'Retrojax');
  readonly allowStandardUploads = computed(() => this.configSignal().allowStandardUploads);
  readonly searchDebounceMs = computed(() => this.configSignal().searchDebounceMs);
  readonly defaultLibraryPageSize = computed(() => this.configSignal().defaultLibraryPageSize);
  readonly uploadPollIntervalMs = computed(() => this.configSignal().uploadPollIntervalMs);
  readonly defaultUploadAccept = computed(() => this.configSignal().defaultUploadAccept);
  readonly logAutoRefreshIntervalMs = computed(() => this.configSignal().logAutoRefreshIntervalMs);
  readonly logPurgeDefaultDays = computed(() => this.configSignal().logPurgeDefaultDays);

  ensureLoaded(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    this.api.getSystemConfig().subscribe({
      next: (config) => this.configSignal.set(config),
      error: () => undefined,
    });
  }

  apply(config: SystemConfig): void {
    this.configSignal.set(config);
    this.loaded = true;
  }
}
