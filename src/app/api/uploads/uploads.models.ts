export type UploadJobState = 'queued' | 'uploading' | 'processing' | 'complete' | 'error';

export interface UploadJob {
  id: string;
  name: string;
  size: number;
  progress: number;
  state: UploadJobState;
  systemId?: string;
  gameId?: string;
  message?: string;
}

export interface UploadEnqueueOptions {
  systemId: string;
  gameId?: string;
  createTitle?: string;
}
