import { Component, input, output } from '@angular/core';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';

@Component({
  selector: 'ajax-pagination',
  standalone: true,
  imports: [MatPaginatorModule],
  template: `
    <mat-paginator
      [length]="length()"
      [pageSize]="pageSize()"
      [pageIndex]="pageIndex()"
      [pageSizeOptions]="pageSizeOptions()"
      [showFirstLastButtons]="showFirstLastButtons()"
      [disabled]="disabled()"
      [hidePageSize]="hidePageSize()"
      (page)="pageChange.emit($event)"
    />
  `,
  styles: `
    :host {
      display: block;
      max-width: 100%;
      min-width: 0;
    }

    mat-paginator {
      max-width: 100%;
    }

    ::ng-deep .mat-mdc-paginator-container {
      flex-wrap: wrap;
      justify-content: flex-end;
      row-gap: 0.35rem;
    }

    @media (max-width: 480px) {
      ::ng-deep .mat-mdc-paginator-container {
        justify-content: center;
      }

      ::ng-deep .mat-mdc-paginator-navigation-first,
      ::ng-deep .mat-mdc-paginator-navigation-last {
        display: none !important;
      }
    }
  `,
})
export class AjaxPagination {
  readonly length = input(0);
  readonly pageSize = input(10);
  readonly pageIndex = input(0);
  readonly pageSizeOptions = input<number[]>([5, 10, 25, 50]);
  readonly showFirstLastButtons = input(true);
  readonly disabled = input(false);
  readonly hidePageSize = input(false);
  readonly pageChange = output<PageEvent>();
}
