import { Component, input, output } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

export interface AjaxListItem {
  id?: string | number;
  label: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
}

@Component({
  selector: 'ajax-list',
  standalone: true,
  imports: [MatListModule, MatIconModule],
  template: `
    @if (nav()) {
      <mat-nav-list>
        @for (item of items(); track item.id ?? item.label) {
          <a
            mat-list-item
            [disabled]="item.disabled ?? false"
            (click)="itemClick.emit(item); $event.preventDefault()"
            href="#"
          >
            @if (item.icon) {
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
            }
            <span matListItemTitle>{{ item.label }}</span>
            @if (item.description) {
              <span matListItemLine>{{ item.description }}</span>
            }
          </a>
        }
      </mat-nav-list>
    } @else {
      <mat-list>
        @for (item of items(); track item.id ?? item.label) {
          <mat-list-item [disabled]="item.disabled ?? false" (click)="itemClick.emit(item)">
            @if (item.icon) {
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
            }
            <span matListItemTitle>{{ item.label }}</span>
            @if (item.description) {
              <span matListItemLine>{{ item.description }}</span>
            }
          </mat-list-item>
        }
      </mat-list>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class AjaxList {
  readonly items = input<AjaxListItem[]>([]);
  readonly nav = input(false);
  readonly itemClick = output<AjaxListItem>();
}
