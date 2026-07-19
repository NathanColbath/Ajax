import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

export interface AjaxBreadcrumbItem {
  label: string;
  link?: string | string[];
}

@Component({
  selector: 'ajax-breadcrumb',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <nav class="ajax-breadcrumb" [attr.aria-label]="ariaLabel()">
      <ol>
        @for (item of items(); track item.label; let last = $last) {
          <li>
            @if (!last && item.link) {
              <a [routerLink]="item.link" (click)="itemClick.emit(item)">{{ item.label }}</a>
            } @else if (!last) {
              <button type="button" class="linkish" (click)="itemClick.emit(item)">
                {{ item.label }}
              </button>
            } @else {
              <span aria-current="page">{{ item.label }}</span>
            }
            @if (!last) {
              <mat-icon class="separator" aria-hidden="true">chevron_right</mat-icon>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: `
    .ajax-breadcrumb ol {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.15rem;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .ajax-breadcrumb li {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
    }

    .ajax-breadcrumb a,
    .ajax-breadcrumb .linkish {
      color: var(--mat-sys-primary);
      text-decoration: none;
      background: none;
      border: 0;
      padding: 0;
      font: inherit;
      cursor: pointer;
    }

    .ajax-breadcrumb a:hover,
    .ajax-breadcrumb .linkish:hover {
      text-decoration: underline;
    }

    .ajax-breadcrumb span[aria-current='page'] {
      color: var(--mat-sys-on-surface);
      font-weight: 500;
    }

    .separator {
      font-size: 1.1rem;
      width: 1.1rem;
      height: 1.1rem;
      opacity: 0.55;
    }
  `,
})
export class AjaxBreadcrumb {
  readonly items = input<AjaxBreadcrumbItem[]>([]);
  readonly ariaLabel = input('Breadcrumb');
  readonly itemClick = output<AjaxBreadcrumbItem>();
}
