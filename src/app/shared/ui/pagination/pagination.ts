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
