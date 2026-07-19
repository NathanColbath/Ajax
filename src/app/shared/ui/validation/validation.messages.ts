import { AjaxValidationMessage } from './validation.types';

export const AJAX_VALIDATION_DEFAULT_MESSAGES: Record<string, AjaxValidationMessage> = {
  required: 'This field is required',
  email: 'Enter a valid email address',
  minlength: (err) => {
    const requiredLength = (err as { requiredLength?: number })?.requiredLength;
    return requiredLength != null
      ? `Enter at least ${requiredLength} characters`
      : 'Value is too short';
  },
  maxlength: (err) => {
    const requiredLength = (err as { requiredLength?: number })?.requiredLength;
    return requiredLength != null
      ? `Enter no more than ${requiredLength} characters`
      : 'Value is too long';
  },
  min: (err) => {
    const min = (err as { min?: number })?.min;
    return min != null ? `Value must be at least ${min}` : 'Value is too small';
  },
  max: (err) => {
    const max = (err as { max?: number })?.max;
    return max != null ? `Value must be at most ${max}` : 'Value is too large';
  },
  pattern: 'Value does not match the required format',
};

export function resolveValidationMessage(
  key: string,
  err: unknown,
  ...sources: Array<Partial<Record<string, AjaxValidationMessage>> | undefined>
): string {
  for (const source of sources) {
    const entry = source?.[key];
    if (entry == null) {
      continue;
    }
    return typeof entry === 'function' ? entry(err) : entry;
  }

  const fallback = AJAX_VALIDATION_DEFAULT_MESSAGES[key];
  if (fallback == null) {
    return 'Invalid value';
  }
  return typeof fallback === 'function' ? fallback(err) : fallback;
}
