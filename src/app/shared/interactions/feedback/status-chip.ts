import { Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { AjaxStatusTone } from '../models/action-state';

@Component({
  selector: 'ajax-status-chip',
  standalone: true,
  imports: [MatChipsModule, MatIconModule],
  template: `
    <mat-chip [class]="'tone-' + status()" [highlighted]="status() !== 'neutral'">
      @if (icon()) {
        <mat-icon>{{ icon() }}</mat-icon>
      }
      {{ label() }}
    </mat-chip>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .tone-success {
      --mdc-chip-elevated-container-color: var(--mat-sys-surface-container-high);
      color: var(--ajax-color-success);
      border: 1px solid color-mix(in srgb, var(--ajax-color-success) 35%, transparent);
    }

    .tone-warning {
      --mdc-chip-elevated-container-color: var(--mat-sys-surface-container-high);
      color: var(--ajax-color-warning);
      border: 1px solid color-mix(in srgb, var(--ajax-color-warning) 35%, transparent);
    }

    .tone-danger {
      --mdc-chip-elevated-container-color: var(--mat-sys-surface-container-high);
      color: var(--ajax-color-danger);
      border: 1px solid color-mix(in srgb, var(--ajax-color-danger) 35%, transparent);
    }

    .tone-info {
      --mdc-chip-elevated-container-color: var(--mat-sys-surface-container-high);
      color: var(--ajax-color-info);
      border: 1px solid color-mix(in srgb, var(--ajax-color-info) 35%, transparent);
    }

    mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }
  `,
})
export class AjaxStatusChip {
  readonly label = input.required<string>();
  readonly status = input<AjaxStatusTone>('neutral');
  readonly icon = input<string | undefined>(undefined);
}
