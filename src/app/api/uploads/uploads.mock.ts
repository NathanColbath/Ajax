import { UploadJob } from './uploads.models';

export const MOCK_UPLOAD_JOBS: UploadJob[] = [
  {
    id: 'u1',
    name: 'Gunstar Heroes (USA).md',
    size: 2_048_000,
    progress: 100,
    state: 'complete',
    systemId: 's3',
  },
  {
    id: 'u2',
    name: 'Metroid (USA).nes',
    size: 131_072,
    progress: 62,
    state: 'uploading',
    systemId: 's1',
  },
];
