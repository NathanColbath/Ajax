import { Component, input } from '@angular/core';

@Component({
  selector: 'ajax-skeleton',
  standalone: true,
  template: `<div class="skeleton ajax-motion-sensitive" [style.width]="width()" [style.height]="height()"></div>`,
  styles: `
    .skeleton {
      display: block;
      border-radius: 6px;
      background: linear-gradient(
        90deg,
        var(--mat-sys-surface-container) 25%,
        var(--mat-sys-surface-container-highest) 37%,
        var(--mat-sys-surface-container) 63%
      );
      background-size: 400% 100%;
      animation: ajax-skeleton-shimmer 1.4s ease infinite;
    }

    @keyframes ajax-skeleton-shimmer {
      0% {
        background-position: 100% 0;
      }
      100% {
        background-position: 0 0;
      }
    }
  `,
})
export class AjaxSkeleton {
  readonly width = input('100%');
  readonly height = input('1rem');
}
