import { inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { AjaxValidationService } from './validation.service';

/** Shared error resolver for ajax form field wrappers. */
export function injectAjaxFieldError(): () => string | null {
  const ngControl = inject(NgControl, { optional: true, self: true });
  const validation = inject(AjaxValidationService);

  return () => validation.messageFor(ngControl?.control);
}
