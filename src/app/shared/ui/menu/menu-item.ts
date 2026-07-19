import { Component, input, output } from '@angular/core';

@Component({
  selector: 'ajax-menu-item',
  standalone: true,
  template: '',
})
export class AjaxMenuItem {
  readonly label = input.required<string>();
  readonly icon = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly clicked = output<void>();
}
