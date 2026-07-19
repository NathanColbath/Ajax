import { Component, forwardRef, input, output } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'ajax-slide-toggle',
  standalone: true,
  imports: [MatSlideToggleModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AjaxSlideToggle),
      multi: true,
    },
  ],
  template: `
    <mat-slide-toggle
      [checked]="value"
      [disabled]="isDisabled"
      [color]="color()"
      [labelPosition]="labelPosition()"
      (change)="onToggle($event.checked)"
    >
      <ng-content />
    </mat-slide-toggle>
  `,
})
export class AjaxSlideToggle implements ControlValueAccessor {
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

  onToggle(checked: boolean): void {
    this.value = checked;
    this.onChangeFn(checked);
    this.onTouchedFn();
    this.changed.emit(checked);
  }
}
