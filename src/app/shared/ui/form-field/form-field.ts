import { Component, input } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';

/**
 * Thin mat-form-field wrapper for projecting native Material controls
 * (e.g. `<input matInput>`, `<mat-select>`) directly.
 *
 * Prefer self-contained controls (`ajax-input`, `ajax-select`, etc.) for app forms —
 * nesting those inside `ajax-form-field` breaks Material's form-field wiring.
 */
@Component({
  selector: 'ajax-form-field',
  standalone: true,
  imports: [MatFormFieldModule],
  template: `
    <mat-form-field [appearance]="appearance()" [subscriptSizing]="subscriptSizing()" class="ajax-form-field">
      @if (label()) {
        <mat-label>{{ label() }}</mat-label>
      }
      <ng-content />
      @if (hint()) {
        <mat-hint>{{ hint() }}</mat-hint>
      }
      <ng-content select="[error]" />
      <ng-content select="[prefix]" />
      <ng-content select="[suffix]" />
    </mat-form-field>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .ajax-form-field {
      width: 100%;
    }
  `,
})
export class AjaxFormField {
  readonly label = input<string | undefined>(undefined);
  readonly hint = input<string | undefined>(undefined);
  readonly appearance = input<'fill' | 'outline'>('outline');
  readonly subscriptSizing = input<'fixed' | 'dynamic'>('dynamic');
}
