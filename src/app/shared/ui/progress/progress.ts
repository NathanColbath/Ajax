import { Component, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'ajax-progress',
  standalone: true,
  imports: [MatProgressBarModule],
  template: `
    <mat-progress-bar
      [mode]="mode()"
      [value]="value()"
      [bufferValue]="bufferValue()"
      [color]="color()"
    />
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      min-height: 4px;
    }

    mat-progress-bar {
      display: block;
      width: 100%;
      height: 4px;
      border-radius: 2px;
      overflow: hidden;
      --mdc-linear-progress-track-height: 4px;
      --mdc-linear-progress-active-indicator-height: 4px;
      --mat-progress-bar-track-height: 4px;
      --mat-progress-bar-active-indicator-height: 4px;
    }
  `,
})
export class AjaxProgress {
  readonly mode = input<'determinate' | 'indeterminate' | 'buffer' | 'query'>('determinate');
  readonly value = input(0);
  readonly bufferValue = input(0);
  readonly color = input<'primary' | 'accent' | 'warn'>('primary');
}
