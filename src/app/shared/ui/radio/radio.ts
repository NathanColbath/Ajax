import { Component, input } from '@angular/core';

@Component({
  selector: 'ajax-radio',
  standalone: true,
  template: '',
})
export class AjaxRadio {
  readonly value = input.required<string | number>();
  readonly label = input<string | undefined>(undefined);
  readonly disabled = input(false);
}
