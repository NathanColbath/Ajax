import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { AjaxValidationMessage, AjaxValidationRule } from './validation.types';

export interface ResolvedValidationRule {
  validator: ValidatorFn;
  errorKey: string;
  message?: AjaxValidationMessage;
}

export function resolveValidationRules(rules: AjaxValidationRule[]): ResolvedValidationRule[] {
  return rules.map((rule) => resolveRule(rule));
}

function resolveRule(rule: AjaxValidationRule): ResolvedValidationRule {
  if (rule === 'required') {
    return { validator: Validators.required, errorKey: 'required' };
  }

  if (rule === 'email') {
    return { validator: Validators.email, errorKey: 'email' };
  }

  if ('minLength' in rule) {
    return {
      validator: Validators.minLength(rule.minLength),
      errorKey: 'minlength',
      message: rule.message,
    };
  }

  if ('maxLength' in rule) {
    return {
      validator: Validators.maxLength(rule.maxLength),
      errorKey: 'maxlength',
      message: rule.message,
    };
  }

  if ('min' in rule) {
    return {
      validator: Validators.min(rule.min),
      errorKey: 'min',
      message: rule.message,
    };
  }

  if ('max' in rule) {
    return {
      validator: Validators.max(rule.max),
      errorKey: 'max',
      message: rule.message,
    };
  }

  if ('pattern' in rule) {
    const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern) : rule.pattern;
    return {
      validator: Validators.pattern(pattern),
      errorKey: 'pattern',
      message: rule.message,
    };
  }

  if ('validator' in rule) {
    return {
      validator: wrapCustomValidator(rule.validator, rule.errorKey),
      errorKey: rule.errorKey,
      message: rule.message,
    };
  }

  throw new Error('Unknown validation rule');
}

function wrapCustomValidator(validator: ValidatorFn, errorKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const result = validator(control);
    if (!result) {
      return null;
    }
    if (errorKey in result) {
      return result;
    }
    return { [errorKey]: result };
  };
}
