import { DEFAULT_SYSTEM_CONFIG, StorageMetrics, SystemConfig } from './config.models';

export const MOCK_SYSTEM_CONFIG: SystemConfig = {
  ...DEFAULT_SYSTEM_CONFIG,
  apiModeNote: 'Switch mock/live below for frontend development.',
};

export const MOCK_STORAGE: StorageMetrics = {
  usedGb: 412,
  totalGb: 1024,
  freeGb: 612,
  paths: [
    { path: '/data/roms', usedGb: 320, totalGb: 800, health: 'ok' },
    { path: '/data/media', usedGb: 72, totalGb: 200, health: 'ok' },
    { path: '/data/backups', usedGb: 20, totalGb: 24, health: 'warning' },
  ],
};
