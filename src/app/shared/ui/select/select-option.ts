import { Component, input } from '@angular/core';

@Component({
  selector: 'ajax-select-option',
  standalone: true,
  template: '',
})
export class AjaxSelectOption {
  readonly value = input.required<string | number>();
  readonly label = input<string | undefined>(undefined);
  readonly disabled = input(false);
}
