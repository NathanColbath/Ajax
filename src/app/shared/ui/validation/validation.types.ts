import { ValidatorFn } from '@angular/forms';

export type AjaxValidationRule =
  | 'required'
  | 'email'
  | { minLength: number; message?: string }
  | { maxLength: number; message?: string }
  | { min: number; message?: string }
  | { max: number; message?: string }
  | { pattern: RegExp | string; message?: string }
  | { validator: ValidatorFn; errorKey: string; message?: string };

export type AjaxValidationSchema = Record<string, AjaxValidationRule[]>;

export type AjaxValidationMessage =
  | string
  | ((err: unknown) => string);

export interface AjaxValidationAttachOptions {
  /** Override default messages by Angular error key (required, email, minlength, …). */
  messages?: Partial<Record<string, AjaxValidationMessage>>;
}
