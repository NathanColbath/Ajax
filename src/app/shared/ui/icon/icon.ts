import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ajax-icon',
  standalone: true,
  imports: [MatIconModule],
  template: `
    @if (fontIcon()) {
      <mat-icon [color]="color()" [fontIcon]="fontIcon()!" />
    } @else {
      <mat-icon [color]="color()">{{ name() }}</mat-icon>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      flex-shrink: 0;
    }

    .mat-icon {
      display: inline-block;
      width: 24px;
      height: 24px;
      font-size: 24px;
      line-height: 24px;
      overflow: hidden;
    }
  `,
})
export class AjaxIcon {
  readonly name = input('');
  readonly fontIcon = input<string | undefined>(undefined);
  readonly color = input<'primary' | 'accent' | 'warn' | undefined>(undefined);
}
