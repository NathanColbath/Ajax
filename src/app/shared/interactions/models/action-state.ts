export type AjaxActionState =
  | 'idle'
  | 'loading'
  | 'success'
  | 'warning'
  | 'error'
  | 'disabled';

export type AjaxStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type AjaxConfirmationSeverity = 'info' | 'warning' | 'danger';

export type AjaxInlineSaveState = 'unsaved' | 'saving' | 'saved' | 'failed';

export type AjaxProgressStepState = 'pending' | 'active' | 'complete' | 'warning' | 'error';

export interface AjaxProgressStep {
  id: string;
  label: string;
  state: AjaxProgressStepState;
  description?: string;
}

export type AjaxUploadItemState =
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface AjaxUploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  state: AjaxUploadItemState;
  message?: string;
}
