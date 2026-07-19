import { Component, input } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';

@Component({
  selector: 'ajax-badge',
  standalone: true,
  imports: [MatBadgeModule],
  template: `
    <span
      [matBadge]="content()"
      [matBadgeColor]="color()"
      [matBadgePosition]="position()"
      [matBadgeSize]="size()"
      [matBadgeHidden]="hidden() || !content()"
      [matBadgeOverlap]="overlap()"
    >
      <ng-content />
    </span>
  `,
  styles: `
    :host {
      display: inline-block;
    }
  `,
})
export class AjaxBadge {
  readonly content = input<string | number | undefined>(undefined);
  readonly color = input<'primary' | 'accent' | 'warn'>('primary');
  readonly position = input<'above after' | 'above before' | 'below before' | 'below after'>(
    'above after',
  );
  readonly size = input<'small' | 'medium' | 'large'>('medium');
  readonly hidden = input(false);
  readonly overlap = input(true);
}
