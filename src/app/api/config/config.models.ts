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

export interface SystemConfig {
  libraryName: string;
  allowStandardUploads: boolean;
  apiModeNote: string;
}
