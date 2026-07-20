import { Component, input } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'ajax-toolbar',
  standalone: true,
  imports: [MatToolbarModule],
  template: `
    <mat-toolbar [color]="color()">
      <ng-content />
    </mat-toolbar>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class AjaxToolbar {
  readonly color = input<'primary' | 'accent' | 'warn' | undefined>(undefined);
}
