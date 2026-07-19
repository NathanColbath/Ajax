import { booleanAttribute, Component, contentChildren, inject, input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NgControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { injectAjaxFieldError } from '../validation/field-error';
import { AjaxSelectOption } from './select-option';

@Component({
  selector: 'ajax-select',
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule, FormsModule],
  template: `
    <mat-form-field
      [appearance]="appearance()"
      [subscriptSizing]="subscriptSizing()"
      class="ajax-field"
    >
      @if (label()) {
        <mat-label>{{ label() }}</mat-label>
      }
      <mat-select
        [placeholder]="placeholder()"
        [disabled]="isDisabled"
        [required]="required()"
        [multiple]="multiple()"
        [ngModel]="value"
        (ngModelChange)="handleChange($event)"
        (blur)="handleTouched()"
      >
        @for (option of projectedOptions(); track option.value()) {
          <mat-option [value]="option.value()" [disabled]="option.disabled()">
            {{ option.label() || option.value() }}
          </mat-option>
        }
        @for (option of options(); track option.value) {
          <mat-option [value]="option.value" [disabled]="option.disabled ?? false">
            {{ option.label }}
          </mat-option>
        }
      </mat-select>
      @if (hint()) {
        <mat-hint>{{ hint() }}</mat-hint>
      }
      @if (errorMessage(); as msg) {
        <mat-error>{{ msg }}</mat-error>
      }
      <ng-content select="[error]" />
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
export class AjaxSelect implements ControlValueAccessor {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  readonly errorMessage = injectAjaxFieldError();

  readonly label = input<string | undefined>(undefined);
  readonly hint = input<string | undefined>(undefined);
  readonly placeholder = input('');
  readonly required = input(false, { transform: booleanAttribute });
  readonly multiple = input(false, { transform: booleanAttribute });
  readonly appearance = input<'fill' | 'outline'>('outline');
  readonly subscriptSizing = input<'fixed' | 'dynamic'>('dynamic');
  readonly options = input<{ value: string | number; label: string; disabled?: boolean }[]>([]);
  readonly projectedOptions = contentChildren(AjaxSelectOption);

  value: string | number | Array<string | number> | null = null;
  isDisabled = false;

  private onChangeFn: (value: unknown) => void = () => undefined;
  private onTouchedFn: () => void = () => undefined;

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  writeValue(value: string | number | Array<string | number> | null): void {
    this.value = value;
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  handleChange(value: unknown): void {
    this.value = value as string | number | Array<string | number> | null;
    this.onChangeFn(value);
  }

  handleTouched(): void {
    this.onTouchedFn();
  }
}
