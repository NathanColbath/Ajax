import { Component, forwardRef, input, output } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'ajax-checkbox',
  standalone: true,
  imports: [MatCheckboxModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AjaxCheckbox),
      multi: true,
    },
  ],
  template: `
    <mat-checkbox
      [checked]="value"
      [disabled]="isDisabled"
      [indeterminate]="indeterminate()"
      [color]="color()"
      [labelPosition]="labelPosition()"
      (change)="onCheckedChange($event.checked)"
    >
      <ng-content />
    </mat-checkbox>
  `,
})
export class AjaxCheckbox implements ControlValueAccessor {
  readonly indeterminate = input(false);
  readonly color = input<'primary' | 'accent' | 'warn'>('primary');
  readonly labelPosition = input<'before' | 'after'>('after');
  readonly changed = output<boolean>();

  value = false;
  isDisabled = false;

  private onChangeFn: (value: boolean) => void = () => undefined;
  private onTouchedFn: () => void = () => undefined;

  writeValue(value: boolean | null): void {
    this.value = !!value;
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  onCheckedChange(checked: boolean): void {
    this.value = checked;
    this.onChangeFn(checked);
    this.onTouchedFn();
    this.changed.emit(checked);
  }
}
