import { Component, input } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'ajax-divider',
  standalone: true,
  imports: [MatDividerModule],
  template: `<mat-divider [inset]="inset()" [vertical]="vertical()" />`,
  styles: `
    :host {
      display: block;
    }

    :host([vertical]) {
      display: inline-block;
      height: 100%;
    }
  `,
  host: {
    '[attr.vertical]': 'vertical() || null',
  },
})
export class AjaxDivider {
  readonly inset = input(false);
  readonly vertical = input(false);
}
