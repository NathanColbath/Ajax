import { ExportJob } from './exports.models';

export const MOCK_EXPORT_JOBS: ExportJob[] = [
  {
    id: 'e1',
    format: 'json',
    scopes: ['games', 'systems'],
    status: 'complete',
    createdLabel: 'Today · 10:14',
  },
  {
    id: 'e2',
    format: 'csv',
    scopes: ['physical'],
    status: 'complete',
    createdLabel: 'Yesterday · 18:02',
  },
];
