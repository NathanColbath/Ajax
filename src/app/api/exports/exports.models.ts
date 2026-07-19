export type ExportFormat = 'csv' | 'json';
export type ExportScope = 'games' | 'physical' | 'systems';

export interface ExportJob {
  id: string;
  format: ExportFormat;
  scopes: ExportScope[];
  status: 'queued' | 'running' | 'complete' | 'failed';
  createdLabel: string;
}
