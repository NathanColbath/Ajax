import { LogEntry } from './logs.models';

const now = Date.now();

export const MOCK_LOG_ENTRIES: LogEntry[] = [
  {
    id: 3,
    timestamp: new Date(now - 15_000).toISOString(),
    level: 'Information',
    category: 'Http',
    eventType: 'RequestCompleted',
    message: 'GET /api/games → 200 (42ms)',
    requestMethod: 'GET',
    requestPath: '/api/games',
    statusCode: 200,
    durationMs: 42,
    correlationId: 'mock-corr-3',
    userId: 'u1',
  },
  {
    id: 2,
    timestamp: new Date(now - 45_000).toISOString(),
    level: 'Information',
    category: 'Uploads',
    eventType: 'Enqueued',
    message: 'Upload job queued: demo.md',
    entityType: 'UploadJob',
    entityId: 'job1',
    correlationId: 'mock-corr-2',
    userId: 'u1',
  },
  {
    id: 1,
    timestamp: new Date(now - 90_000).toISOString(),
    level: 'Warning',
    category: 'Http',
    eventType: 'RequestCompleted',
    message: 'GET /api/config/storage → 403 (8ms)',
    requestMethod: 'GET',
    requestPath: '/api/config/storage',
    statusCode: 403,
    durationMs: 8,
    correlationId: 'mock-corr-1',
    userId: 'u3',
  },
];
