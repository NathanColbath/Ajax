export type LogLevel = 'Trace' | 'Debug' | 'Information' | 'Warning' | 'Error' | 'Critical';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: string;
  category: string;
  eventType: string;
  message: string;
  userId?: string | null;
  correlationId?: string | null;
  requestMethod?: string | null;
  requestPath?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  entityType?: string | null;
  entityId?: string | null;
  exception?: string | null;
  propertiesJson?: string | null;
}

export interface LogQuery {
  afterId?: number;
  since?: string;
  limit?: number;
  level?: string;
  category?: string;
  correlationId?: string;
  search?: string;
}
