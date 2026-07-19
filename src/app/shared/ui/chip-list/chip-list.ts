import { Component, input, output } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';

export interface AjaxChip {
  label: string;
  value?: string | number;
  removable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  color?: 'primary' | 'accent' | 'warn';
}

@Component({
  selector: 'ajax-chip-list',
  standalone: true,
  imports: [MatChipsModule, MatIconModule],
  template: `
    <mat-chip-set [attr.aria-label]="ariaLabel()">
      @for (chip of chips(); track chip.value ?? chip.label) {
        <mat-chip
          [highlighted]="chip.selected ?? false"
          [disabled]="chip.disabled ?? false"
          [removable]="chip.removable ?? removable()"
          (removed)="removed.emit(chip)"
        >
          {{ chip.label }}
          @if (chip.removable ?? removable()) {
            <button matChipRemove type="button" [attr.aria-label]="'Remove ' + chip.label">
              <mat-icon>cancel</mat-icon>
            </button>
          }
        </mat-chip>
      }
      <ng-content />
    </mat-chip-set>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class AjaxChipList {
  readonly chips = input<AjaxChip[]>([]);
  readonly removable = input(false);
  readonly ariaLabel = input('Chip list');
  readonly removed = output<AjaxChip>();
}
