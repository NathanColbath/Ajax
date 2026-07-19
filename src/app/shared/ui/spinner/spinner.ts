import { Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'ajax-spinner',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    <mat-progress-spinner
      [mode]="mode()"
      [value]="value()"
      [diameter]="diameter()"
      [strokeWidth]="strokeWidth()"
      [color]="color()"
    />
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }

    mat-progress-spinner {
      display: block;
    }
  `,
})
export class AjaxSpinner {
  readonly mode = input<'determinate' | 'indeterminate'>('indeterminate');
  readonly value = input(0);
  readonly diameter = input(40);
  readonly strokeWidth = input(4);
  readonly color = input<'primary' | 'accent' | 'warn'>('primary');
}
