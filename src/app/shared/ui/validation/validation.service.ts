import { Injectable } from '@angular/core';
import {
  AbstractControl,
  FormGroup,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { resolveValidationMessage } from './validation.messages';
import {
  clearControlMessages,
  getControlMessages,
  setControlMessages,
} from './validation-registry';
import { resolveValidationRules } from './validation.rules';
import {
  AjaxValidationAttachOptions,
  AjaxValidationMessage,
  AjaxValidationSchema,
} from './validation.types';

interface ControlAttachState {
  previousValidator: ValidatorFn | null;
}

/**
 * Message resolution + submit helpers.
 * Prefer `ajaxControl(...)` when creating controls; use `attach` only for dynamic schemas.
 */
@Injectable({ providedIn: 'root' })
export class AjaxValidationService {
  private readonly attachState = new WeakMap<AbstractControl, ControlAttachState>();

  /**
   * Dynamically attach validators + messages by control path.
   * Prefer `ajaxControl` for static forms. Returns teardown that restores prior validators.
   */
  attach(
    group: FormGroup,
    schema: AjaxValidationSchema,
    options?: AjaxValidationAttachOptions,
  ): () => void {
    const attached: AbstractControl[] = [];
    const globalMessages = options?.messages;

    for (const [path, rules] of Object.entries(schema)) {
      const control = group.get(path);
      if (!control) {
        console.warn(`[AjaxValidation] Control not found for path "${path}"`);
        continue;
      }

      const resolved = resolveValidationRules(rules);
      const previousValidator = control.validator;
      const messages: Partial<Record<string, AjaxValidationMessage>> = {
        ...globalMessages,
      };

      for (const rule of resolved) {
        if (rule.message != null) {
          messages[rule.errorKey] = rule.message;
        }
      }

      const composed = Validators.compose([
        previousValidator,
        ...resolved.map((rule) => rule.validator),
      ]);

      control.setValidators(composed);
      control.updateValueAndValidity({ emitEvent: false });
      setControlMessages(control, messages);
      this.attachState.set(control, { previousValidator });
      attached.push(control);
    }

    return () => {
      for (const control of attached) {
        const state = this.attachState.get(control);
        if (!state) {
          continue;
        }
        control.setValidators(state.previousValidator);
        control.updateValueAndValidity({ emitEvent: false });
        clearControlMessages(control);
        this.attachState.delete(control);
      }
    };
  }

  messageFor(control: AbstractControl | null | undefined): string | null {
    if (!control || !control.invalid || !(control.touched || control.dirty)) {
      return null;
    }

    const errors = control.errors;
    if (!errors) {
      return null;
    }

    const key = Object.keys(errors)[0];
    if (!key) {
      return null;
    }

    return resolveValidationMessage(key, errors[key], getControlMessages(control));
  }

  markAllTouched(group: FormGroup): void {
    group.markAllAsTouched();
    group.updateValueAndValidity({ emitEvent: true });
  }
}
