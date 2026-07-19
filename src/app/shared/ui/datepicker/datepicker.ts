import { booleanAttribute, Component, inject, input, viewChild } from '@angular/core';
import { ControlValueAccessor, FormsModule, NgControl } from '@angular/forms';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { injectAjaxFieldError } from '../validation/field-error';

@Component({
  selector: 'ajax-datepicker',
  standalone: true,
  imports: [MatDatepickerModule, MatFormFieldModule, MatInputModule, FormsModule],
  providers: [provideNativeDateAdapter()],
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
        [matDatepicker]="picker"
        [placeholder]="placeholder()"
        [disabled]="isDisabled"
        [required]="required()"
        [ngModel]="value"
        (ngModelChange)="handleChange($event)"
        (blur)="handleTouched()"
      />
      <mat-datepicker-toggle matIconSuffix [for]="picker" />
      <mat-datepicker #picker />
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
export class AjaxDatepicker implements ControlValueAccessor {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  readonly errorMessage = injectAjaxFieldError();

  readonly label = input<string | undefined>(undefined);
  readonly hint = input<string | undefined>(undefined);
  readonly placeholder = input('Choose a date');
  readonly required = input(false, { transform: booleanAttribute });
  readonly appearance = input<'fill' | 'outline'>('outline');
  readonly subscriptSizing = input<'fixed' | 'dynamic'>('dynamic');

  readonly picker = viewChild.required<MatDatepicker<Date>>('picker');

  value: Date | null = null;
  isDisabled = false;

  private onChangeFn: (value: Date | null) => void = () => undefined;
  private onTouchedFn: () => void = () => undefined;

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  writeValue(value: Date | null): void {
    this.value = value;
  }

  registerOnChange(fn: (value: Date | null) => void): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  handleChange(value: Date | null): void {
    this.value = value;
    this.onChangeFn(value);
  }

  handleTouched(): void {
    this.onTouchedFn();
  }
}
