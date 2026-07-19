import { Component, contentChildren, input, viewChild } from '@angular/core';
import { MatMenu, MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AjaxMenuItem } from './menu-item';

@Component({
  selector: 'ajax-menu',
  standalone: true,
  imports: [MatMenuModule, MatButtonModule, MatIconModule],
  template: `
    <button
      mat-button
      type="button"
      [matMenuTriggerFor]="menu"
      [disabled]="disabled()"
      [color]="color()"
    >
      @if (icon()) {
        <mat-icon>{{ icon() }}</mat-icon>
      }
      {{ label() }}
      <mat-icon iconPositionEnd>arrow_drop_down</mat-icon>
    </button>

    <mat-menu #menu="matMenu">
      @for (item of items(); track item.label()) {
        <button
          mat-menu-item
          type="button"
          [disabled]="item.disabled()"
          (click)="item.clicked.emit()"
        >
          @if (item.icon()) {
            <mat-icon>{{ item.icon() }}</mat-icon>
          }
          <span>{{ item.label() }}</span>
        </button>
      }
      <ng-content />
    </mat-menu>
  `,
})
export class AjaxMenu {
  readonly label = input('Menu');
  readonly icon = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly color = input<'primary' | 'accent' | 'warn' | undefined>(undefined);
  readonly items = contentChildren(AjaxMenuItem);
  readonly menu = viewChild.required(MatMenu);
}
