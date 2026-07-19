import { FormControl, FormControlOptions, Validators } from '@angular/forms';
import { setControlMessages } from './validation-registry';
import { resolveValidationRules } from './validation.rules';
import { AjaxValidationMessage, AjaxValidationRule } from './validation.types';

export type AjaxControlOptions = Omit<FormControlOptions, 'validators' | 'asyncValidators'> & {
  /** Extra / override messages by Angular error key. */
  messages?: Partial<Record<string, AjaxValidationMessage>>;
};

/**
 * Create a FormControl with validation rules and messages co-located.
 *
 * @example
 * new FormGroup({
 *   name: ajaxControl('', ['required', { minLength: 3 }], { nonNullable: true }),
 *   email: ajaxControl('', ['required', 'email'], { nonNullable: true }),
 * });
 */
export function ajaxControl<T>(
  value: T,
  rules: AjaxValidationRule[],
  options: AjaxControlOptions & { nonNullable: true },
): FormControl<T>;
export function ajaxControl<T>(
  value: T | null,
  rules?: AjaxValidationRule[],
  options?: AjaxControlOptions,
): FormControl<T | null>;
export function ajaxControl<T>(
  value: T | null,
  rules: AjaxValidationRule[] = [],
  options?: AjaxControlOptions,
): FormControl<T> | FormControl<T | null> {
  const { messages: extraMessages, ...controlOptions } = options ?? {};
  const resolved = resolveValidationRules(rules);

  const messages: Partial<Record<string, AjaxValidationMessage>> = {
    ...extraMessages,
  };
  for (const rule of resolved) {
    if (rule.message != null) {
      messages[rule.errorKey] = rule.message;
    }
  }

  const validators = Validators.compose(resolved.map((rule) => rule.validator));
  const control = new FormControl(value, {
    ...controlOptions,
    validators: validators ?? undefined,
  });

  if (Object.keys(messages).length > 0) {
    setControlMessages(control, messages);
  }

  return control as FormControl<T> | FormControl<T | null>;
}
