import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { SessionService } from '../../core/auth/session.service';
import { MOCK_STORAGE, MOCK_SYSTEM_CONFIG } from './config.mock';
import {
  DEFAULT_SYSTEM_CONFIG,
  FactoryWipeResult,
  IntegrationsStatus,
  StorageMetrics,
  SystemConfig,
} from './config.models';

@Injectable({ providedIn: 'root' })
export class ConfigApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private readonly session = inject(SessionService);
  private config: SystemConfig = { ...MOCK_SYSTEM_CONFIG };

  getSystemConfig(): Observable<SystemConfig> {
    if (this.mode.isMock()) {
      return mockDelay({ ...this.config });
    }
    return this.http.get<SystemConfig>('/config');
  }

  updateSystemConfig(patch: Partial<SystemConfig>): Observable<SystemConfig> {
    if (this.mode.isMock()) {
      this.config = { ...this.config, ...patch };
      return mockDelay({ ...this.config }, 220);
    }
    return this.http.put<SystemConfig>('/config', patch);
  }

  getIntegrationsStatus(): Observable<IntegrationsStatus> {
    if (this.mode.isMock()) {
      return mockDelay({
        hasheousConfigured: true,
        igdbConfigured: false,
        deepSeekConfigured: true,
      });
    }
    return this.http.get<IntegrationsStatus>('/config/integrations');
  }

  getStorageMetrics(): Observable<StorageMetrics> {
    if (!this.session.canSeeStorageMetrics()) {
      return throwError(() => new Error('Super Admin required'));
    }
    if (this.mode.isMock()) {
      return mockDelay({ ...MOCK_STORAGE, paths: MOCK_STORAGE.paths.map((p) => ({ ...p })) });
    }
    return this.http.get<StorageMetrics>('/config/storage');
  }

  wipe(): Observable<FactoryWipeResult> {
    if (!this.session.canSeeStorageMetrics()) {
      return throwError(() => new Error('Super Admin required'));
    }
    if (this.mode.isMock()) {
      this.config = { ...DEFAULT_SYSTEM_CONFIG };
      return mockDelay(
        {
          ok: true,
          message: 'Library wiped. Catalog is empty; files storage cleared.',
          config: { ...this.config },
        },
        400,
      );
    }
    return this.http.post<FactoryWipeResult>('/config/wipe');
  }
}
