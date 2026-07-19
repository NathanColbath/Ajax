import { AbstractControl } from '@angular/forms';
import { AjaxValidationMessage } from './validation.types';

const controlMessages = new WeakMap<
  AbstractControl,
  Partial<Record<string, AjaxValidationMessage>>
>();

export function setControlMessages(
  control: AbstractControl,
  messages: Partial<Record<string, AjaxValidationMessage>>,
): void {
  const existing = controlMessages.get(control) ?? {};
  controlMessages.set(control, { ...existing, ...messages });
}

export function getControlMessages(
  control: AbstractControl,
): Partial<Record<string, AjaxValidationMessage>> | undefined {
  return controlMessages.get(control);
}

export function clearControlMessages(control: AbstractControl): void {
  controlMessages.delete(control);
}
