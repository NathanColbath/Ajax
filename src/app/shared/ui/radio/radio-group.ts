import { Component, contentChildren, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { AjaxRadio } from './radio';

@Component({
  selector: 'ajax-radio-group',
  standalone: true,
  imports: [MatRadioModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AjaxRadioGroup),
      multi: true,
    },
  ],
  template: `
    <mat-radio-group
      [disabled]="isDisabled"
      [color]="color()"
      [labelPosition]="labelPosition()"
      [(ngModel)]="value"
      (ngModelChange)="onChange($event)"
    >
      @for (option of radios(); track option.value()) {
        <mat-radio-button [value]="option.value()" [disabled]="option.disabled()">
          {{ option.label() || option.value() }}
        </mat-radio-button>
      }
    </mat-radio-group>
  `,
  styles: `
    mat-radio-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
  `,
})
export class AjaxRadioGroup implements ControlValueAccessor {
  readonly color = input<'primary' | 'accent' | 'warn'>('primary');
  readonly labelPosition = input<'before' | 'after'>('after');
  readonly radios = contentChildren(AjaxRadio);

  value: string | number | null = null;
  isDisabled = false;

  private onChangeFn: (value: unknown) => void = () => undefined;
  private onTouchedFn: () => void = () => undefined;

  writeValue(value: string | number | null): void {
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

  onChange(value: unknown): void {
    this.onChangeFn(value);
    this.onTouchedFn();
  }
}
