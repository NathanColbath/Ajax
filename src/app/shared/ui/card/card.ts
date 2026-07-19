import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'ajax-card',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card [appearance]="appearance()">
      @if (title() || subtitle() || image()) {
        <mat-card-header>
          @if (image()) {
            <img mat-card-avatar [src]="image()" [alt]="title() || 'Card image'" />
          }
          @if (title()) {
            <mat-card-title>{{ title() }}</mat-card-title>
          }
          @if (subtitle()) {
            <mat-card-subtitle>{{ subtitle() }}</mat-card-subtitle>
          }
        </mat-card-header>
      }
      <mat-card-content>
        <ng-content />
      </mat-card-content>
      <mat-card-actions align="end">
        <ng-content select="[actions]" />
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }

    mat-card-actions:empty {
      display: none;
    }
  `,
})
export class AjaxCard {
  readonly title = input<string | undefined>(undefined);
  readonly subtitle = input<string | undefined>(undefined);
  readonly image = input<string | undefined>(undefined);
  readonly appearance = input<'outlined' | 'raised' | 'filled'>('outlined');
}
