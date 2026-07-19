import { Component, input } from '@angular/core';
import { AjaxSkeleton } from './skeleton';

@Component({
  selector: 'ajax-skeleton-list',
  standalone: true,
  imports: [AjaxSkeleton],
  template: `
    <ul class="list">
      @for (row of rows(); track $index) {
        <li>
          <ajax-skeleton height="1rem" width="28%" />
          <ajax-skeleton height="0.85rem" width="70%" />
        </li>
      }
    </ul>
  `,
  styles: `
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.85rem;
    }

    li {
      display: grid;
      gap: 0.35rem;
    }
  `,
})
export class AjaxSkeletonList {
  readonly count = input(3);

  rows(): number[] {
    return Array.from({ length: this.count() }, (_, index) => index);
  }
}
