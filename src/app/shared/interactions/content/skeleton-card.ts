import { Component } from '@angular/core';
import { AjaxSkeleton } from './skeleton';

@Component({
  selector: 'ajax-skeleton-card',
  standalone: true,
  imports: [AjaxSkeleton],
  template: `
    <div class="card">
      <ajax-skeleton height="1.25rem" width="40%" />
      <ajax-skeleton height="0.9rem" width="90%" />
      <ajax-skeleton height="0.9rem" width="70%" />
      <ajax-skeleton height="6rem" width="100%" />
    </div>
  `,
  styles: `
    .card {
      display: grid;
      gap: 0.65rem;
      padding: 1rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 10px;
    }
  `,
})
export class AjaxSkeletonCard {}
