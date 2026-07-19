import { booleanAttribute, Component, inject, input } from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { injectAjaxFieldError } from '../validation/field-error';

@Component({
  selector: 'ajax-input',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field
      [appearance]="appearance()"
      [subscriptSizing]="subscriptSizing()"
      class="ajax-field"
    >
      @if (label()) {
        <mat-label>{{ label() }}</mat-label>
      }
      <input
        matInput
        [type]="type()"
        [placeholder]="placeholder()"
        [disabled]="isDisabled"
        [required]="required()"
        [attr.autocomplete]="autocomplete()"
        [value]="value"
        (input)="handleChange($any($event.target).value)"
        (blur)="handleTouched()"
      />
      @if (hint()) {
        <mat-hint>{{ hint() }}</mat-hint>
      }
      @if (errorMessage(); as msg) {
        <mat-error>{{ msg }}</mat-error>
      }
      <ng-content select="[error]" />
      <ng-content select="[prefix]" />
      <ng-content select="[suffix]" />
    </mat-form-field>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .ajax-field {
      width: 100%;
    }
  `,
})
export class AjaxInput implements ControlValueAccessor {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  readonly errorMessage = injectAjaxFieldError();

  readonly label = input<string | undefined>(undefined);
  readonly hint = input<string | undefined>(undefined);
  readonly type = input('text');
  readonly placeholder = input('');
  readonly required = input(false, { transform: booleanAttribute });
  readonly autocomplete = input<string | undefined>(undefined);
  readonly appearance = input<'fill' | 'outline'>('outline');
  readonly subscriptSizing = input<'fixed' | 'dynamic'>('dynamic');

  value = '';
  isDisabled = false;

  private onChangeFn: (value: string) => void = () => undefined;
  private onTouchedFn: () => void = () => undefined;

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  handleChange(value: string): void {
    this.value = value;
    this.onChangeFn(value);
  }

  handleTouched(): void {
    this.onTouchedFn();
  }
}
