export interface StoragePathMetric {
  path: string;
  usedGb: number;
  totalGb: number;
  health: 'ok' | 'warning' | 'critical';
}

export interface StorageMetrics {
  usedGb: number;
  totalGb: number;
  freeGb: number;
  paths: StoragePathMetric[];
}

export interface IntegrationsStatus {
  hasheousConfigured: boolean;
  igdbConfigured: boolean;
  deepSeekConfigured: boolean;
}

export interface SystemConfig {
  libraryName: string;
  allowStandardUploads: boolean;
  apiModeNote: string;
  allowStandardExports: boolean;
  requireLoginForLibraryBrowse: boolean;
  maxUploadBytes: number;
  defaultUploadAccept: string;
  uploadPollIntervalMs: number;
  autoMatchAfterUpload: boolean;
  maxParallelUploadJobs: number;
  backgroundJobsEnabled: boolean;
  jobScheduleEnabled: boolean;
  jobAllowedStartLocal: string;
  jobAllowedEndLocal: string;
  jobTimeZoneId: string;
  maxJobRuntimeMinutes: number;
  uploadJobsRespectSchedule: boolean;
  metadataJobsRespectSchedule: boolean;
  enrichmentJobsRespectSchedule: boolean;
  exportJobsRespectSchedule: boolean;
  scheduledMetadataCron: string;
  scheduledEnrichmentCron: string;
  hasheousBatchSize: number;
  enrichmentBatchSize: number;
  enrichmentCandidatePool: number;
  maxScreenshotsPerGame: number;
  maxCuratedReviewsPerGame: number;
  deepSeekTemperature: number;
  dashboardFavoritesLimit: number;
  dashboardRecentLimit: number;
  gameReviewsPageSize: number;
  defaultLibraryPageSize: number;
  searchDebounceMs: number;
  defaultRatingScale: number;
  logListDefaultLimit: number;
  logPurgeDefaultDays: number;
  logAutoRefreshIntervalMs: number;
}

export interface FactoryWipeResult {
  ok: boolean;
  message: string;
  config: SystemConfig;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  libraryName: 'Retrojax',
  allowStandardUploads: false,
  apiModeNote: '',
  allowStandardExports: false,
  requireLoginForLibraryBrowse: true,
  maxUploadBytes: 536870912,
  defaultUploadAccept: '.nes,.sfc,.smc,.md,.gen,.bin,.cue,.iso,.chd,.zip',
  uploadPollIntervalMs: 2500,
  autoMatchAfterUpload: true,
  maxParallelUploadJobs: 2,
  backgroundJobsEnabled: true,
  jobScheduleEnabled: false,
  jobAllowedStartLocal: '00:00',
  jobAllowedEndLocal: '23:59',
  jobTimeZoneId: 'UTC',
  maxJobRuntimeMinutes: 60,
  uploadJobsRespectSchedule: false,
  metadataJobsRespectSchedule: true,
  enrichmentJobsRespectSchedule: true,
  exportJobsRespectSchedule: true,
  scheduledMetadataCron: '',
  scheduledEnrichmentCron: '',
  hasheousBatchSize: 25,
  enrichmentBatchSize: 15,
  enrichmentCandidatePool: 200,
  maxScreenshotsPerGame: 4,
  maxCuratedReviewsPerGame: 3,
  deepSeekTemperature: 0.3,
  dashboardFavoritesLimit: 6,
  dashboardRecentLimit: 5,
  gameReviewsPageSize: 50,
  defaultLibraryPageSize: 8,
  searchDebounceMs: 300,
  defaultRatingScale: 100,
  logListDefaultLimit: 100,
  logPurgeDefaultDays: 30,
  logAutoRefreshIntervalMs: 5000,
};
